"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { formatTime } from "@/utils/formatters";
import type { Exam } from "@/types/exam";
import { clearSession } from "@/contexts/examStorage";

interface Props {
  exam: Exam;
  remainingSec: number;
  answered: number;
  total: number;
  running: boolean;
  current?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onPause: () => void;
  onSubmit: () => void;
}

export function ExamHeader({
  exam,
  remainingSec,
  answered,
  total,
  running,
  current = 0,
  onPrev,
  onNext,
  onPause,
  onSubmit,
}: Props) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);
  const danger = remainingSec <= 60;

  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (!window.confirm("確定要返回首頁嗎？離開後作答進度、標註與計時都將會重置。")) {
      event.preventDefault();
      return;
    }
    clearSession(exam.id);
    if (typeof window !== "undefined") {
      event.preventDefault();
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  return (
    <header className="exam-topbar sticky top-0 z-30">
      <div className="exam-shell">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-bold">{exam.title}</h1>
            <p className="text-[11px] text-slate-300">{exam.subtitle}</p>
          </div>

          <div className="hidden max-w-md flex-1 md:flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-slate-200">
                <span>作答進度</span>
                <span>{answered} / {total} 題</span>
              </div>
              <div className="exam-progress-track mt-1">
                <div className="exam-progress-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>
            {onPrev && onNext && (
              <div className="flex items-center gap-1.5 pt-3">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={current <= 0}
                  className="exam-btn exam-btn-onnavy py-1 px-2.5 text-xs font-semibold disabled:opacity-40"
                >
                  上一題
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={current >= total - 1}
                  className="exam-btn exam-btn-onnavy py-1 px-2.5 text-xs font-semibold disabled:opacity-40"
                >
                  下一題
                </button>
              </div>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link href="/" onClick={handleBack} className="exam-btn exam-btn-onnavy">
              返回
            </Link>
            <div className={`text-[22px] font-bold tabular-nums ${danger ? "timer-danger" : ""}`}>
              {formatTime(remainingSec)}
            </div>
            <button type="button" onClick={onPause} disabled={!running} className="exam-btn exam-btn-onnavy">
              暫停
            </button>
            <button type="button" onClick={onSubmit} disabled={!running} className="exam-btn exam-btn-primary">
              交卷
            </button>
          </div>
        </div>

        <div className="pb-2 md:hidden">
          <div className="flex justify-between items-center text-[11px] text-slate-200">
            <span>作答進度 ({answered} / {total} 題)</span>
            {onPrev && onNext && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={current <= 0}
                  className="exam-btn exam-btn-onnavy py-0.5 px-2 text-[11px] disabled:opacity-40"
                >
                  上一題
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={current >= total - 1}
                  className="exam-btn exam-btn-onnavy py-0.5 px-2 text-[11px] disabled:opacity-40"
                >
                  下一題
                </button>
              </div>
            )}
          </div>
          <div className="exam-progress-track mt-1">
            <div className="exam-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    </header>
  );
}
