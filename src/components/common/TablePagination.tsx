'use client';

import React from 'react';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  jumpToPageInput?: string;
  onJumpToPageInputChange?: (val: string) => void;
  onJumpToPageSubmit?: () => void;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  jumpToPageInput,
  onJumpToPageInputChange,
  onJumpToPageSubmit,
}) => {
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1));

  return (
    <div className="flex items-center gap-1 mt-2 sm:mt-0">
      <button
        onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
        disabled={safeCurrentPage === 1}
        className="p-1 rounded hover:bg-[#eceef0] text-[#434655] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        type="button"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-8 h-8 rounded font-mono text-[12px] font-medium cursor-pointer transition-colors ${
            safeCurrentPage === page ? 'bg-[#004ac6] text-white' : 'hover:bg-[#eceef0] text-[#191c1e]'
          }`}
          type="button"
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
        disabled={safeCurrentPage >= totalPages}
        className="p-1 rounded hover:bg-[#eceef0] text-[#191c1e] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        type="button"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>

      {totalPages > 1 && onJumpToPageInputChange && onJumpToPageSubmit && (
        <div className="flex items-center gap-1 ml-2 text-[#434655] text-[13px]">
          <span>跳至</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpToPageInput ?? ''}
            onChange={(e) => onJumpToPageInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onJumpToPageSubmit();
              }
            }}
            placeholder={String(safeCurrentPage)}
            className="w-12 px-1.5 py-0.5 text-center text-[12px] border border-[#c3c6d7] rounded bg-white text-[#191c1e] focus:outline-hidden focus:border-[#004ac6]"
          />
          <span>頁</span>
          <button
            type="button"
            onClick={onJumpToPageSubmit}
            className="px-2 py-0.5 text-[12px] bg-[#004ac6] text-white rounded hover:bg-[#2563eb] transition-colors cursor-pointer"
          >
            前往
          </button>
        </div>
      )}
    </div>
  );
};
