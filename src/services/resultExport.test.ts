import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExamReport } from '@/utils/examReport';
import type { Exam } from '@/types/exam';
import { createWrongQuestionsFile, exportWrongQuestionsToGoogleSheet, resultExcelCells, resultExportRows } from './resultExport';

const exam: Exam = { id: 'export', title: '試卷', subtitle: '', durationSec: 60, questions: [
  { id: 'q1', prompt: '=HYPERLINK("https://example.com")\n多行,題目', type: 'single', points: 2, answer: 'A', explanation: '詳解', options: [{ id: 'A', text: '選項' }] },
] };
const items = buildExamReport(exam, { q1: 'B' }).items;

describe('result exports', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves question text, options, answers and explanations', () => {
    const rows = resultExportRows(items);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([1, 'q1', '未分類', '未標示', exam.questions[0].prompt, 'A. 選項', 'B', 'A', '答錯', 2, 0, '詳解']);
  });
  it('creates a valid Excel workbook with literal strings, not formulas', async () => {
    expect(resultExcelCells(items)[1][4]).toMatchObject({ type: String, value: exam.questions[0].prompt });
    const blob = await createWrongQuestionsFile(items);
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    expect(new Uint8Array(bytes).slice(0, 2)).toEqual(new Uint8Array([80, 75]));
  });
  it('creates a Google Sheet and sends literal stringValue cells', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ spreadsheetId: 'sheet-123' }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await exportWrongQuestionsToGoogleSheet(items, '測驗', 'token')).toBe('https://docs.google.com/spreadsheets/d/sheet-123/edit');
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sheets.googleapis.com/v4/spreadsheets');
    expect(request.headers.Authorization).toBe('Bearer token');
    const cells = JSON.parse(request.body).sheets[0].data[0].rowData[1].values;
    expect(cells[4].userEnteredValue).toEqual({ stringValue: exam.questions[0].prompt });
  });
  it('rejects missing authorization and empty exports without sending a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(exportWrongQuestionsToGoogleSheet(items, '測驗', '')).rejects.toThrow('登入');
    await expect(exportWrongQuestionsToGoogleSheet([], '測驗', 'token')).rejects.toThrow('沒有');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500])('surfaces Google HTTP %i instead of claiming success', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: { message: 'failed' } }) }));
    await expect(exportWrongQuestionsToGoogleSheet(items, '測驗', 'token')).rejects.toThrow();
  });

  it('triggers browser download for wrong questions excel file', async () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:xlsx-url'),
      revokeObjectURL: vi.fn(),
    });
    const realLink = document.createElement('a');
    const clickMock = vi.spyOn(realLink, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(realLink);

    const { downloadWrongQuestions } = await import('./resultExport');
    await downloadWrongQuestions(items, '模擬考/第1回');

    expect(clickMock).toHaveBeenCalled();
    expect(realLink.download).toBe('錯題_模擬考_第1回.xlsx');
  });

  it('appends to bound user spreadsheet when Review notebook already exists', async () => {
    const fetchMock = vi.fn()
      // 1. Meta query returns existing Review notebook
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sheets: [{ properties: { title: 'Review notebook' } }],
        }),
      })
      // 2. Append values
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updates: { updatedRows: 1 } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportWrongQuestionsToGoogleSheet(items, '測驗', 'token', {
      userSheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
      submittedAt: '2026/11/25 10:00:00',
    });

    expect(result).toBe('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("'Review notebook'!A1:append");
  });

  it('creates Review notebook sheet and writes headers when sheet does not exist yet', async () => {
    const fetchMock = vi.fn()
      // 1. Meta query returns no Review notebook
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sheets: [{ properties: { title: 'Sheet1' } }],
        }),
      })
      // 2. Add sheet batchUpdate
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ replies: [] }),
      })
      // 3. Write header row
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updatedCells: 11 }),
      })
      // 4. Append values
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ updates: { updatedRows: 1 } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exportWrongQuestionsToGoogleSheet(items, '測驗', 'token', {
      userSheetUrl: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
    });

    expect(result).toBe('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws error when user spreadsheet operations fail', async () => {
    // 1. Meta query returns 401
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) }));
    await expect(
      exportWrongQuestionsToGoogleSheet(items, '測驗', 'token', {
        userSheetUrl: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      })
    ).rejects.toThrow('Google 授權已過期');

    // 2. Meta query returns 403
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) }));
    await expect(
      exportWrongQuestionsToGoogleSheet(items, '測驗', 'token', {
        userSheetUrl: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      })
    ).rejects.toThrow('Google 拒絕存取');
  });

  it('throws error when Google returns invalid spreadsheet ID during fallback creation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spreadsheetId: '!!invalid-id!!' }),
    }));
    await expect(exportWrongQuestionsToGoogleSheet(items, '測驗', 'token')).rejects.toThrow(
      'Google 未回傳有效的試算表 ID'
    );
  });
});
