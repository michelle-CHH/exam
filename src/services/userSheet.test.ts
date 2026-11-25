import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendExamToUserSheet,
  appendQuestionToUserSheet,
  createPersonalDatabaseSpreadsheet,
  fetchWrongQuestionsFromUserSheet,
  readUserPrivateSheet,
  searchPersonalSpreadsheetsInDrive,
} from './userSheet';
import type { ExamPaper, Question } from '@/types';

// Mock readAllTablesFromSpreadsheet from publicSheet
vi.mock('@/services/publicSheet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/publicSheet')>();
  return {
    ...actual,
    readAllTablesFromSpreadsheet: vi.fn().mockResolvedValue({
      questions: [{ id: 'Q-MOCK-1', content: '題目' }],
      publishedExams: [],
      draftExams: [],
      categories: [],
      roles: [],
      users: [],
      auditLogs: [],
      errors: [],
    }),
    ensureSpreadsheetTablesExist: vi.fn().mockResolvedValue(true),
  };
});

describe('userSheet - readUserPrivateSheet', () => {
  it('throws error when userSheetUrl is invalid or lacks spreadsheetId', async () => {
    await expect(readUserPrivateSheet('token', 'https://example.com/not-sheet')).rejects.toThrow(
      '無效的個人 Google 試算表網址'
    );
  });

  it('calls readAllTablesFromSpreadsheet with extracted spreadsheetId when URL is valid', async () => {
    const validUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    const result = await readUserPrivateSheet('valid-token', validUrl);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe('Q-MOCK-1');
  });
});

describe('userSheet - createPersonalDatabaseSpreadsheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends POST to Google Sheets API and returns spreadsheet details', async () => {
    const fetchMock = vi.fn()
      // 1. Create spreadsheet POST
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spreadsheetId: 'new-personal-sheet-id',
          spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/new-personal-sheet-id/edit',
        }),
      })
      // 2. Fetch created sheet metadata to check tables
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sheets: [
            { properties: { title: 'test_bank' } },
            { properties: { title: 'quiz_bank_publish' } },
            { properties: { title: 'quiz_bank_unpublish' } },
            { properties: { title: 'log' } },
          ],
        }),
      })
      // 3. Write header rows (4 tables)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ updatedCells: 10 }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await createPersonalDatabaseSpreadsheet('test-token', '我的專屬題庫');

    expect(result.spreadsheetId).toBe('new-personal-sheet-id');
    expect(result.spreadsheetUrl).toContain('new-personal-sheet-id');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sheets.googleapis.com/v4/spreadsheets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
  });

  it('throws error when Google Sheets creation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Quota exceeded' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(createPersonalDatabaseSpreadsheet('test-token')).rejects.toThrow('Quota exceeded');
  });
});

describe('userSheet - searchPersonalSpreadsheetsInDrive', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries Google Drive v3 API and marks personal database files correctly', async () => {
    const mockFiles = [
      {
        id: 'file-1',
        name: '個人專屬題庫_數學',
        webViewLink: 'https://docs.google.com/spreadsheets/d/file-1/edit',
        modifiedTime: '2026-11-25T10:00:00Z',
      },
      {
        id: 'file-2',
        name: '家庭財務預算表',
        webViewLink: 'https://docs.google.com/spreadsheets/d/file-2/edit',
        modifiedTime: '2026-11-20T10:00:00Z',
      },
      {
        id: 'file-3',
        name: 'English Quiz Test Bank',
        webViewLink: 'https://docs.google.com/spreadsheets/d/file-3/edit',
      },
    ];

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: mockFiles }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchPersonalSpreadsheetsInDrive('drive-token');

    expect(result).toHaveLength(3);
    expect(result[0].isPersonalDatabase).toBe(true); // contains "個人專屬題庫"
    expect(result[1].isPersonalDatabase).toBe(false); // unrelated
    expect(result[2].isPersonalDatabase).toBe(true); // contains "quiz" / "test bank"
  });

  it('throws error when Drive API query fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchPersonalSpreadsheetsInDrive('drive-token')).rejects.toThrow('查詢雲端硬碟試算表失敗 (500)');
  });
});

describe('userSheet - fetchWrongQuestionsFromUserSheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses wrong questions from Review notebook sheet rows', async () => {
    const mockValues = [
      ['Timestamp', 'exam_title', 'test_id', 'question', 'options', 'user_answer', 'correct_answer', 'status', 'difficulty', 'subject', 'explanation'],
      ['2026/11/25', '隨堂考', 'Q-101', '直角三角形邊長比例？', 'A. 3:4:5\nB. 1:1:1', 'B', 'A', '答錯', 'easy', '數學', '勾股定理'],
    ];

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ values: mockValues }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    const result = await fetchWrongQuestionsFromUserSheet('token', sheetUrl);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe('Q-101');
    expect(result.questions[0].content).toContain('直角三角形');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].actual).toEqual(['B']);
    expect(result.records[0].expected).toEqual(['A']);
  });

  it('throws error when userSheetUrl is invalid', async () => {
    await expect(fetchWrongQuestionsFromUserSheet('token', 'bad-url')).rejects.toThrow(
      '無效的個人 Google 試算表網址'
    );
  });
});

describe('userSheet - appendQuestionToUserSheet & appendExamToUserSheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validUrl = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';

  const createSmartFetchMock = () => {
    return vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('includeGridData=false')) {
        return {
          ok: true,
          json: async () => ({
            sheets: [
              { properties: { title: 'test_bank' } },
              { properties: { title: 'quiz_bank_publish' } },
            ],
          }),
        };
      }
      if (url.includes('values:batchGet')) {
        return {
          ok: true,
          json: async () => ({
            valueRanges: [
              {
                range: 'test_bank!A1:Z1',
                values: [
                  ['id', 'test_id', 'question', 'option', 'answer', 'Explanation', 'difficulty', 'score', 'category_id', 'taqs', 'updated_at', 'updated_by', 'time'],
                ],
              },
              {
                range: 'quiz_bank_publish!A1:Z1',
                values: [
                  ['id', 'quiz_id', 'quiz_name', 'categories', 'difficulty', 'number', 'score', 'time', 'update_time', 'test_id'],
                ],
              },
            ],
          }),
        };
      }
      if (url.includes('A1:Z1') || url.includes('values/test_bank') || url.includes('values/quiz_bank_publish')) {
        return {
          ok: true,
          json: async () => ({
            values: [
              ['id', 'test_id', 'question', 'option', 'answer', 'Explanation', 'difficulty', 'score', 'category_id', 'taqs', 'updated_at', 'updated_by', 'time', 'quiz_id', 'quiz_name', 'categories', 'number'],
            ],
          }),
        };
      }
      // default append response
      return {
        ok: true,
        json: async () => ({ updates: { updatedRows: 1 } }),
      };
    });
  };

  it('appends a question to user test_bank', async () => {
    const fetchMock = createSmartFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const question: Question = {
      id: 'Q-NEW-1',
      subjectId: 'chinese',
      content: '新增測試題',
      options: ['A', 'B'],
      correctAnswer: 'A',
      difficulty: 'medium',
      points: 10,
    };

    await expect(appendQuestionToUserSheet('token', validUrl, question)).resolves.not.toThrow();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('appends an exam to user quiz_bank_publish', async () => {
    const fetchMock = createSmartFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const paper: ExamPaper = {
      id: 'P-NEW-1',
      title: '全新期末考',
      description: '測試考卷描述',
      subject: '物理',
      subjectId: 'physics',
      difficultyLv: 2,
      durationMinutes: 60,
      status: 'published',
      createdAt: '2026-11-25 12:00:00',
      questionCount: 10,
      totalScore: 100,
    };

    await expect(appendExamToUserSheet('token', validUrl, paper)).resolves.not.toThrow();
    expect(fetchMock).toHaveBeenCalled();
  });
});
