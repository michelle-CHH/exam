"use client";

import type { Answer, ExamQuestion } from "@/types/exam";

const TYPE_LABELS: Record<ExamQuestion["type"], string> = {
  single: "單選題",
  multiple: "多選題",
  boolean: "是非題",
};

interface Props {
  question: ExamQuestion;
  number: number;
  answer: Answer | undefined;
  flagged: boolean;
  onAnswer: (answer: Answer) => void;
  onToggleFlag: () => void;
}

export function QuestionDisplay({ question, number, answer, flagged, onAnswer, onToggleFlag }: Props) {
  const selected = Array.isArray(answer) ? answer : answer ? [answer] : [];
  const multiple = question.type === "multiple";

  function select(optionId: string) {
    if (!multiple) {
      if (selected.includes(optionId)) {
        onAnswer("");
      } else {
        onAnswer(optionId);
      }
      return;
    }
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    onAnswer(next);
  }

  return (
    <section
      id={`question-${question.id}`}
      data-index={number - 1}
      className="exam-card exam-question p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#d5dce4] pb-2">
        <span className="grid h-8 w-8 place-items-center bg-[#2f5597] text-sm font-bold text-white">
          {number}
        </span>
        <span className="exam-chip">{TYPE_LABELS[question.type]}</span>
        <span className="exam-chip">{question.points} 分</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAnswer(multiple ? [] : "")}
            disabled={selected.length === 0}
            className="exam-chip hover:bg-[#eef2f6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            清除選項
          </button>
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            className={`exam-chip ${flagged ? "exam-chip-flag" : ""}`}
          >
            {flagged ? "★ 已標註" : "☆ 標註"}
          </button>
        </div>
      </div>

      <p id={`question-${question.id}-prompt`} className="mb-3 text-[15px] leading-7">
        {question.prompt}
      </p>

      <div
        role="group"
        aria-labelledby={`question-${question.id}-prompt`}
        className={question.type === "boolean" ? "grid gap-2 sm:grid-cols-2" : "space-y-2"}
      >
        {question.options.map((option) => {
          const isSelected = selected.includes(option.id);
          const cleanText = option.text.replace(/^[A-Za-z0-9][\.\、\:\)\s]+\s*|^\([A-Za-z0-9]\)\s*/, '').trim();
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => select(option.id)}
              aria-pressed={isSelected}
              data-selected={isSelected}
              data-multiple={multiple}
              className="exam-option"
            >
              <span aria-hidden="true" className="exam-mark">
                {isSelected ? "✓" : ""}
              </span>
              <span className="font-bold text-[#5b6673]">{option.id}.</span>
              <span>{cleanText || option.text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export { QuestionDisplay as QuestionCard };
