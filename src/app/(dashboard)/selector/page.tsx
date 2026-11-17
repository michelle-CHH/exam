'use client';

import React, { useState, useMemo } from 'react';
import { Question, ExamPaper, UserProfile } from '@/types';
import { INITIAL_QUESTIONS } from '@/data/initialData';
import {
  SourceTab,
  QuestionSourceScope,
} from '@/app/(dashboard)/selector/_components/SourceTab';
import { QuestionPickerList } from '@/app/(dashboard)/selector/_components/QuestionPickerList';
import { AssemblySummaryBar } from '@/app/(dashboard)/selector/_components/AssemblySummaryBar';
import { SheetBindGuardModal } from '@/components/common/SheetBindGuardModal';
import { ExamGenerationModal } from '@/app/(dashboard)/exams/_components/ExamFormModal';
import { ensurePersonalSpreadsheetTablesExist, appendExamToUserSheet } from '@/services/userSheet';
import { getAccessToken, googleSignIn } from '@/services/googleAuth';

interface QuestionSelectorPageProps {
  questions?: Question[];
  personalQuestions?: Question[];
  currentUser?: UserProfile | null;
  onNavigate?: (page: string) => void;
  onOpenUploadExam?: () => void;
  onExamCreated?: (newExam: ExamPaper) => void;
}

export default function QuestionSelectorPage({
  questions: propQuestions,
  personalQuestions: propPersonalQuestions,
  currentUser,
  onNavigate,
  onOpenUploadExam,
  onExamCreated: onExamCreatedProp,
}: QuestionSelectorPageProps = {}) {
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
  const [isGuardModalOpen, setIsGuardModalOpen] = useState(!hasBoundSheet);
  const [isInitializingSheet, setIsInitializingSheet] = useState(false);
  const [initSheetMessage, setInitSheetMessage] = useState('');

  const handleInitPersonalSheet = async () => {
    if (!user?.google_sheet_URL) return;
    setIsInitializingSheet(true);
    setInitSheetMessage('');
    try {
      let token = await getAccessToken();
      if (!token) {
        const signRes = await googleSignIn();
        token = signRes?.accessToken || null;
      }
      if (!token) {
        throw new Error('需先完成 Google 登入授權，才能在您的試算表建立分頁。');
      }
      const res = await ensurePersonalSpreadsheetTablesExist(token, user.google_sheet_URL);
      const msg = res.createdSheets.length > 0
        ? `🎉 成功為試算表建立標準分頁：${res.createdSheets.join(', ')}，並填入公用格式標題！`
        : `✅ 試算表格式已符合規範（test_bank, quiz_bank_publish, quiz_bank_unpublish, log）！`;
      setInitSheetMessage(msg);
    } catch (err: any) {
      setInitSheetMessage(`建立失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setIsInitializingSheet(false);
    }
  };

  const [source, setSource] = useState<QuestionSourceScope>('public');
  // 優先取線上題庫 (Google Sheet)；若離線或線上無資料，才去讀取 data 內題庫 INITIAL_QUESTIONS
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const publicQuestions =
    propQuestions && propQuestions.length > 0
      ? propQuestions
      : !isOnline || !propQuestions || propQuestions.length === 0
        ? INITIAL_QUESTIONS
        : [];

  const personalQuestions = useMemo(() => {
    if (propPersonalQuestions !== undefined) {
      return propPersonalQuestions;
    }
    if (!hasBoundSheet && typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('quiz_custom_questions') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }, [propPersonalQuestions, hasBoundSheet]);

  const currentQuestions = source === 'public' ? publicQuestions : personalQuestions;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);

  const handleGoToPublicExams = () => {
    setIsGuardModalOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('exam_paper_tab', 'public');
    }
    if (onNavigate) {
      onNavigate('user-exam-select');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/exams/select';
    }
  };

  const handleGoToSettings = () => {
    setIsGuardModalOpen(false);
    if (onNavigate) {
      onNavigate('user-settings');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/profile';
    }
  };

  const handleSourceChange = (newSource: QuestionSourceScope) => {
    if (newSource === 'private') {
      if (!hasBoundSheet) {
        setIsGuardModalOpen(true);
        return;
      }
    }
    setSource(newSource);
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedQuestions = currentQuestions.filter((q) => selectedIds.includes(q.id));

  const handleConfirmAssemble = () => {
    if (!hasBoundSheet) {
      setIsGuardModalOpen(true);
      return;
    }

    if (selectedQuestions.length === 0) return;
    setIsExamModalOpen(true);
  };

  const handleExamCreated = async (newExam: ExamPaper) => {
    const personalExam: ExamPaper = {
      ...newExam,
      sourceScope: 'private',
    };

    // 1. 寫入本地 localStorage (支援離線與即時瀏覽)
    if (typeof window !== 'undefined') {
      try {
        const existing = JSON.parse(localStorage.getItem('quiz_custom_exams') || '[]');
        const updated = [personalExam, ...existing.filter((e: ExamPaper) => e.id !== personalExam.id)];
        localStorage.setItem('quiz_custom_exams', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save custom exam to localStorage:', err);
      }
    }

    // 2. 寫入個人 Google 試算表 (quiz_bank_publish 或 quiz_bank_unpublish)
    if (user?.google_sheet_URL) {
      try {
        let token = await getAccessToken();
        if (!token) {
          try {
            const signRes = await googleSignIn();
            token = signRes?.accessToken || null;
          } catch {
            // 使用者取消或在離線環境，若有 GAS 仍可嘗試寫入
          }
        }
        await appendExamToUserSheet(token, user.google_sheet_URL, personalExam);
      } catch (err) {
        console.error('Failed to sync custom exam to personal Google Sheet:', err);
      }
    }

    // 3. 通知上層元件並清空已選題目
    onExamCreatedProp?.(personalExam);
    setSelectedIds([]);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-5">
      {/* 防護彈窗：自組考卷需存放於個人 Google Sheet */}
      <SheetBindGuardModal
        isOpen={isGuardModalOpen}
        onClose={() => setIsGuardModalOpen(false)}
        onGoToPublicExams={handleGoToPublicExams}
        onGoToSettings={handleGoToSettings}
      />

      {!hasBoundSheet && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[24px]">warning</span>
            <div>
              <p className="text-sm font-bold text-amber-900">未綁定個人 Google Sheet</p>
              <p className="text-xs text-amber-700 mt-0.5">
                自組考卷需存放於個人 Google Sheet。若未綁定，自選考卷將無處存放。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleGoToPublicExams}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              直接選公用考卷
            </button>
            <button
              type="button"
              onClick={handleGoToSettings}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#004ac6] text-white hover:bg-[#003da6] transition-colors cursor-pointer shadow-xs"
            >
              前往綁定
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#191c1d]">題目選擇與組卷</h1>
          <p className="text-xs text-[#434655] mt-1">
            從公用或私人題庫挑選題目，快速組合成新考卷
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourceTab activeSource={source} onChange={handleSourceChange} />
          {onOpenUploadExam && (
            <button
              type="button"
              onClick={onOpenUploadExam}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#004ac6] text-white hover:bg-[#003ea8] shadow-xs cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>上傳題目</span>
            </button>
          )}
        </div>
      </div>

      <AssemblySummaryBar
        selectedQuestions={selectedQuestions}
        onClear={() => setSelectedIds([])}
        onConfirmAssemble={handleConfirmAssemble}
      />

      {source === 'private' && currentQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#c3c6d7] p-10 text-center flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-[48px] text-[#737686]">folder_open</span>
          <h3 className="text-base font-bold text-[#191c1d]">私人題庫目前尚無題目 (0 題)</h3>
          <p className="text-xs text-[#737686] max-w-md">
            您的個人試算表（test_bank）目前為空或尚未建立分頁。若您的試算表為全新空白表，可點擊下方按鈕進行授權並一鍵建立個人題庫。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleInitPersonalSheet}
              disabled={isInitializingSheet}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#004ac6] text-white hover:bg-[#003da6] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isInitializingSheet ? '正在建立個人題庫…' : '🛠️ 一鍵建立個人題庫'}
            </button>
            <button
              type="button"
              onClick={() => setSource('public')}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-[#004ac6] text-[#004ac6] hover:bg-[#eef3ff] transition-colors cursor-pointer"
            >
              切換至公用題庫選題
            </button>
            <button
              type="button"
              onClick={() => {
                if (onOpenUploadExam) {
                  onOpenUploadExam();
                } else if (onNavigate) {
                  onNavigate('user-selector');
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-[#c3c6d7] text-[#191c1d] hover:bg-[#f2f4f7] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>前往上傳題目</span>
            </button>
          </div>
          {initSheetMessage && (
            <p className={`text-xs mt-2 font-medium ${initSheetMessage.includes('成功') || initSheetMessage.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {initSheetMessage}
            </p>
          )}
        </div>
      ) : (
        <QuestionPickerList
          questions={currentQuestions}
          selectedIds={selectedIds}
          onToggleQuestion={handleToggle}
        />
      )}
      {/* 自組考卷生成彈窗 */}
      <ExamGenerationModal
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
        selectedQuestions={selectedQuestions}
        onExamCreated={handleExamCreated}
        targetLabel="個人專屬試算表"
        idPrefix="CUSTOM-"
      />
    </div>
  );
}
