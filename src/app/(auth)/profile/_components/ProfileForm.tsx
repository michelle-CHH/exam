'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types';

interface ProfileFormProps {
  profile: UserProfile | null;
  onSave?: (updated: Partial<UserProfile>) => void | Promise<void>;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onSave }) => {
  const [nickname, setNickname] = useState(profile?.nickname ?? profile?.name ?? '');
  const [sheetUrl, setSheetUrl] = useState(profile?.google_sheet_URL ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? profile.name ?? '');
      setSheetUrl(profile.google_sheet_URL ?? '');
    }
  }, [profile?.nickname, profile?.name, profile?.google_sheet_URL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave?.({ nickname, google_sheet_URL: sheetUrl.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-[#c3c6d7]/40 p-6 flex flex-col gap-4 shadow-2xs"
    >
      <div className="flex items-center justify-between border-b border-[#c3c6d7]/30 pb-3">
        <h2 className="text-base font-bold text-[#191c1d] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#004ac6] text-[20px]">manage_accounts</span>
          個人基本資料設定
        </h2>
        {profile?.google_sheet_URL ? (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            已綁定雲端試算表
          </span>
        ) : (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            尚未綁定試算表
          </span>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-[#434655] mb-1">
          使用者名稱 / 顯示名稱
        </label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-[#c3c6d7] rounded-lg bg-[#f8f9fa] focus:bg-white focus:border-[#004ac6] focus:outline-none transition-colors"
          placeholder="請輸入顯示名稱"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-[#434655]">
            私人題庫 Google Sheet URL (google_sheet_URL)
          </label>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#004ac6] hover:underline flex items-center gap-0.5 font-medium"
            >
              <span>在 Google 試算表開啟</span>
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
          )}
        </div>
        <input
          type="url"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm border border-[#c3c6d7] rounded-lg bg-[#f8f9fa] focus:bg-white focus:border-[#004ac6] focus:outline-none transition-colors font-mono"
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        <p className="text-[11px] text-[#737686] mt-1">
          💡 請確保該試算表已開啟「知道連結的使用者皆可編輯」權限。儲存後將同步寫入公用資料庫 <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">users</code> 表格。
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#004ac6] text-white hover:bg-[#003ea8] disabled:opacity-60 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
        >
          {isSubmitting ? (
            <>
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span>正在儲存並同步至雲端資料庫...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>儲存個人設定並同步雲端</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

