import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditLogsToSheetData,
  categoriesToSheetData,
  currentUserToUsersSheetData,
  downloadCustomExamAsGoogleSheetExcel,
  downloadFullOfflinePack,
  downloadQuestionsAsGoogleSheetExcel,
  examPapersToQuizBankSheetData,
  examPaperToQuizBankSheetData,
  generatePersonalDatabaseBlob,
  generatePublicDatabaseBlob,
  questionsToTestBankSheetData,
  rolesToSheetData,
} from './excelDatabaseExport';
import type { AuditLog, CategoryItem, ExamPaper, Question, RoleItem, UserProfile } from '@/types';

// Mock write-excel-file/browser so we don't depend on complex binary xlsx encoding in Node
vi.mock('write-excel-file/browser', () => ({
  default: vi.fn().mockImplementation(async (data: unknown) => {
    return new Blob([JSON.stringify(data)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }),
}));

describe('excelDatabaseExport - Data Mapping Functions', () => {
  type TestCell = { value?: unknown; backgroundColor?: string };
  const cell = (c: unknown): TestCell => (c as TestCell) || {};

  it('maps questions to test_bank sheet data with correct headers and types', () => {
    const mockQuestions: Question[] = [
      {
        id: 'Q-01',
        subjectId: 'science',
        content: '題目一',
        options: ['選項A', '選項B'],
        correctAnswer: 'A',
        explanation: '詳解一',
        difficulty: 'hard',
        points: 5,
        tags: ['標籤1', '標籤2'],
      },
      {
        id: 'Q-02',
        subjectId: 'science',
        content: '題目二',
        optionsMap: { A: 'A選項', B: 'B選項' },
        correctAnswer: 'B',
        difficulty: 'easy',
        points: 3,
      },
      {
        id: 'Q-03',
        subjectId: 'science',
        content: '題目三',
        option: '{"A": "字串選項"}',
        correctAnswer: 'A',
        difficulty: 'medium',
        points: 2,
      },
    ];

    const sheetData = questionsToTestBankSheetData(mockQuestions);
    expect(sheetData).toHaveLength(4); // 1 header + 3 rows

    // Header check
    const headerValues = (sheetData[0] as unknown as TestCell[]).map((c) => c.value);
    expect(headerValues).toEqual([
      'id', 'test_id', 'question', 'option', 'answer', 'Explanation',
      'difficulty', 'score', 'category_id', 'taqs', 'updated_at', 'updated_by', 'time',
    ]);
    expect(cell(sheetData[0][0]).backgroundColor).toBe('#004ac6');

    // Row 1 check
    expect(cell(sheetData[1][1]).value).toBe('Q-01');
    expect(cell(sheetData[1][2]).value).toBe('題目一');
    expect(cell(sheetData[1][3]).value).toBe(JSON.stringify(['選項A', '選項B']));
    expect(cell(sheetData[1][6]).value).toBe(4); // hard -> 4
    expect(cell(sheetData[1][7]).value).toBe(5);
    expect(cell(sheetData[1][9]).value).toBe('標籤1, 標籤2');

    // Row 2 check (optionsMap and easy difficulty)
    expect(cell(sheetData[2][3]).value).toBe(JSON.stringify({ A: 'A選項', B: 'B選項' }));
    expect(cell(sheetData[2][6]).value).toBe(2); // easy -> 2

    // Row 3 check (raw option string and medium difficulty)
    expect(cell(sheetData[3][3]).value).toBe('{"A": "字串選項"}');
    expect(cell(sheetData[3][6]).value).toBe(3); // medium -> 3
  });

  it('maps exam papers to quiz_bank sheet data', () => {
    const mockPapers: ExamPaper[] = [
      {
        id: 'EXAM-01',
        title: '模擬測驗一',
        description: '測驗描述',
        subject: '數學',
        subjectId: 'math',
        status: 'published',
        difficultyLv: 4,
        questionCount: 20,
        totalScore: 100,
        durationMinutes: 40,
        createdAt: '2026-11-25',
        questionIds: ['Q-1', 'Q-2'],
      },
    ];

    const sheetData = examPapersToQuizBankSheetData(mockPapers);
    expect(sheetData).toHaveLength(2);
    expect(cell(sheetData[1][1]).value).toBe('EXAM-01');
    expect(cell(sheetData[1][2]).value).toBe('模擬測驗一');
    expect(cell(sheetData[1][9]).value).toBe('Q-1, Q-2');

    const singleSheetData = examPaperToQuizBankSheetData(mockPapers[0]);
    expect(singleSheetData).toEqual(sheetData);
  });

  it('maps categories to sheet data', () => {
    const mockCategories: CategoryItem[] = [
      {
        id: 1,
        categories_name: '自然科學',
        level: 1,
        parent_id: 0,
        sort_order: 1,
      },
    ];

    const sheetData = categoriesToSheetData(mockCategories);
    expect(sheetData).toHaveLength(2);
    expect(cell(sheetData[1][0]).value).toBe(1);
    expect(cell(sheetData[1][2]).value).toBe('自然科學');
  });

  it('maps roles to sheet data', () => {
    const mockRoles: RoleItem[] = [
      { id: 1, code: 'ADMIN', name: '管理員', description: '最高權限' },
    ];

    const sheetData = rolesToSheetData(mockRoles);
    expect(sheetData).toHaveLength(2);
    expect(cell(sheetData[1][1]).value).toBe('ADMIN');
    expect(cell(sheetData[1][2]).value).toBe('管理員');
  });

  it('maps current user to users sheet data, masking credential', () => {
    const mockUser: UserProfile = {
      id: 99,
      uuid: 'user-uuid-99',
      status: 1,
      role: 'ADMIN',
      name: '王小明',
      nickname: '小明',
      identifier: 'ming',
      credential: 'secret_password',
      google_sheet_URL: 'https://docs.google.com/spreadsheets/d/123/edit',
    };

    const sheetData = currentUserToUsersSheetData(mockUser);
    expect(sheetData).toHaveLength(2);
    expect(cell(sheetData[1][1]).value).toBe('user-uuid-99');
    expect(cell(sheetData[1][4]).value).toBe('王小明');
    expect(cell(sheetData[1][6]).value).toBe(''); // Password must be masked
    expect(cell(sheetData[1][7]).value).toContain('https://docs.google.com');
  });

  it('falls back to guest user row when currentUser is null or undefined', () => {
    const sheetData = currentUserToUsersSheetData(null);
    expect(sheetData).toHaveLength(2);
    expect(cell(sheetData[1][1]).value).toBe('guest-offline-uuid');
    expect(cell(sheetData[1][4]).value).toBe('離線使用者');
  });

  it('maps audit logs to sheet data', () => {
    const mockLogs: AuditLog[] = [
      {
        id: 'LOG-01',
        action: 'UPDATE',
        target: 'test_bank',
        operator: 'admin',
        timestamp: '2026-11-25 12:00:00',
        status: 'success',
      },
    ];

    const sheetData = auditLogsToSheetData(mockLogs);
    expect(sheetData).toHaveLength(2);
    expect(cell(sheetData[1][1]).value).toBe('LOG-01');
    expect(cell(sheetData[1][2]).value).toBe('UPDATE');
  });
});

describe('excelDatabaseExport - Blob Generation & Downloads', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates public database blob and personal database blob', async () => {
    const publicBlob = await generatePublicDatabaseBlob({
      categories: [],
      questions: [],
      publishedExams: [],
    });
    expect(publicBlob).toBeInstanceOf(Blob);

    const personalBlob = await generatePersonalDatabaseBlob({
      questions: [],
      exams: [],
    });
    expect(personalBlob).toBeInstanceOf(Blob);
  });

  it('downloads full offline pack and writes snapshots to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const realLink = document.createElement('a');
    const clickSpy = vi.spyOn(realLink, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(realLink);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-xlsx'),
      revokeObjectURL: vi.fn(),
    });

    const result = await downloadFullOfflinePack({
      publicData: {
        categories: [],
        questions: [],
        publishedExams: [],
      },
      personalData: {
        questions: [],
        exams: [],
      },
    });

    expect(result.publicBlob).toBeInstanceOf(Blob);
    expect(result.personalBlob).toBeInstanceOf(Blob);
    expect(setItemSpy).toHaveBeenCalledWith('offline_public_db_cache', expect.any(String));
    expect(setItemSpy).toHaveBeenCalledWith('offline_personal_db_cache', expect.any(String));
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('downloads custom exam as Google Sheet aligned Excel', async () => {
    const realLink = document.createElement('a');
    const clickSpy = vi.spyOn(realLink, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(realLink);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-custom'),
      revokeObjectURL: vi.fn(),
    });

    const mockPaper: ExamPaper = {
      id: 'P-1',
      title: '期末考/自然',
      description: '描述',
      subject: '自然',
      subjectId: 'science',
      status: 'published',
      difficultyLv: 1,
      totalScore: 100,
      durationMinutes: 60,
      createdAt: '2026-11-25 12:00:00',
      questionCount: 1,
    };

    await downloadCustomExamAsGoogleSheetExcel(mockPaper, [], 'custom_name.xlsx');

    expect(clickSpy).toHaveBeenCalled();
    expect(realLink.download).toBe('custom_name.xlsx');
  });

  it('downloads questions as Google Sheet aligned test_bank Excel', async () => {
    const realLink = document.createElement('a');
    const clickSpy = vi.spyOn(realLink, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(realLink);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-q'),
      revokeObjectURL: vi.fn(),
    });

    await downloadQuestionsAsGoogleSheetExcel([]);

    expect(clickSpy).toHaveBeenCalled();
    expect(realLink.download).toContain('自訂題目庫_test_bank_');
  });
});
