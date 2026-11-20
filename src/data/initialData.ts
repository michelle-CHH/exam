import { Question, ExamPaper } from '@/types';

/**
 * 系統初始資料集（零硬編碼純動態架構）
 * 所有題庫、考卷與分類均動態自 Google Sheet 或已匯入之 Excel 讀取，不設本地假資料。
 */
export const INITIAL_QUESTIONS: Question[] = [];
export const INITIAL_EXAM_PAPERS: ExamPaper[] = [];
