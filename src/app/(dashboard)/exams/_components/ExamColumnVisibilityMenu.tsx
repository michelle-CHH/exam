'use client';

import React from 'react';
import { ExamColumnVisibilityState } from '@/types';
import { ColumnVisibilityModal, ColumnDefinition } from '@/components/common/ColumnVisibilityModal';

interface ExamColumnVisibilityMenuProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ExamColumnVisibilityState;
  onChange: (columns: ExamColumnVisibilityState) => void;
}

const EXAM_COLUMN_DEFINITIONS: ColumnDefinition<keyof ExamColumnVisibilityState>[] = [
  { key: 'id', label: '試卷編號 ID' },
  { key: 'title', label: '試卷名稱' },
  { key: 'subject', label: '學科類別' },
  { key: 'difficulty', label: '難度 (Lv. 1-5)' },
  { key: 'questionCount', label: '題數' },
  { key: 'totalScore', label: '總分' },
  { key: 'duration', label: '時長' },
  { key: 'status', label: '狀態 (草稿/公用)' },
  { key: 'createdAt', label: '建立時間' },
  { key: 'actions', label: '操作欄' },
];

export const ExamColumnVisibilityMenu: React.FC<ExamColumnVisibilityMenuProps> = ({
  isOpen,
  onClose,
  columns,
  onChange,
}) => (
  <ColumnVisibilityModal<keyof ExamColumnVisibilityState>
    isOpen={isOpen}
    onClose={onClose}
    title="試卷表格欄位設定"
    columns={columns}
    columnDefinitions={EXAM_COLUMN_DEFINITIONS}
    onChange={(nextCols) => onChange(nextCols as ExamColumnVisibilityState)}
  />
);
