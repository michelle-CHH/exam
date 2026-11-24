'use client';

import React, { useState, useEffect } from 'react';
import { normalizeGoogleDriveImageUrl } from '@/utils/imageUrl';

interface QuestionPromptProps {
  prompt: string;
  imageUrl?: string;
  id?: string;
  className?: string;
}

interface ImagePart {
  type: 'image';
  alt: string;
  src: string;
}

interface TextPart {
  type: 'text';
  content: string;
}

type PromptPart = ImagePart | TextPart;

export const QuestionPrompt: React.FC<QuestionPromptProps> = ({
  prompt,
  imageUrl,
  id,
  className = 'text-[15px] leading-7',
}) => {
  const [activeLightboxImg, setActiveLightboxImg] = useState<{ src: string; alt: string } | null>(null);

  // 關閉燈箱鍵盤事件監聽 (Escape)
  useEffect(() => {
    if (!activeLightboxImg) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLightboxImg(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxImg]);

  // 解析 Prompt 中的 Markdown 圖片語法：![alt](url)
  const parts: PromptPart[] = [];
  const mdImgRegex = /!\[(.*?)\]\((.*?)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mdImgRegex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: prompt.substring(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'image',
      alt: match[1] || '題目附圖',
      src: normalizeGoogleDriveImageUrl(match[2]),
    });
    lastIndex = mdImgRegex.lastIndex;
  }

  if (lastIndex < prompt.length) {
    parts.push({
      type: 'text',
      content: prompt.substring(lastIndex),
    });
  }

  // 獨立的 imageUrl（若題幹未以 Markdown 包含此圖片，則追加在題幹下方）
  const normalizedExtraImageUrl = normalizeGoogleDriveImageUrl(imageUrl);
  const isExtraImageAlreadyInPrompt =
    normalizedExtraImageUrl &&
    parts.some((p) => p.type === 'image' && p.src === normalizedExtraImageUrl);

  return (
    <div id={id} className={`space-y-3 ${className}`}>
      {parts.length > 0 ? (
        parts.map((part, idx) => {
          if (part.type === 'text') {
            return (
              <span key={idx} className="whitespace-pre-wrap">
                {part.content}
              </span>
            );
          }
          return (
            <figure key={idx} className="my-2.5 inline-block max-w-full">
              <div
                onClick={() => setActiveLightboxImg({ src: part.src, alt: part.alt })}
                className="group relative cursor-zoom-in overflow-hidden rounded-lg border border-[#c3c6d7] bg-[#f8f9fa] shadow-2xs transition-transform hover:scale-[1.01]"
                title="點擊放大圖片"
              >
                <img
                  src={part.src}
                  alt={part.alt}
                  className="max-h-[360px] w-auto max-w-full object-contain"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white shadow">
                    <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                    放大檢視
                  </span>
                </div>
              </div>
              {part.alt && part.alt !== '題目附圖' && (
                <figcaption className="mt-1 text-center text-xs text-[#5c647a]">
                  {part.alt}
                </figcaption>
              )}
            </figure>
          );
        })
      ) : (
        <span className="whitespace-pre-wrap">{prompt}</span>
      )}

      {/* 獨立附圖呈現 */}
      {normalizedExtraImageUrl && !isExtraImageAlreadyInPrompt && (
        <figure className="mt-3 block max-w-full">
          <div
            onClick={() =>
              setActiveLightboxImg({ src: normalizedExtraImageUrl, alt: '題目附圖' })
            }
            className="group relative inline-block cursor-zoom-in overflow-hidden rounded-lg border border-[#c3c6d7] bg-[#f8f9fa] shadow-2xs transition-transform hover:scale-[1.01]"
            title="點擊放大圖片"
          >
            <img
              src={normalizedExtraImageUrl}
              alt="題目附圖"
              className="max-h-[380px] w-auto max-w-full object-contain"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex items-center gap-1 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white shadow">
                <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                點擊放大附圖
              </span>
            </div>
          </div>
        </figure>
      )}

      {/* Lightbox 燈箱放大視窗 */}
      {activeLightboxImg && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveLightboxImg(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-150 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-[92vw] flex-col items-center justify-center cursor-default"
          >
            <button
              type="button"
              onClick={() => setActiveLightboxImg(null)}
              className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 cursor-pointer transition-colors"
              title="關閉 (Esc)"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <img
              src={activeLightboxImg.src}
              alt={activeLightboxImg.alt}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl border border-white/20"
            />
            {activeLightboxImg.alt && (
              <p className="mt-2 text-center text-xs text-white/80">
                {activeLightboxImg.alt}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
