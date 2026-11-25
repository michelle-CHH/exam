'use client';

import React from 'react';
import { ColumnVisibilityState } from '@/types';
import { ColumnVisibilityModal, ColumnDefinition } from '@/components/common/ColumnVisibilityModal';

interface ColumnVisibilityMenuProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnVisibilityState;
  onChange: (columns: ColumnVisibilityState) => void;
}

const QUESTION_COLUMN_DEFINITIONS: ColumnDefinition<keyof ColumnVisibilityState>[] = [
  { key: 'id', label: '題目 ID' },
  { key: 'content', label: '題目內容摘要' },
  { key: 'difficulty', label: '難度等級' },
  { key: 'points', label: '預設配分' },
  { key: 'time', label: '建議作答時間' },
  { key: 'tags', label: '標籤分類' },
  { key: 'updatedAt', label: '最後更新時間' },
  { key: 'actions', label: '操作動作' },
];

export const ColumnVisibilityMenu: React.FC<ColumnVisibilityMenuProps> = ({
  isOpen,
  onClose,
  columns,
  onChange,
}) => (
  <ColumnVisibilityModal<keyof ColumnVisibilityState>
    isOpen={isOpen}
    onClose={onClose}
    title="題庫表格欄位設定"
    columns={columns}
    columnDefinitions={QUESTION_COLUMN_DEFINITIONS}
    onChange={(nextCols) => onChange(nextCols as ColumnVisibilityState)}
  />
);
