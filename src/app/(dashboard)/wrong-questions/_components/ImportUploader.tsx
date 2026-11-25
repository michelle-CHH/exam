'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/types';

interface ImportUploaderProps {
  currentUser?: UserProfile | null;
  onImportFile?: (file: File) => void;
  onImportGoogleSheet?: () => void | Promise<void>;
  isLoadingSheet?: boolean;
  onNavigate?: (page: string) => void;
}

export const ImportUploader: React.FC<ImportUploaderProps> = ({
  currentUser,
  onImportFile,
  onImportGoogleSheet,
  isLoadingSheet = false,
  onNavigate,
}) => {
  const router = useRouter();
  const [syncStatus] = useState<string>('');

  const user = currentUser ?? (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('exam_logged_in_user');
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  })();

  const hasBoundSheet = Boolean(user?.google_sheet_URL && user.google_sheet_URL.trim() !== '');

  const handleGoogleSheetImportClick = async () => {
    if (!hasBoundSheet) {
      if (
        window.confirm(
          '未綁定個人 Google Sheet，無法從雲端試算表匯入錯題。\n系統目前僅提供 Excel (.xlsx) 上傳方式。\n\n是否立即前往設定頁面進行綁定？'
        )
      ) {
        if (onNavigate) {
          onNavigate('user-settings');
        } else {
          router.push('/profile');
        }
      }
      return;
    }

    if (onImportGoogleSheet) {
      await onImportGoogleSheet();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#c3c6d7]/40 p-6 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-[#191c1d]">匯入歷史測驗紀錄 / 錯題本</h3>
        <p className="text-xs text-[#737686] mt-1">
          上傳或同步測驗結果檔案，以彙整歷次易錯知識點並進行弱點分析。
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* 途徑 1：Excel (.xlsx) 上傳 - 隨時提供 */}
        <div className="rounded-xl border border-[#c3c6d7]/50 p-4 bg-slate-50 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined text-green-700 text-[20px]">description</span>
              <h4 className="text-sm font-bold text-[#191c1d]">Excel (.xlsx) 檔案上傳</h4>
            </div>
            <p className="text-xs text-[#565e74] leading-relaxed">
              支援上傳由測驗結果匯出的錯題紀錄 Excel 檔，隨選即傳、離線可用。
            </p>
          </div>
          <div className="mt-4">
            <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold bg-[#004ac6] text-white hover:bg-[#003da6] transition-colors cursor-pointer shadow-xs w-full sm:w-auto">
              上傳 Excel (.xlsx)
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile?.(f);
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 途徑 2：Google Sheets 匯入 - 需綁定 Google Sheet */}
        <div
          className={`rounded-xl border p-4 flex flex-col justify-between transition-colors ${
            hasBoundSheet
              ? 'border-[#c3c6d7]/50 bg-slate-50'
              : 'border-dashed border-slate-300 bg-slate-100/60'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`material-symbols-outlined text-[20px] ${hasBoundSheet ? 'text-blue-700' : 'text-slate-400'}`}>
                table_chart
              </span>
              <h4 className="text-sm font-bold text-[#191c1d]">Google Sheets 雲端匯入</h4>
              {!hasBoundSheet && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                  未綁定
                </span>
              )}
            </div>
            <p className="text-xs text-[#565e74] leading-relaxed">
              {hasBoundSheet
                ? '直接從您已綁定的個人 Google Sheet 同步錯題與作答履歷。'
                : '未綁定個人 Google Sheet，系統不提供此上傳方式（僅提供 Excel 上傳）。'}
            </p>
          </div>
          <div className="mt-4">
            {hasBoundSheet ? (
              <button
                type="button"
                onClick={handleGoogleSheetImportClick}
                disabled={isLoadingSheet}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-[#004ac6] text-[#004ac6] bg-white hover:bg-blue-50 transition-colors cursor-pointer w-full sm:w-auto flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isLoadingSheet && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                )}
                <span>{isLoadingSheet ? '正在從雲端試算表讀取錯題…' : '從 Google Sheets 匯入錯題'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSheetImportClick}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-400 bg-slate-200/50 hover:bg-slate-200 cursor-not-allowed w-full sm:w-auto"
                title="未綁定 Google Sheets，不提供此匯入方式"
              >
                未提供（未綁定試算表）
              </button>
            )}
          </div>
        </div>
      </div>

      {syncStatus && (
        <p className="text-xs text-primary font-medium mt-1">{syncStatus}</p>
      )}
    </div>
  );
};
