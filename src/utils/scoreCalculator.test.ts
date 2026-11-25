import { describe, expect, it } from "vitest";
import type { Exam } from "@/types/exam";
import type { Question } from '@/types';
import {
  calculateScore,
  countAnswered,
  countFlagged,
  getUnansweredNumbers,
  isAnswered,
} from "@/utils/scoreCalculator";

const exam: Exam = {
  id: "demo",
  title: "Demo",
  subtitle: "",
  durationSec: 600,
  questions: [
    { id: "q1", type: "single", prompt: "Q1", points: 2, options: [] },
    { id: "q2", type: "multiple", prompt: "Q2", points: 3, options: [] },
    { id: "q3", type: "boolean", prompt: "Q3", points: 1, options: [] },
  ],
};

describe("isAnswered", () => {
  it("treats undefined and empty values as unanswered", () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered("")).toBe(false);
    expect(isAnswered([])).toBe(false);
  });

  it("treats selected values as answered", () => {
    expect(isAnswered("A")).toBe(true);
    expect(isAnswered(["A", "C"])).toBe(true);
  });
});

describe("countAnswered", () => {
  it("counts answered questions", () => {
    expect(countAnswered(exam, { q1: "A", q2: ["B", "C"], q3: "" })).toBe(2);
  });

  it("returns zero for an empty answer map", () => {
    expect(countAnswered(exam, {})).toBe(0);
  });
});

describe("getUnansweredNumbers", () => {
  it("returns 1-based question numbers", () => {
    expect(getUnansweredNumbers(exam, { q1: "A", q3: "F" })).toEqual([2]);
  });
});

describe("countFlagged", () => {
  it("counts flags that belong to the exam", () => {
    expect(countFlagged(exam, ["q1", "unknown"])).toBe(1);
  });
});

describe('calculateScore (總分與各科能力分析計算)', () => {
  const mockQuestions: Question[] = [
    {
      id: 'q1',
      prompt: '單選題測試',
      options: [],
      correctAnswer: 'A',
      points: 20,
      subjectId: 'math',
    },
    {
      id: 'q2',
      prompt: '多選題測試（測試順序與空白大小寫容錯）',
      options: [],
      correctAnswer: 'A,C',
      points: 30,
      subjectId: 'math',
    },
    {
      id: 'q3',
      prompt: '答錯題目測試',
      options: [],
      correctAnswer: 'B',
      points: 25,
      subjectId: 'science',
    },
    {
      id: 'q4',
      prompt: '未作答題目測試',
      options: [],
      correctAnswer: 'D',
      points: 25,
      subjectId: 'science',
    },
  ];

  it('應正確計算總分、答對/答錯/未作答題數，以及各科得分率', () => {
    const userAnswers: Record<string, string[]> = {
      q1: ['A'],             // 答對 (+20分)
      q2: [' c ', 'a'],      // 多選答對（順序顛倒 + 小寫空白，應自動標準化後給 +30分）
      q3: ['A'],             // 答錯 (0分)
      // q4 故意不填，測試未作答分支 (!actual)
    };

    const result = calculateScore(mockQuestions, userAnswers);

    // 1. 驗證總分與題數統計
    expect(result.totalScore).toBe(100);
    expect(result.score).toBe(50);
    expect(result.correctCount).toBe(2);
    expect(result.wrongCount).toBe(1);
    expect(result.unansweredCount).toBe(1);

    // 2. 驗證各科分析 (SubjectAnalysisItem[])
    const mathAnalysis = result.analysis.find((a) => a.subjectId === 'math');
    expect(mathAnalysis).toEqual({
      subjectId: 'math',
      subjectName: 'math',
      totalQuestions: 2,
      correctCount: 2,
      accuracyRate: 100,
    });

    const scienceAnalysis = result.analysis.find((a) => a.subjectId === 'science');
    expect(scienceAnalysis).toEqual({
      subjectId: 'science',
      subjectName: 'science',
      totalQuestions: 2,
      correctCount: 0,
      accuracyRate: 0,
    });
  });

  it('當題目陣列為空時，應安全回傳 0 分與空分析陣列', () => {
    const result = calculateScore([], {});

    expect(result.score).toBe(0);
    expect(result.totalScore).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.wrongCount).toBe(0);
    expect(result.unansweredCount).toBe(0);
    expect(result.analysis).toEqual([]);
  });
});

