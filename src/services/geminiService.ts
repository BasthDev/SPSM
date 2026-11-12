import { apiClient } from './apiClient';

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

export function isBlockingMatch(level: string): boolean {
  return BLOCKING_LEVELS.has(level);
}

export function isWarningMatch(level: string): boolean {
  return WARNING_LEVELS.has(level);
}

/**
 * Checks similarity of proposed titles against existing titles via backend API Server.
 * All Gemini AI processing & comparison are executed in the server validator layer.
 */
export async function checkTitleSimilarity(
  newTitles: string[],
  _existingTitles?: { title: string; submission_id?: string }[]
): Promise<SimilarityReport> {
  const titles = newTitles.map((t) => t.trim()).filter(Boolean);
  if (titles.length === 0) {
    return { checked: true, matches: [] };
  }

  try {
    const res = await apiClient.submissions.checkSimilarity(titles);
    const data = res?.data || res;
    const matches: TitleMatch[] = data?.allMatches || data?.matches || [];

    return {
      checked: data?.checked !== false,
      matches,
      error: data?.errorMessage,
    };
  } catch (err: any) {
    console.warn('[geminiService] Backend similarity check failed:', err);
    return {
      checked: false,
      matches: [],
      error: err?.message || 'Gagal memeriksa kemiripan judul ke server',
    };
  }
}
