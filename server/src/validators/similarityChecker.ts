import { config } from '../config';
import { ComparableTitleItem } from '../database/types';

export interface TitleMatch {
  newTitle: string;
  matchedTitle: string;
  level: 'tinggi' | 'sedang' | 'rendah';
  reason: string;
}

export interface SimilarityReport {
  checked: boolean;
  isDuplicate: boolean;
  blockingMatches: TitleMatch[];
  warningMatches: TitleMatch[];
  allMatches: TitleMatch[];
  errorMessage?: string;
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(dan|yang|di|ke|dari|untuk|dengan|berbasis|analisis|studi|pengaruh|terhadap|pada|ini|itu|atau|dalam|secara|adalah|serta|tersebut|terkait|tentang|oleh|akan|juga|sangat|lebih|antara|dapat|tidak|sudah|belum)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text-based normalization and exact / near-exact matching
 */
export function findExactMatches(
  newTitles: string[],
  existingTitles: ComparableTitleItem[]
): TitleMatch[] {
  const matches: TitleMatch[] = [];
  const seen = new Set<string>();

  for (const nt of newTitles) {
    const norm = normalizeTitle(nt);
    if (!norm) continue;

    for (const ex of existingTitles) {
      const exNorm = normalizeTitle(ex.title);
      if (!exNorm) continue;

      const identical = norm === exNorm;
      const contained =
        (norm.includes(exNorm) || exNorm.includes(norm)) &&
        Math.min(norm.length, exNorm.length) / Math.max(norm.length, exNorm.length) > 0.8;

      if ((identical || contained) && !seen.has(`${nt}::${ex.title}`)) {
        seen.add(`${nt}::${ex.title}`);
        matches.push({
          newTitle: nt,
          matchedTitle: ex.title,
          level: 'tinggi',
          reason: identical ? 'Judul identik sama persis dengan yang sudah terdaftar' : 'Judul hampir identik dengan yang sudah terdaftar',
        });
      }
    }
  }
  return matches;
}

/**
 * AI-powered similarity checking using Gemini API
 */
export async function checkTitleSimilarityWithGemini(
  newTitles: string[],
  existingTitles: ComparableTitleItem[]
): Promise<SimilarityReport> {
  // 1. Text exact matches first
  const exact = findExactMatches(newTitles, existingTitles);

  const apiKey = config.gemini.apiKey;
  if (!apiKey) {
    const isDuplicate = exact.some((m) => m.level === 'tinggi');
    return {
      checked: false,
      isDuplicate,
      blockingMatches: exact.filter((m) => m.level === 'tinggi'),
      warningMatches: exact.filter((m) => m.level === 'sedang'),
      allMatches: exact,
      errorMessage: 'Gemini API key belum dikonfigurasi di server',
    };
  }

  if (existingTitles.length === 0) {
    return {
      checked: true,
      isDuplicate: false,
      blockingMatches: [],
      warningMatches: [],
      allMatches: [],
    };
  }

  try {
    const existingList = existingTitles
      .slice(0, 300)
      .map((e, i) => `${i + 1}. ${e.title}`)
      .join('\n');
    const newList = newTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const prompt = `Kamu adalah asisten validator akademik yang memeriksa duplikasi judul skripsi.
Tugas: Periksa apakah ada judul baru yang SAMA PERSIS atau SANGAT MIRIP dengan judul yang sudah ada di database skripsi.
Pertimbangkan kemiripan topik, metodologi, fokus penelitian, dan parafrase kata.

JUDUL BARU YANG DIAJUKAN:
${newList}

DATABASE JUDUL SKRIPSI YANG SUDAH TERDAFTAR:
${existingList}

Kriteria Penilaian Tingkat Kemiripan (level):
- "tinggi": Topik, objek studi, dan fokus penelitian SAMA PERSIS atau HAMPIR SAMA (hanya parafrase minor). Pengajuan WAJIB DITOLAK.
- "sedang": Topik mirip tetapi ada perbedaan fokus atau objek studi yang cukup berarti.
- "rendah": Kemiripan sangat minim / topik berbeda.

Jawab HANYA dalam format JSON array valid (tanpa penjelasan tambahan, tanpa markdown format):
[
  {
    "new_title": "...",
    "matched_title": "...",
    "level": "tinggi" | "sedang" | "rendah",
    "reason": "Penjelasan ringkas mengapa judul ini dianggap mirip/duplikat"
  }
]
Jika tidak ada judul yang mirip sama sekali, jawab: []`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Gemini API error ${res.status}:`, errText);
      const isDuplicate = exact.some((m) => m.level === 'tinggi');
      return {
        checked: false,
        isDuplicate,
        blockingMatches: exact.filter((m) => m.level === 'tinggi'),
        warningMatches: [],
        allMatches: exact,
        errorMessage: `Gemini error ${res.status}: ${errText.slice(0, 100)}`,
      };
    }

    const data: any = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const aiMatches: TitleMatch[] = (Array.isArray(parsed) ? parsed : [])
      .filter((m) => m && m.new_title && m.matched_title)
      .map((m) => ({
        newTitle: String(m.new_title),
        matchedTitle: String(m.matched_title),
        level: (['tinggi', 'sedang', 'rendah'].includes(m.level) ? m.level : 'rendah') as TitleMatch['level'],
        reason: String(m.reason || ''),
      }))
      .filter((m) => m.level !== 'rendah');

    // Merge: exact matches take precedence
    const merged = [...exact];
    for (const m of aiMatches) {
      const dup = merged.some(
        (e) =>
          normalizeTitle(e.newTitle) === normalizeTitle(m.newTitle) &&
          normalizeTitle(e.matchedTitle) === normalizeTitle(m.matchedTitle)
      );
      if (!dup) merged.push(m);
    }

    const blockingMatches = merged.filter((m) => m.level === 'tinggi');
    const warningMatches = merged.filter((m) => m.level === 'sedang');
    const isDuplicate = blockingMatches.length > 0;

    return {
      checked: true,
      isDuplicate,
      blockingMatches,
      warningMatches,
      allMatches: merged,
    };
  } catch (error: any) {
    console.error('Gemini check exception:', error);
    const isDuplicate = exact.some((m) => m.level === 'tinggi');
    return {
      checked: false,
      isDuplicate,
      blockingMatches: exact.filter((m) => m.level === 'tinggi'),
      warningMatches: [],
      allMatches: exact,
      errorMessage: error.message || 'Gagal menghubungi server Gemini',
    };
  }
}
