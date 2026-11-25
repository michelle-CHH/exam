'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import {
  ensurePersonalSpreadsheetTablesExist,
  createPersonalDatabaseSpreadsheet,
  searchPersonalSpreadsheetsInDrive,
  DriveSpreadsheetItem,
} from '@/services/userSheet';
import { getAccessToken, googleSignIn } from '@/services/googleAuth';

interface ProfileFormProps {
  profile: UserProfile | null;
  onSave?: (updated: Partial<UserProfile>) => void | Promise<void>;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onSave }) => {
  const [nickname, setNickname] = useState(profile?.nickname ?? profile?.name ?? '');
  const [sheetUrl, setSheetUrl] = useState(profile?.google_sheet_URL ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isVerifyingSheet, setIsVerifyingSheet] = useState(false);
  const [driveCandidates, setDriveCandidates] = useState<DriveSpreadsheetItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (profile) {
      queueMicrotask(() => {
        setNickname(profile.nickname ?? profile.name ?? '');
        setSheetUrl(profile.google_sheet_URL ?? '');
      });
    }
  }, [profile?.nickname, profile?.name, profile?.google_sheet_URL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await onSave?.({ nickname, google_sheet_URL: sheetUrl.trim() });
      setStatusMessage({ text: '✅ 個人設定與試算表綁定已成功儲存！', type: 'success' });
    } catch (err) {
      setStatusMessage({ text: `儲存失敗：${(err as Error).message || '未知錯誤'}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. 跳轉 Google 查詢雲端硬碟先前建立過的題庫試算表，找到後自動綁定
  const handleSearchDriveAndBind = async () => {
    setIsSearchingDrive(true);
    setStatusMessage(null);
    setDriveCandidates([]);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signRes = await googleSignIn();
        token = signRes?.accessToken || null;
      }
      if (!token) {
        throw new Error('需先完成 Google 登入授權，才能查詢您的雲端硬碟檔案');
      }

      const sheets = await searchPersonalSpreadsheetsInDrive(token);
      if (sheets.length === 0) {
        setStatusMessage({
          text: '在您的 Google 雲端硬碟中尚未找到試算表。可點擊右方「一鍵建立個人題庫」由系統為您自動建立！',
          type: 'info',
        });
        return;
      }

      // 優先尋找名稱包含「個人專屬題庫」或「題庫」的試算表
      const match = sheets.find((s) => s.isPersonalDatabase);
      if (match) {
        setSheetUrl(match.url);
        setStatusMessage({
          text: `🎉 已在您的 Google 雲端硬碟找到試算表「${match.name}」！正在自動為您完成綁定...`,
          type: 'success',
        });
        await onSave?.({ nickname, google_sheet_URL: match.url });
        setStatusMessage({
          text: `🎉 已成功找到並綁定專屬試算表「${match.name}」！`,
          type: 'success',
        });
      } else {
        // 若有多個未明確命名的試算表，列出前 5 個供使用者直接點擊選取
        setDriveCandidates(sheets.slice(0, 6));
        setStatusMessage({
          text: `在您的 Google 雲端硬碟找到 ${sheets.length} 份試算表，請在下方直接點擊您要綁定的表單：`,
          type: 'info',
        });
      }
    } catch (err) {
      setStatusMessage({
        text: `查詢 Google 雲端硬碟失敗：${(err as Error).message || '未知錯誤'}`,
        type: 'error',
      });
    } finally {
      setIsSearchingDrive(false);
    }
  };

  // 2. 一鍵在 Google Drive 建立全新標準題庫試算表並自動綁定
  const handleCreateAndBind = async () => {
    setIsCreatingSheet(true);
    setStatusMessage(null);
    setDriveCandidates([]);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signRes = await googleSignIn();
        token = signRes?.accessToken || null;
      }
      if (!token) {
        throw new Error('需先完成 Google 登入授權，才能在您的雲端硬碟建立試算表');
      }

      const defaultTitle = `${nickname || profile?.name || '個人'}專屬題庫 (Personal Test Bank)`;
      const res = await createPersonalDatabaseSpreadsheet(token, defaultTitle);

      setSheetUrl(res.spreadsheetUrl);
      setStatusMessage({
        text: `🎉 成功在 Google 雲端建立新試算表「${defaultTitle}」！正在自動完成綁定...`,
        type: 'success',
      });

      await onSave?.({ nickname, google_sheet_URL: res.spreadsheetUrl });
      setStatusMessage({
        text: `🎉 建立與綁定完成！已自動建立 4 張標準分頁（test_bank, quiz_bank_publish, quiz_bank_unpublish, log）並成功綁定。`,
        type: 'success',
      });
    } catch (err) {
      setStatusMessage({
        text: `建立失敗：${(err as Error).message || '未知錯誤'}`,
        type: 'error',
      });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // 3. 驗證現有試算表連線並自動補齊標準分頁
  const handleVerifyAndInitTables = async () => {
    if (!sheetUrl.trim()) {
      setStatusMessage({
        text: '請先輸入試算表網址，或點擊下方按鈕直接從 Google 雲端搜尋或建立',
        type: 'error',
      });
      return;
    }
    setIsVerifyingSheet(true);
    setStatusMessage(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const signRes = await googleSignIn();
        token = signRes?.accessToken || null;
      }
      if (!token) {
        throw new Error('需先完成 Google 登入授權，才能檢查與建立試算表分頁');
      }

      const res = await ensurePersonalSpreadsheetTablesExist(token, sheetUrl.trim());
      const msg = res.createdSheets.length > 0
        ? `🎉 成功為試算表建立標準分頁：${res.createdSheets.join(', ')}，並填入標準標題！`
        : `✅ 試算表驗證通過！已包含完整標準分頁（test_bank, quiz_bank_publish, quiz_bank_unpublish, log）。`;
      setStatusMessage({
        text: msg,
        type: 'success',
      });
    } catch (err) {
      setStatusMessage({
        text: `驗證或建立分頁失敗：${(err as Error).message || '未知錯誤'}`,
        type: 'error',
      });
    } finally {
      setIsVerifyingSheet(false);
    }
  };

  const handleSelectCandidate = async (candidate: DriveSpreadsheetItem) => {
    setSheetUrl(candidate.url);
    setDriveCandidates([]);
    setStatusMessage({
      text: `已選取「${candidate.name}」，正在自動儲存綁定...`,
      type: 'info',
    });
    try {
      await onSave?.({ nickname, google_sheet_URL: candidate.url });
      setStatusMessage({
        text: `🎉 已成功綁定試算表「${candidate.name}」！`,
        type: 'success',
      });
    } catch (err) {
      setStatusMessage({
        text: `儲存綁定失敗：${(err as Error).message || '未知錯誤'}`,
        type: 'error',
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-[#c3c6d7]/40 p-6 flex flex-col gap-5 shadow-2xs"
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

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
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
          placeholder="https://docs.google.com/spreadsheets/d/... (或點擊下方按鈕從 Google 雲端直接搜尋/建立)"
        />

        {/* 快捷操作按鈕群組：免手動輸入網址，直接跳轉 Google 查詢與建立 */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSearchDriveAndBind}
            disabled={isSearchingDrive || isCreatingSheet || isVerifyingSheet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#eef3ff] hover:bg-[#dbe6fe] text-[#004ac6] border border-[#b9d0fe] transition-colors cursor-pointer disabled:opacity-50"
            title="跳轉 Google 驗證並查詢雲端硬碟中先前建立過的專屬題庫試算表，找到後自動綁定"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSearchingDrive ? 'animate-spin' : ''}`}>
              {isSearchingDrive ? 'sync' : 'search_check'}
            </span>
            <span>{isSearchingDrive ? '正在查詢雲端硬碟...' : '🔍 從 Google 雲端尋找題庫表並自動綁定'}</span>
          </button>

          <button
            type="button"
            onClick={handleCreateAndBind}
            disabled={isSearchingDrive || isCreatingSheet || isVerifyingSheet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#004ac6] hover:bg-[#003da6] text-white transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="在您的 Google 雲端硬碟建立全新專屬題庫試算表，內建 4 張標準分頁並直接綁定"
          >
            <span className={`material-symbols-outlined text-[16px] ${isCreatingSheet ? 'animate-spin' : ''}`}>
              {isCreatingSheet ? 'sync' : 'add_circle'}
            </span>
            <span>{isCreatingSheet ? '正在建立個人題庫...' : '🛠️ 一鍵建立個人題庫'}</span>
          </button>

          {sheetUrl.trim() && (
            <button
              type="button"
              onClick={handleVerifyAndInitTables}
              disabled={isSearchingDrive || isCreatingSheet || isVerifyingSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#f2f4f6] hover:bg-[#e6e8ea] text-[#434655] border border-[#c3c6d7] transition-colors cursor-pointer disabled:opacity-50"
              title="檢查目前網址是否已具備標準分頁與標題，若無則自動補齊"
            >
              <span className={`material-symbols-outlined text-[16px] ${isVerifyingSheet ? 'animate-spin' : ''}`}>
                {isVerifyingSheet ? 'sync' : 'fact_check'}
              </span>
              <span>{isVerifyingSheet ? '檢查中...' : '檢查現有網址分頁'}</span>
            </button>
          )}
        </div>

        {/* 雲端硬碟多表候選清單 */}
        {driveCandidates.length > 0 && (
          <div className="mt-2 p-3 bg-[#f8f9fa] border border-[#c3c6d7]/60 rounded-xl flex flex-col gap-2">
            <p className="text-xs font-bold text-[#191c1d]">請選擇要綁定的 Google 試算表：</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {driveCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCandidate(c)}
                  className="flex items-center justify-between p-2 rounded-lg border border-[#c3c6d7]/40 bg-white hover:border-[#004ac6] hover:bg-[#eef3ff] text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">table_chart</span>
                    <span className="text-xs font-medium text-slate-800 truncate">{c.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#004ac6] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    點擊綁定
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 操作狀態提示 */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 animate-in fade-in duration-150 ${statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">
              {statusMessage.type === 'success' ? 'check_circle' : statusMessage.type === 'error' ? 'error' : 'info'}
            </span>
            <span className="leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        <p className="text-[11px] text-[#737686] mt-0.5">
          💡 點擊「從 Google 雲端尋找」或「一鍵建立」即可免去手動尋找與複製網址的繁瑣步驟；若手動貼上，請確保試算表具備編輯權限。
        </p>
      </div>

      <div className="flex justify-end pt-2 border-t border-[#c3c6d7]/20">
        <button
          type="submit"
          disabled={isSubmitting || isSearchingDrive || isCreatingSheet}
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


