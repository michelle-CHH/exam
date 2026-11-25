import { SubjectId } from '@/types/question';

export interface SubjectAnalysisItem {
  subjectId: SubjectId;
  subjectName: string;
  totalQuestions: number;
  correctCount: number;
  accuracyRate: number;
}

export interface WrongQuestionRecord {
  questionId: string;
  userAnswer: string[];
  correctAnswer: string[];
  subjectId: SubjectId;
  timestamp: string;
}
