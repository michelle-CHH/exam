'use client';

import React, { useState, useMemo } from 'react';
import { Question } from '@/types';

interface QuestionPickerListProps {
  questions: Question[];
  selectedIds: string[];
  onToggleQuestion: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  onPreview?: (question: Question) => void;
}

export const QuestionPickerList: React.FC<QuestionPickerListProps> = ({
  questions,
  selectedIds,
  onToggleQuestion,
  onToggleSelectAll,
  onPreview,
}) => {
  const [keyword, setKeyword] = useState('');

  const filteredQuestions = useMemo(() => {
    if (!keyword.trim()) return questions;
    const kw = keyword.toLowerCase().trim();
    return questions.filter(
      (q) =>
        q.content?.toLowerCase().includes(kw) ||
        q.id?.toLowerCase().includes(kw) ||
        q.tags?.some((t) => t.toLowerCase().includes(kw))
    );
  }, [questions, keyword]);

  const allFilteredSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => selectedIds.includes(q.id));

  const handleSelectAllToggle = () => {
    if (!onToggleSelectAll) return;
    const currentFilteredIds = filteredQuestions.map((q) => q.id);
    onToggleSelectAll(currentFilteredIds);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 篩選搜尋列與單頁/目前全選控制項 */}
      <div className="bg-white rounded-xl border border-[#c3c6d7]/40 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#737686]">
            search
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜尋題目題幹、知識點標籤或題目 ID..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#c3c6d7] text-xs text-[#191c1d] placeholder-[#737686] focus:border-[#004ac6] focus:ring-1 focus:ring-[#004ac6] outline-hidden bg-[#fbfbfe]"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737686] hover:text-[#191c1d] text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {onToggleSelectAll && filteredQuestions.length > 0 && (
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#434655] px-2 py-1 rounded hover:bg-[#f2f4f8] transition-colors">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={handleSelectAllToggle}
              className="rounded border-[#c3c6d7] text-[#004ac6] focus:ring-[#004ac6]"
            />
            <span>全選此篩選清單（共 {filteredQuestions.length} 題）</span>
          </label>
        )}
      </div>

      {/* 題目清單 */}
      <div className="bg-white rounded-xl border border-[#c3c6d7]/40 divide-y divide-[#c3c6d7]/30 shadow-xs">
        {filteredQuestions.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#737686]">
            {keyword ? '查無符合關鍵字「' + keyword + '」的題目' : '目前尚無可選題目'}
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const checked = selectedIds.includes(q.id);
            return (
              <div
                key={q.id}
                className="flex items-start gap-3 p-4 hover:bg-[#f8f9fa] transition-colors"
              >
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleQuestion(q.id)}
                    className="w-4 h-4 rounded border-[#c3c6d7] text-[#004ac6] focus:ring-[#004ac6] cursor-pointer"
                  />
                  {onPreview && (
                    <button
                      type="button"
                      onClick={() => onPreview(q)}
                      className="p-1 rounded-md text-[#737686] hover:text-[#004ac6] hover:bg-[#dbe1ff]/40 transition-colors cursor-pointer"
                      title="預覽題目詳情"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        visibility
                      </span>
                    </button>
                  )}
                </div>

                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onToggleQuestion(q.id)}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#434655]">
                    <span className="font-mono font-bold text-[#004ac6]">{q.id}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                      {q.type === 'single' ? '單選題' : q.type === 'multiple' ? '多選題' : '是非題'}
                    </span>
                    <span>配分: {q.points} 分</span>
                    <span>時長: {q.time ?? 5} 分鐘</span>
                    {q.tags && q.tags.length > 0 && (
                      <span className="text-[11px] text-[#737686]">
                        標籤: {q.tags.join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#191c1d] mt-1.5 leading-relaxed">{q.content}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
