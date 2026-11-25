import { describe, expect, it } from 'vitest';
import {
  extractSpreadsheetId,
  formatOptionsToJsonObject,
  getOptionLetter,
  parseAnswerString,
  parseAnswerTokens,
  parseOptionJson,
  parseSheetOptionJson,
} from './sheetParser';

describe('sheetParser - parseOptionJson', () => {
  it('parses valid ExamOption array', () => {
    const raw = JSON.stringify([
      { id: 'opt1', text: '選項一' },
      { id: 'opt2', text: '選項二' },
    ]);
    expect(parseOptionJson(raw)).toEqual([
      { id: 'opt1', text: '選項一' },
      { id: 'opt2', text: '選項二' },
    ]);
  });

  it('converts key-value object format to ExamOption array', () => {
    const raw = JSON.stringify({ A: '選項A', B: '選項B' });
    expect(parseOptionJson(raw)).toEqual([
      { id: 'A', text: '選項A' },
      { id: 'B', text: '選項B' },
    ]);
  });

  it('safely returns empty array for non-object/non-array JSON primitives', () => {
    expect(parseOptionJson('"just a string"')).toEqual([]);
    expect(parseOptionJson('12345')).toEqual([]);
    expect(parseOptionJson('null')).toEqual([]);
  });

  it('returns empty array when JSON parsing throws syntax error', () => {
    expect(parseOptionJson('{ invalid json')).toEqual([]);
    expect(parseOptionJson('')).toEqual([]);
  });
});

describe('sheetParser - parseAnswerString', () => {
  it('splits comma-separated answers and trims whitespace', () => {
    expect(parseAnswerString('A, B , C')).toEqual(['A', 'B', 'C']);
  });

  it('filters out empty entries', () => {
    expect(parseAnswerString('A, , B, ,')).toEqual(['A', 'B']);
    expect(parseAnswerString('')).toEqual([]);
  });
});

describe('sheetParser - getOptionLetter', () => {
  it('returns "A" fallback for negative indices', () => {
    expect(getOptionLetter(-1)).toBe('A');
    expect(getOptionLetter(-100)).toBe('A');
  });

  it('generates standard uppercase letters for indices 0 to 25', () => {
    expect(getOptionLetter(0)).toBe('A');
    expect(getOptionLetter(1)).toBe('B');
    expect(getOptionLetter(2)).toBe('C');
    expect(getOptionLetter(3)).toBe('D');
    expect(getOptionLetter(4)).toBe('E');
    expect(getOptionLetter(25)).toBe('Z');
  });

  it('generates multi-letter identifiers for indices beyond 25', () => {
    expect(getOptionLetter(26)).toBe('AA');
    expect(getOptionLetter(27)).toBe('AB');
    expect(getOptionLetter(51)).toBe('AZ');
    expect(getOptionLetter(52)).toBe('BA');
    expect(getOptionLetter(701)).toBe('ZZ');
    expect(getOptionLetter(702)).toBe('AAA');
  });
});

describe('sheetParser - formatOptionsToJsonObject', () => {
  it('returns "{}" when options is undefined or null', () => {
    expect(formatOptionsToJsonObject(undefined)).toBe('{}');
    expect(formatOptionsToJsonObject(null as unknown as string[])).toBe('{}');
  });

  it('handles non-array options by stringifying or returning as-is', () => {
    expect(formatOptionsToJsonObject({ A: '選項A', B: '選項B' })).toBe(
      JSON.stringify({ A: '選項A', B: '選項B' })
    );
    expect(formatOptionsToJsonObject('raw-string' as unknown as string[])).toBe('raw-string');
  });

  it('formats string array into JSON object with dynamic letters and strips prefixes', () => {
    const rawOptions = [
      'A. 選項一',
      'B: 選項二',
      'C 選項三',
      '選項四',
      '',
    ];
    const jsonStr = formatOptionsToJsonObject(rawOptions);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.A).toBe('選項一');
    expect(parsed.B).toBe('選項二');
    expect(parsed.C).toBe('選項三');
    expect(parsed.D).toBe('選項四');
    expect(parsed.E).toBe('');
  });

  it('supports formatting more than 26 options dynamically', () => {
    const rawOptions = Array.from({ length: 30 }, (_, i) => `Option ${i + 1}`);
    const jsonStr = formatOptionsToJsonObject(rawOptions);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.A).toBe('Option 1');
    expect(parsed.Z).toBe('Option 26');
    expect(parsed.AA).toBe('Option 27');
    expect(parsed.AD).toBe('Option 30');
  });
});

describe('sheetParser - parseSheetOptionJson', () => {
  it('returns empty result when rawOptions is falsy or null in JSON', () => {
    expect(parseSheetOptionJson(null)).toEqual({ options: [], optionsMap: undefined });
    expect(parseSheetOptionJson('')).toEqual({ options: [], optionsMap: undefined });
    expect(parseSheetOptionJson(undefined)).toEqual({ options: [], optionsMap: undefined });
    expect(parseSheetOptionJson('null')).toEqual({ options: [], optionsMap: undefined });
  });

  it('parses valid JSON array into string array', () => {
    const raw = JSON.stringify(['選項1', '選項2', 3]);
    const result = parseSheetOptionJson(raw);
    expect(result).toEqual({
      options: ['選項1', '選項2', '3'],
      optionsMap: undefined,
    });
  });

  it('parses valid JSON object, cleans option labels, and preserves optionsMap', () => {
    const raw = JSON.stringify({
      A: 'A. 台北',
      B: 'B、台中',
      C: '(C) 高雄',
      D: 'D: 台南',
      E: '花蓮',
      F: 'F.', // clean is empty string, tests 'clean || str' fallback branch
    });
    const result = parseSheetOptionJson(raw);
    expect(result.options).toEqual(['台北', '台中', '高雄', '台南', '花蓮', 'F.']);
    expect(result.optionsMap).toEqual({
      A: 'A. 台北',
      B: 'B、台中',
      C: '(C) 高雄',
      D: 'D: 台南',
      E: '花蓮',
      F: 'F.',
    });
  });

  it('falls back to newline or double semicolon delimiter if JSON parsing fails on string', () => {
    const rawWithNewlines = '選項一\n選項二\n\n選項三';
    expect(parseSheetOptionJson(rawWithNewlines)).toEqual({
      options: ['選項一', '選項二', '選項三'],
      optionsMap: undefined,
    });

    const rawWithSemicolons = '選項A;;選項B;;選項C';
    expect(parseSheetOptionJson(rawWithSemicolons)).toEqual({
      options: ['選項A', '選項B', '選項C'],
      optionsMap: undefined,
    });
  });

  it('handles non-string rawOptions that fail JSON parsing safely', () => {
    // Non-string object whose toString produces invalid JSON
    const corruptNonString = { toString: () => '{ corrupt json' };
    expect(parseSheetOptionJson(corruptNonString)).toEqual({
      options: [],
      optionsMap: undefined,
    });
  });
});

describe('sheetParser - parseAnswerTokens', () => {
  it('returns empty array when rawAnswer is falsy', () => {
    expect(parseAnswerTokens('')).toEqual([]);
    expect(parseAnswerTokens(undefined)).toEqual([]);
  });

  it('splits answers by commas, fullwidth commas, enumeration pauses, or whitespace and uppercases', () => {
    expect(parseAnswerTokens('a, c')).toEqual(['A', 'C']);
    expect(parseAnswerTokens('a，b、c d')).toEqual(['A', 'B', 'C', 'D']);
    expect(parseAnswerTokens('  t, f  ')).toEqual(['T', 'F']);
  });
});

describe('sheetParser - extractSpreadsheetId', () => {
  it('returns null when input is empty or nullish', () => {
    expect(extractSpreadsheetId('')).toBeNull();
    expect(extractSpreadsheetId('   ')).toBeNull();
  });

  it('returns raw ID directly if input matches standard Google Sheet ID length and characters', () => {
    const validId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    expect(extractSpreadsheetId(validId)).toBe(validId);
    expect(extractSpreadsheetId(`  ${validId}  `)).toBe(validId);
  });

  it('extracts ID from full Google Spreadsheet URLs', () => {
    const url1 = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
    expect(extractSpreadsheetId(url1)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

    const url2 = 'https://docs.google.com/spreadsheets/d/2C_demo-id_123456789/export?format=csv';
    expect(extractSpreadsheetId(url2)).toBe('2C_demo-id_123456789');
  });

  it('returns null for invalid URLs or short non-ID strings', () => {
    expect(extractSpreadsheetId('https://example.com/other-document')).toBeNull();
    expect(extractSpreadsheetId('too_short_id')).toBeNull();
    expect(extractSpreadsheetId('https://docs.google.com/spreadsheets/d/')).toBeNull();
  });
});
