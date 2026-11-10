const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.0-flash';

export type TitleMatch = {
  newTitle: string;
  matchedTitle: string;
  level: 'tinggi' | 'sedang' | 'rendah';
  reason: string;
};

export type SimilarityReport = {
  checked: boolean;
  matches: TitleMatch[];
  error?: string;
};

const BLOCKING_LEVELS = new Set(['tinggi']);
const WARNING_LEVELS = new Set(['sedang']);

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(dan|yang|di|ke|dari|untuk|dengan|berbasis|analisis|studi|pengaruh|terhadap|pada|ini|itu|atau|dalam|secara|adalah|serta|serta|tersebut|terkait|tentang|oleh|akan|juga|sangat|lebih|antara|terhadap|dapat|tidak|sudah|belum)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Exact / near-exact title matching (no AI needed).
 * Catches identical titles even if Gemini is unavailable.
 */
export function findExactMatches(
  newTitles: string[],
  existingTitles: { title: string; submission_id?: string }[]
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
      // one contains the other and is at least 80% of its length
      const contained =
        (norm.includes(exNorm) || exNorm.includes(norm)) &&
        Math.min(norm.length, exNorm.length) / Math.max(norm.length, exNorm.length) > 0.8;
      if ((identical || contained) && !seen.has(`${nt}::${ex.title}`)) {
        seen.add(`${nt}::${ex.title}`);
        matches.push({
          newTitle: nt,
          matchedTitle: ex.title,
          level: 'tinggi',
          reason: identical ? 'Judul identik' : 'Judul hampir identik',
        });
      }
    }
  }
  return matches;
}

/**
 * AI-powered similarity check using Gemini.
 * Compares new titles against existing (approved/active) titles.
 * Returns matches with level: tinggi (block), sedang (warn), rendah (ignore).
 * Fails silently (checked=false) if no API key or request fails.
 */
export async function checkTitleSimilarity(
  newTitles: string[],
  existingTitles: { title: string; submission_id?: string }[]
): Promise<SimilarityReport> {
  const exact = findExactMatches(newTitles, existingTitles);

  if (!GEMINI_API_KEY) {
    return { checked: false, matches: exact, error: 'Gemini API key belum dikonfigurasi' };
  }
  if (existingTitles.length === 0) {
    return { checked: true, matches: exact };
  }

  try {
    // Keep prompt size reasonable — cap existing titles
    const existingList = existingTitles.slice(0, 300).map((e, i) => `${i + 1}. ${e.title}`).join('\n');
    const newList = newTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const prompt = `Kamu adalah asisten yang memeriksa duplikasi judul skripsi.

JUDUL BARU YANG DIAJUKAN:
${newList}

JUDUL SKRIPSI YANG SUDAH ADA:
${existingList}

Tugas: tentukan apakah ada judul baru yang SAMA atau SANGAT MIRIP dengan judul yang sudah ada.
Pertimbangkan kemiripan topik, fokus penelitian, dan kombinasi kata — bukan hanya kemiripan teks.

Jawab HANYA dengan JSON array (tanpa markdown), format:
[{"new_title": "...", "matched_title": "...", "level": "tinggi"|"sedang"|"rendah", "reason": "..."}]

Keterangan level:
- "tinggi": judul sama atau hampir sama (topik & fokus identik, hanya beda dikit)
- "sedang": topik mirip tapi ada perbedaan fokus yang cukup berarti
- "rendah": agak mirip tapi tetap berbeda

Jika tidak ada yang mirip, jawab: []`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
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
      const body = await res.text().catch(() => '');
      return { checked: false, matches: exact, error: `Gemini error ${res.status}: ${body.slice(0, 120)}` };
    }

    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(text);
    } catch {
      // strip markdown fences just in case
      const cleaned = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const aiMatches: TitleMatch[] = (Array.isArray(parsed) ? parsed : [])
      .filter((m) => m && m.new_title && m.matched_title)
      .map((m) => ({
        newTitle: String(m.new_title),
        matchedTitle: String(m.matched_title),
        level: ([...BLOCKING_LEVELS, ...WARNING_LEVELS].includes(m.level) ? m.level : 'rendah') as TitleMatch['level'],
        reason: String(m.reason || ''),
      }))
      .filter((m) => m.level !== 'rendah');

    // Merge: exact matches take precedence (tinggi)
    const merged = [...exact];
    for (const m of aiMatches) {
      const dup = merged.some(
        (e) => normalizeTitle(e.newTitle) === normalizeTitle(m.newTitle) &&
               normalizeTitle(e.matchedTitle) === normalizeTitle(m.matchedTitle)
      );
      if (!dup) merged.push(m);
    }

    return { checked: true, matches: merged };
  } catch (err: any) {
    return { checked: false, matches: exact, error: err?.message || 'Gagal menghubungi Gemini' };
  }
}
