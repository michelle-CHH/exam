import { describe, expect, it } from 'vitest';
import { getOptionLetter, formatOptionsToJsonObject } from './sheetParser';

describe('getOptionLetter', () => {
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
  });

  it('supports formatOptionsToJsonObject with more than 5 options dynamically', () => {
    const rawOptions = [
      '選項一',
      '選項二',
      '選項三',
      '選項四',
      '選項五',
      '選項六',
      '選項七',
    ];
    const jsonStr = formatOptionsToJsonObject(rawOptions);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.A).toBe('選項一');
    expect(parsed.E).toBe('選項五');
    expect(parsed.F).toBe('選項六');
    expect(parsed.G).toBe('選項七');
  });
});
