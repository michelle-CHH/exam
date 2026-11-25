'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile, Question, Exam, SubjectId, ExamPaper, DifficultyLevel } from '@/types';
import { ImportUploader } from '@/app/(dashboard)/wrong-questions/_components/ImportUploader';
import { RetestActionCard } from '@/app/(dashboard)/wrong-questions/_components/RetestActionCard';
import { ExamGenerationModal } from '@/app/(dashboard)/exams/_components/ExamFormModal';
import { parseWrongQuestionsExcel } from '@/utils/fileParsers';
import { fetchWrongQuestionsFromUserSheet } from '@/services/userSheet';
import { getAccessToken, googleSignIn } from '@/services/googleAuth';
import { formatSheetTimestamp } from '@/utils/formatters';
import { getOptionLetter } from '@/utils/sheetParser';
import { verifyUserSessionActive, getSubjectDisplayName } from '@/services/publicSheet';

export interface StoredWrongRecord {
  id: string;
  questionId: string;
  prompt: string;
  options: { id: string; text: string }[];
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  status: 'wrong' | 'unanswered';
  subject: string;
  subjectId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  submittedAt: number;
  submitTime?: string;
}

export function formatSubmittedAt(ts?: number | string): string {
  if (!ts) return '未記錄';
  const num = typeof ts === 'number' ? ts : Number(ts);
  if (!isNaN(num) && num > 0) {
    const d = new Date(num);
    return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
  }
  const parsed = Date.parse(String(ts));
  if (!isNaN(parsed)) {
    return new Date(parsed).toLocaleString();
  }
  return String(ts);
}

interface WrongQuestionsPageProps {
  currentUser?: UserProfile | null;
  onNavigate?: (page: string) => void;
  onStartExam?: (exam: Exam) => void;
}

export default function WrongQuestionsPage({
  currentUser,
  onNavigate,
  onStartExam,
}: WrongQuestionsPageProps = {}) {
  const router = useRouter();
  const [records, setRecords] = useState<StoredWrongRecord[]>([]);
  const [importMessage, setImportMessage] = useState<string>('');
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [isRetestModalOpen, setIsRetestModalOpen] = useState(false);

  // 篩選狀態
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unanswered'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  const user = currentUser ?? (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('exam_logged_in_user');
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  })();

  // 載入儲存的錯題紀錄
  useEffect(() => {
    if (typeof window === 'undefined') return;
    queueMicrotask(() => {
      try {
        const savedNew = localStorage.getItem('quiz_wrong_records_book');
        if (savedNew) {
          const loaded: StoredWrongRecord[] = JSON.parse(savedNew).map((r: Record<string, unknown>) => ({
            ...r,
            submittedAt: typeof r.submittedAt === 'number' && r.submittedAt > 0
              ? r.submittedAt
              : (Date.parse(String(r.submitTime || r.submittedAt)) || Date.now()),
          }));
          setRecords(loaded);
          return;
        }
        // 兼容舊格式
        const savedOld = localStorage.getItem('quiz_wrong_questions_book');
        if (savedOld) {
          const parsedOld: Question[] = JSON.parse(savedOld);
          const converted: StoredWrongRecord[] = parsedOld.map((q, idx) => {
            let opts: { id: string; text: string }[] = [];
            if (Array.isArray(q.options)) {
              opts = (q.options as (string | { id?: string; text?: string })[]).map((opt, i) => {
                const text = typeof opt === 'string' ? opt : (opt.text || '');
                const letter = getOptionLetter(i);
                return { id: letter, text: text.replace(/^[A-Za-z0-9][.、:\s]\s*/, '') };
              });
            }
            return {
              id: q.id || `Q-${idx + 1}`,
              questionId: q.id || `Q-${idx + 1}`,
              prompt: q.content || q.question || '',
              options: opts.length > 0 ? opts : [{ id: 'A', text: '選項 A' }, { id: 'B', text: '選項 B' }, { id: 'C', text: '選項 C' }, { id: 'D', text: '選項 D' }],
              userAnswer: '未作答',
              correctAnswer: q.correctAnswer || q.answer || 'A',
              explanation: q.explanation || '',
              status: 'wrong',
              subject: q.subject || getSubjectDisplayName(q.subjectId),
              subjectId: q.subjectId || '未分類',
              difficulty: (q.difficulty as DifficultyLevel) || 'medium',
              points: q.points || 5,
              submittedAt: Date.now(),
            };
          });
          setRecords(converted);
        }
      } catch { }
    });
  }, []);

  const saveRecords = (newRecords: StoredWrongRecord[]) => {
    setRecords(newRecords);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('quiz_wrong_records_book', JSON.stringify(newRecords));
        // 同步相容舊格式
        const asQuestions: Question[] = newRecords.map((r) => ({
          id: r.questionId,
          categoryId: 1,
          subjectId: r.subjectId as SubjectId,
          type: r.correctAnswer.includes(',') ? 'multiple' : 'single',
          content: r.prompt,
          options: r.options.map((o) => `${o.id}. ${o.text}`),
          correctAnswer: r.correctAnswer,
          points: r.points,
          difficulty: r.difficulty,
          explanation: r.explanation,
          tags: ['錯題本'],
          updatedAt: formatSheetTimestamp(),
        }));
        localStorage.setItem('quiz_wrong_questions_book', JSON.stringify(asQuestions));
      } catch { }
    }
  };

  // 1. 從 Excel 檔案匯入錯題
  const handleImportFile = async (file: File) => {
    try {
      setImportMessage(`正在解析檔案「${file.name}」...`);
      const { questions, wrongRecords } = await parseWrongQuestionsExcel(file);

      if (wrongRecords.length === 0 && questions.length === 0) {
        alert('檔案中未找到任何有效之錯題資料，請確認檔案格式是否正確。');
        setImportMessage('');
        return;
      }

      const qMap = new Map<string, Question>();
      questions.forEach((q) => qMap.set(q.id, q));

      const newItems: StoredWrongRecord[] = wrongRecords.map((wr, idx) => {
        const matchedQ = qMap.get(wr.questionId);
        let opts: { id: string; text: string }[] = [];
        if (matchedQ?.options) {
          opts = (matchedQ.options as (string | { id?: string; text?: string })[]).map((opt, i) => {
            const text = typeof opt === 'string' ? opt : (opt.text || '');
            const letter = getOptionLetter(i);
            return { id: letter, text: text.replace(/^[A-Za-z0-9][.、:\s]\s*/, '') };
          });
        }
        if (opts.length === 0) {
          opts = [
            { id: 'A', text: '選項 A' },
            { id: 'B', text: '選項 B' },
            { id: 'C', text: '選項 C' },
            { id: 'D', text: '選項 D' },
          ];
        }

        const isUnanswered = wr.userAnswer.includes('未作答') || wr.status.includes('未作答');
        const rawSub = matchedQ?.subjectId || '未分類';
        const subName = matchedQ?.category_name || getSubjectDisplayName(rawSub);

        const rawTime = wr.submittedAt;
        const parsedTime = typeof rawTime === 'number' && rawTime > 0 ? rawTime : Date.now();

        return {
          id: wr.questionId || `W-EXCEL-${idx + 1}`,
          questionId: wr.questionId || `W-EXCEL-${idx + 1}`,
          prompt: wr.prompt,
          options: opts,
          userAnswer: wr.userAnswer || '未作答',
          correctAnswer: wr.correctAnswer || matchedQ?.correctAnswer || 'A',
          explanation: wr.explanation || matchedQ?.explanation || '',
          status: isUnanswered ? 'unanswered' : 'wrong',
          subject: subName,
          subjectId: rawSub,
          difficulty: (matchedQ?.difficulty as DifficultyLevel) || 'medium',
          points: matchedQ?.points || 5,
          submittedAt: parsedTime,
        };
      });

      // 合併並去重
      const recordMap = new Map<string, StoredWrongRecord>();
      [...newItems, ...records].forEach((r) => recordMap.set(r.questionId, r));
      const merged = Array.from(recordMap.values());

      saveRecords(merged);
      setImportMessage(`✅ 成功匯入 ${newItems.length} 道錯題！已自動收錄至待複習清單中。`);
      alert(`🎉 成功匯入 ${newItems.length} 題錯題！\n您可於上方直接點擊「開始錯題重測」進行二次練習。`);
    } catch (err: unknown) {
      alert(`匯入錯題檔案失敗：${(err as Error)?.message || '未知錯誤'}`);
      setImportMessage('');
    }
  };

  // 2. 從 Google Sheets 匯入錯題
  const handleImportGoogleSheet = async () => {
    if (!user?.google_sheet_URL) {
      alert('尚未綁定個人 Google 試算表，請先前往個人設定進行綁定。');
      return;
    }

    if (user.identifier && user.current_session_id) {
      const sessionCheck = await verifyUserSessionActive(user.identifier, user.current_session_id);
      if (!sessionCheck.isValid) {
        alert('⚠️ 您的帳號已於其他裝置登入，無法同步讀取個人 Google 試算表。');
        setImportMessage('您的帳號已於其他裝置登入，同步已暫停。');
        return;
      }
    }

    setIsLoadingSheet(true);
    setImportMessage('正在連線個人 Google 試算表讀取 Review notebook 分頁…');
    try {
      let token = await getAccessToken();
      if (!token) {
        try {
          const signRes = await googleSignIn();
          token = signRes?.accessToken || null;
        } catch { }
      }

      const { records: sheetRecords } = await fetchWrongQuestionsFromUserSheet(
        token,
        user.google_sheet_URL
      );

      if (sheetRecords.length === 0) {
        alert('在您的個人 Google 試算表（Review notebook）中未找到任何錯題資料。請確認先前是否有將測驗錯題匯出至試算表！');
        setImportMessage('未找到雲端錯題紀錄。');
        return;
      }

      const newItems: StoredWrongRecord[] = sheetRecords.map((sr) => {
        const rawTime = sr.submitTime;
        const parsedTime = rawTime
          ? (!isNaN(Number(rawTime)) && Number(rawTime) > 0 ? Number(rawTime) : Date.parse(rawTime) || Date.now())
          : Date.now();

        return {
          id: sr.questionId,
          questionId: sr.questionId,
          prompt: sr.prompt,
          options: sr.options,
          userAnswer: sr.actual.join(', ') || '未作答',
          correctAnswer: sr.expected.join(','),
          explanation: sr.explanation,
          status: sr.status,
          subject: sr.subject,
          subjectId:
            sr.subject.includes('國') ? 'chinese' :
              sr.subject.includes('英') ? 'english' :
                sr.subject.includes('數') ? 'math' : sr.subject || '未分類',
          difficulty:
            sr.difficulty.includes('難') ? 'hard' :
              sr.difficulty.includes('易') || sr.difficulty.includes('簡') ? 'easy' : 'medium',
          points: 5,
          submittedAt: parsedTime,
          submitTime: sr.submitTime,
        };
      });

      const recordMap = new Map<string, StoredWrongRecord>();
      [...newItems, ...records].forEach((r) => recordMap.set(r.questionId, r));
      const merged = Array.from(recordMap.values());

      saveRecords(merged);
      setImportMessage(`🎉 成功從個人 Google 試算表同步匯入 ${sheetRecords.length} 道錯題！`);
      alert(`🎉 成功從雲端試算表匯入 ${sheetRecords.length} 道錯題！已自動為您收錄。`);
    } catch (err: unknown) {
      alert(`從 Google 試算表匯入錯題失敗：${(err as Error)?.message || '未知錯誤'}`);
      setImportMessage(`匯入失敗：${(err as Error)?.message || '未知錯誤'}`);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const retestQuestions: Question[] = useMemo(() => {
    return records.map((r, idx) => ({
      id: r.questionId || `retest-q-${idx + 1}`,
      content: r.prompt,
      subjectId: (r.subjectId || 'other') as SubjectId,
      difficulty: r.difficulty,
      difficultyScore: r.difficulty === 'hard' ? 4 : r.difficulty === 'easy' ? 2 : 3,
      points: r.points || 5,
      type: (r.correctAnswer.includes(',') ? 'multiple' : 'single') as 'multiple' | 'single',
      options: r.options.map((o) => `${o.id}. ${o.text}`),
      correctAnswer: r.correctAnswer,
      explanation: r.explanation,
      tags: ['錯題重測'],
      updatedAt: formatSheetTimestamp(),
    }));
  }, [records]);

  // 3. 錯題就地重測（配合試卷生成彈窗，下方的按鈕只有取消跟開始考試兩項）
  const handleStartRetest = () => {
    if (records.length === 0) {
      alert('目前錯題本中尚無試題，請先上傳成果匯出的錯題 Excel 檔或從 Google Sheets 匯入！');
      return;
    }
    setIsRetestModalOpen(true);
  };

  const handleConfirmRetestExam = (newPaper: ExamPaper) => {
    const retestExam: Exam = {
      id: newPaper.id,
      title: newPaper.title,
      subtitle: newPaper.description || `由錯題本自動生成之弱點專屬測驗`,
      durationSec: (newPaper.durationMinutes || 10) * 60,
      questions: records.map((r, idx) => ({
        id: r.questionId || `retest-q-${idx + 1}`,
        test_id: r.questionId,
        type: (r.correctAnswer.includes(',') ? 'multiple' : 'single') as 'single' | 'multiple' | 'boolean',
        prompt: r.prompt,
        options: r.options && r.options.length > 0
          ? r.options
          : [
            { id: 'A', text: '選項 A' },
            { id: 'B', text: '選項 B' },
            { id: 'C', text: '選項 C' },
            { id: 'D', text: '選項 D' },
          ],
        points: r.points || 5,
        answer: r.correctAnswer,
        explanation: r.explanation,
        subjectId: (r.subjectId || 'other') as SubjectId,
        difficulty: r.difficulty,
      })),
    };

    if (onStartExam) {
      onStartExam(retestExam);
    } else {
      try {
        const existingExams = JSON.parse(localStorage.getItem('quiz_custom_exams') || '[]');
        localStorage.setItem('quiz_custom_exams', JSON.stringify([retestExam, ...existingExams]));
      } catch { }
      router.push(`/exam/${retestExam.id}`);
    }
  };

  const handleClearWrongBook = () => {
    if (window.confirm('確定要清空目前收錄的錯題本嗎？此操作將清除所有已收錄的錯題。')) {
      saveRecords([]);
      setImportMessage('已清空錯題本。');
    }
  };

  // 統計分析計算
  const subjectStats = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      map.set(r.subject, (map.get(r.subject) || 0) + 1);
    });
    return Array.from(map.entries()).map(([subject, wrongCount]) => ({ subject, wrongCount }));
  }, [records]);

  const difficultyStats = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const label = r.difficulty === 'hard' ? '困難' : r.difficulty === 'easy' ? '簡單' : '中等';
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).map(([diff, count]) => ({ diff, count }));
  }, [records]);

  // 篩選後呈現清單
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filter === 'wrong' && r.status !== 'wrong') return false;
      if (filter === 'unanswered' && r.status !== 'unanswered') return false;
      if (selectedSubject !== 'all' && r.subject !== selectedSubject) return false;
      if (selectedDifficulty !== 'all') {
        const label = r.difficulty === 'hard' ? '困難' : r.difficulty === 'easy' ? '簡單' : '中等';
        if (label !== selectedDifficulty) return false;
      }
      return true;
    });
  }, [records, filter, selectedSubject, selectedDifficulty]);

  const subjects = useMemo(() => Array.from(new Set(records.map((r) => r.subject))), [records]);
  const difficulties = ['簡單', '中等', '困難'];

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold text-[#191c1d]">錯題本與弱點分析</h1>
        <p className="text-xs text-[#434655] mt-1">
          支援匯入測驗成果匯出之「錯題檢討 Excel (.xlsx)」或直接自 Google 試算表同步，錯題本即為專屬考卷庫，可就地一鍵重測。
        </p>
      </div>

      {importMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium flex items-center justify-between animate-in fade-in">
          <span>{importMessage}</span>
          <button
            onClick={() => setImportMessage('')}
            className="text-blue-500 hover:text-blue-700 font-bold ml-2 cursor-pointer"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* 錯題重測卡片 */}
      <RetestActionCard
        wrongQuestionCount={records.length}
        onStartRetest={handleStartRetest}
      />

      {/* 匯入上傳卡片 (Excel / Google Sheets) */}
      <ImportUploader
        currentUser={currentUser}
        onNavigate={onNavigate}
        onImportFile={handleImportFile}
        onImportGoogleSheet={handleImportGoogleSheet}
        isLoadingSheet={isLoadingSheet}
      />

      {/* 錯題統計分析圖表 */}
      {records.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004ac6] text-[18px]">bar_chart</span>
              <span>各科錯題弱點分佈</span>
            </h3>
            <div className="flex flex-col gap-2.5">
              {subjectStats.map((item) => {
                const pct = Math.round((item.wrongCount / records.length) * 100);
                return (
                  <div key={item.subject} className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-medium text-slate-700">
                      <span>{item.subject}</span>
                      <span>{item.wrongCount} 題 ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#004ac6] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">trending_up</span>
              <span>難度錯題分佈</span>
            </h3>
            <div className="flex flex-col gap-2.5">
              {difficultyStats.map((item) => {
                const pct = Math.round((item.count / records.length) * 100);
                return (
                  <div key={item.diff} className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-medium text-slate-700">
                      <span>{item.diff}</span>
                      <span>{item.count} 題 ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.diff === '困難' ? 'bg-rose-500' : item.diff === '簡單' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 錯題篩選列與逐題詳解清單（完全比照 ResultReport 之逐題檢討） */}
      {records.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${filter === 'all'
                    ? 'bg-[#004ac6] text-white shadow-xs'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  全部錯題（{records.length}）
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('wrong')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${filter === 'wrong'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  只看答錯（{records.filter((r) => r.status === 'wrong').length}）
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unanswered')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${filter === 'unanswered'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  未作答（{records.filter((r) => r.status === 'unanswered').length}）
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearWrongBook}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                清空錯題本
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5">
                <span>學科：</span>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                >
                  <option value="all">全部學科</option>
                  {subjects.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5">
                <span>難度：</span>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="rounded-lg border border-slate-300 p-1.5 text-xs bg-white"
                >
                  <option value="all">全部難度</option>
                  {difficulties.map((diff) => (
                    <option key={diff} value={diff}>{diff}</option>
                  ))}
                </select>
              </label>

              {(filter !== 'all' || selectedSubject !== 'all' || selectedDifficulty !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSelectedSubject('all');
                    setSelectedDifficulty('all');
                  }}
                  className="text-[#004ac6] hover:underline font-semibold"
                >
                  清除所有篩選
                </button>
              )}

              <span className="text-slate-400 ml-auto">顯示 {filteredRecords.length} / {records.length} 題</span>
            </div>
          </div>

          {/* 逐題詳解卡片清單（完全對齊 QuestionReviewList） */}
          <div className="space-y-4">
            {filteredRecords.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                此篩選條件下沒有錯題紀錄，請試試其他條件。
              </div>
            ) : (
              filteredRecords.map((item, idx) => {
                const expectedLetters = item.correctAnswer.split(/[,、\s]+/).filter(Boolean).map((t) => t.toUpperCase());
                const userLetters = item.userAnswer.split(/[,、\s]+/).filter(Boolean).map((t) => t.toUpperCase());

                return (
                  <article
                    key={item.id || idx}
                    className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs flex flex-col gap-3.5 transition-all"
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">
                          第 {idx + 1} 題
                          <span className="text-xs font-normal text-slate-500 ml-1.5">
                            ／ {item.points} 分
                          </span>
                        </h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {item.subject}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.difficulty === 'hard'
                            ? 'bg-rose-50 text-rose-700'
                            : item.difficulty === 'easy'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                            }`}
                        >
                          {item.difficulty === 'hard' ? '困難' : item.difficulty === 'easy' ? '簡單' : '中等'}
                        </span>
                        {item.submittedAt ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            交卷時間：{formatSubmittedAt(item.submittedAt)}
                          </span>
                        ) : null}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'unanswered'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {item.status === 'unanswered' ? '未作答' : '答錯'}
                      </span>
                    </div>

                    {/* Prompt */}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 font-medium pt-1">
                      {item.prompt}
                    </p>

                    {/* Options Grid (比照 ResultReport 之紅綠標記) */}
                    <ul className="grid gap-2 sm:grid-cols-2 pt-1">
                      {item.options.map((option) => {
                        const optKey = option.id.toUpperCase();
                        const isExpected = expectedLetters.includes(optKey);
                        const isActual = userLetters.includes(optKey);

                        let cardClass = 'border-slate-200 bg-white text-slate-700';
                        if (isExpected) {
                          cardClass = 'border-emerald-300 bg-emerald-50/80 text-emerald-900 font-medium';
                        } else if (isActual) {
                          cardClass = 'border-rose-300 bg-rose-50/80 text-rose-900 font-medium';
                        }

                        return (
                          <li
                            key={option.id}
                            className={`rounded-xl border p-3 text-xs leading-relaxed flex items-start justify-between gap-2 transition-colors ${cardClass}`}
                          >
                            <div>
                              <span className="font-bold mr-1">{option.id}.</span>
                              <span>{option.text}</span>
                            </div>

                            <div className="shrink-0 flex items-center gap-1">
                              {isExpected && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/70 text-emerald-800">
                                  正確答案
                                </span>
                              )}
                              {isActual && !isExpected && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-200/70 text-rose-800">
                                  你的選擇
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Answer Comparison */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-700 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                      <p>
                        你的答案：
                        <strong className={item.userAnswer === '未作答' ? 'text-amber-600' : 'text-rose-600'}>
                          {item.userAnswer}
                        </strong>
                      </p>
                      <p>
                        正確答案：
                        <strong className="text-emerald-700">
                          {item.correctAnswer}
                        </strong>
                      </p>
                      {item.submitTime && (
                        <p className="text-slate-400 ml-auto">
                          測驗時間：{item.submitTime}
                        </p>
                      )}
                    </div>

                    {/* Explanation */}
                    {item.explanation && (
                      <div className="rounded-xl bg-[#f8f9fa] border border-[#c3c6d7]/30 p-3.5 text-xs text-slate-700 leading-relaxed">
                        <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px] text-[#004ac6]">help</span>
                          <span>詳解說明</span>
                        </h4>
                        <p className="whitespace-pre-wrap text-slate-600">{item.explanation}</p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
      {/* 錯題重測試卷生成設定彈窗 (mode="retest": 下方僅有取消與開始考試) */}
      <ExamGenerationModal
        isOpen={isRetestModalOpen}
        onClose={() => setIsRetestModalOpen(false)}
        selectedQuestions={retestQuestions}
        onExamCreated={handleConfirmRetestExam}
        idPrefix="RETEST-"
        mode="retest"
      />
    </div>
  );
}
