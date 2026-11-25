import { Question } from '@/types/question';
import { ExamPaper } from '@/types/exam';
import { AuditLog, UserProfile, RoleItem } from '@/types/user';

export interface CategoryItem {
  id: number;
  categories_name: string;
  parent_id: number;
  level: number;
  sort_order: number;
}

interface SheetColumnDefinition {
  key: string;
  label: string;
  desc: string;
}

export interface SheetTableSchema {
  name: string;
  description: string;
  columns: SheetColumnDefinition[];
}

export interface ReadSpreadsheetResult {
  success: boolean;
  spreadsheetTitle: string;
  questions: Question[];
  publishedExams: ExamPaper[];
  draftExams: ExamPaper[];
  allExams: ExamPaper[];
  categories: CategoryItem[];
  users?: UserProfile[];
  roles?: RoleItem[];
  auditLogs: AuditLog[];
  stats: Record<string, number>;
  message: string;
}
