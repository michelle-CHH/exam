import type { ExamOption } from '@/types/question';

export function parseOptionJson(optionRaw: string): ExamOption[] {
  try {
    const parsed: unknown = JSON.parse(optionRaw);
    if (Array.isArray(parsed)) {
      return parsed as ExamOption[];
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, string>).map(([id, text]) => ({
        id,
        text: String(text),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export function parseAnswerString(answerRaw: string): string[] {
  return answerRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 動態由 0-based 索引計算選項字母 (0->A, 1->B, 25->Z, 26->AA, 27->AB...)
 * 徹底解除僅支援固定 A-E 選項之硬編碼限制
 */
export function getOptionLetter(index: number): string {
  if (index < 0) return 'A';
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Format options into user-specified JSON object string: {"A": "...", "B": "...", ...}
 */
export function formatOptionsToJsonObject(options?: string[] | Record<string, string>): string {
  if (!options) return '{}';
  if (!Array.isArray(options)) {
    return typeof options === 'object' ? JSON.stringify(options) : String(options);
  }
  const obj: Record<string, string> = {};
  options.forEach((opt, idx) => {
    const cleanOpt = opt.replace(/^[A-Za-z0-9][.:\s]\s*/, '').trim();
    const key = getOptionLetter(idx);
    obj[key] = cleanOpt || opt;
  });
  return JSON.stringify(obj);
}

/**
 * Parse raw option string from Google Sheet into options array and optionsMap
 */
export function parseSheetOptionJson(rawOptions: unknown): {
  options: string[];
  optionsMap?: Record<string, string>;
} {
  let parsedOptions: string[] = [];
  let parsedOptionsMap: Record<string, string> | undefined = undefined;

  if (rawOptions) {
    try {
      const parsed = JSON.parse(String(rawOptions));
      if (Array.isArray(parsed)) {
        parsedOptions = parsed.map(String);
      } else if (typeof parsed === 'object' && parsed !== null) {
        parsedOptionsMap = parsed as Record<string, string>;
        parsedOptions = Object.values(parsed).map((v) => {
          const str = String(v);
          const clean = str.replace(/^[A-Za-z0-9][\.\、\:\)\s]+\s*|^\([A-Za-z0-9]\)\s*/, '').trim();
          return clean || str;
        });
      }
    } catch {
      if (typeof rawOptions === 'string') {
        parsedOptions = rawOptions
          .split(/\n|;;/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  return { options: parsedOptions, optionsMap: parsedOptionsMap };
}

/**
 * Split answer string (e.g., "A, C") into normalized array ["A", "C"]
 */
export function parseAnswerTokens(rawAnswer?: string): string[] {
  if (!rawAnswer) return [];
  return rawAnswer
    .split(/[,，、\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Extract Google Spreadsheet ID from URL or raw ID string
 */
export function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9-_]{20,70}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}
