'use client';

import React from 'react';

export interface SortArrowProps {
  isCurrent: boolean;
  sortOrder?: 'asc' | 'desc';
}

export const SortArrow: React.FC<SortArrowProps> = ({ isCurrent, sortOrder }) => {
  const isAsc = isCurrent && sortOrder === 'asc';
  const isDesc = isCurrent && sortOrder === 'desc';

  return (
    <span className="inline-flex flex-col -space-y-1 text-[#434655]/50 group-hover:text-[#004ac6] transition-colors ml-0.5">
      <span
        className={`material-symbols-outlined text-[12px] leading-none transition-colors ${
          isAsc ? 'text-[#004ac6] font-bold' : isCurrent ? 'text-[#c3c6d7] opacity-30' : ''
        }`}
      >
        arrow_drop_up
      </span>
      <span
        className={`material-symbols-outlined text-[12px] leading-none transition-colors ${
          isDesc ? 'text-[#004ac6] font-bold' : isCurrent ? 'text-[#c3c6d7] opacity-30' : ''
        }`}
      >
        arrow_drop_down
      </span>
    </span>
  );
};
