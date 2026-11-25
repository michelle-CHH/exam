import { describe, expect, it, vi } from 'vitest';
import { exportQuestionsToCsv, filterWrongQuestionsForExport } from './fileExport';
import type { Question, WrongQuestionRecord } from '@/types';

describe('fileExport - filterWrongQuestionsForExport', () => {
  const mockQuestions: Question[] = [
    {
      id: 'Q-01',
      subjectId: 'math',
      type: 'single',
      content: '題目 1',
      difficulty: 'easy',
      points: 2,
    },
    {
      id: 'Q-02',
      subjectId: 'physics',
      type: 'single',
      content: '題目 2',
      difficulty: 'medium',
      points: 3,
    },
    {
      id: 'Q-03',
      subjectId: 'chemistry',
      type: 'single',
      content: '題目 3',
      difficulty: 'hard',
      points: 5,
    },
  ];

  it('filters questions that appear in wrongRecords', () => {
    const wrongRecords: WrongQuestionRecord[] = [
      {
        questionId: 'Q-01',
        prompt: '題目 1',
        userAnswer: 'A',
        correctAnswer: 'B',
        explanation: '',
        status: '錯誤',
      },
      {
        questionId: 'Q-03',
        prompt: '題目 3',
        userAnswer: 'C',
        correctAnswer: 'D',
        explanation: '',
        status: '錯誤',
      },
    ];

    const result = filterWrongQuestionsForExport(mockQuestions, wrongRecords);
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.id)).toEqual(['Q-01', 'Q-03']);
  });

  it('returns empty array when wrongRecords has no matching questions', () => {
    const wrongRecords: WrongQuestionRecord[] = [
      {
        questionId: 'Q-99',
        prompt: '不存在題目',
        userAnswer: 'A',
        correctAnswer: 'B',
        explanation: '',
        status: '錯誤',
      },
    ];

    const result = filterWrongQuestionsForExport(mockQuestions, wrongRecords);
    expect(result).toEqual([]);
  });
});

describe('fileExport - exportQuestionsToCsv', () => {
  it('creates a download link with UTF-8 BOM CSV blob and triggers click', () => {
    const mockQuestions: Question[] = [
      {
        id: 'Q-01',
        subjectId: 'math',
        type: 'single',
        content: '若 a="1", b=2，何者正確？',
        options: ['A: 答案一', 'B: 答案二'],
        correctAnswer: 'A',
        explanation: '說明包含 "雙引號"',
        difficulty: 'easy',
        points: 2,
      },
    ];

    // Mock DOM and URL
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    const realLink = document.createElement('a');
    const clickMock = vi.spyOn(realLink, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(realLink);
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    exportQuestionsToCsv(mockQuestions, 'my_custom_export.csv');

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledWith(realLink);
    expect(removeSpy).toHaveBeenCalledWith(realLink);
    expect(realLink.getAttribute('download')).toBe('my_custom_export.csv');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses default filename if not provided', () => {
    const setAttributeMock = vi.fn();
    const clickMock = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:url'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      setAttribute: setAttributeMock,
      click: clickMock,
    } as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

    exportQuestionsToCsv([]);

    expect(setAttributeMock).toHaveBeenCalledWith('download', 'wrong_questions_export.csv');

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
