import { db } from '../database';
import { checkTitleSimilarityWithGemini, SimilarityReport, TitleMatch } from './similarityChecker';

export class SubmissionValidationError extends Error {
  public statusCode: number;
  public matches: TitleMatch[];

  constructor(message: string, matches: TitleMatch[] = []) {
    super(message);
    this.name = 'SubmissionValidationError';
    this.statusCode = 422; // Unprocessable Entity
    this.matches = matches;
  }
}

export interface OptionInput {
  number: number;
  title: string;
  background?: string;
  relevanceVariable?: string;
  relevanceMethodology?: string;
  relevanceNote?: string;
  journalTitle?: string;
  journalAuthor?: string;
  journalYear?: string;
  journalFileId?: string | null;
}

export interface CreateSubmissionInput {
  studentId: string;
  options: OptionInput[];
  preferredAdvisor1Id?: string | null;
  preferredAdvisor2Id?: string | null;
}

export class SubmissionValidator {
  /**
   * Validate submission payload format and check for title similarity / duplicate.
   * If an identical or highly similar title exists, it throws a SubmissionValidationError.
   */
  static async validateAndCheckSimilarity(
    input: CreateSubmissionInput
  ): Promise<{ similarityReport: SimilarityReport }> {
    // 1. Basic schema validation
    if (!input.studentId) {
      throw new SubmissionValidationError('Student ID / Mahasiswa wajib diisi.', []);
    }

    if (!input.options || !Array.isArray(input.options) || input.options.length === 0) {
      throw new SubmissionValidationError('Minimal satu opsi judul skripsi harus diisi.', []);
    }

    const titlesToValidate: string[] = [];

    for (let i = 0; i < input.options.length; i++) {
      const opt = input.options[i];
      if (!opt.title || !opt.title.trim()) {
        throw new SubmissionValidationError(`Judul untuk opsi #${opt.number || i + 1} wajib diisi.`, []);
      }
      titlesToValidate.push(opt.title.trim());
    }

    // 2. Fetch existing active titles from database adapter
    const existingTitles = await db.getAllActiveTitles();

    // 3. Check similarity via Gemini AI and exact string matching
    const report = await checkTitleSimilarityWithGemini(titlesToValidate, existingTitles);

    // 4. Reject if identical or highly similar
    if (report.isDuplicate && report.blockingMatches.length > 0) {
      const firstMatch = report.blockingMatches[0];
      const message = `Pengajuan Ditolak: Judul "${firstMatch.newTitle}" terdeteksi sama/terlalu mirip dengan judul skripsi terdaftar ("${firstMatch.matchedTitle}"). Alasan: ${firstMatch.reason}.`;

      throw new SubmissionValidationError(message, report.blockingMatches);
    }

    return { similarityReport: report };
  }
}
