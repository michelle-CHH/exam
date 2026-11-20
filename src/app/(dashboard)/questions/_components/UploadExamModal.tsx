'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Question } from '@/types';
import {
  validateAndParseExamFile,
  ExamUploadValidationResult,
} from '@/utils/fileParsers';

interface UploadExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: (questions: Question[], file: File, autoGenerateExam?: boolean) => void;
}

export const UploadExamModal: React.FC<UploadExamModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ExamUploadValidationResult | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [uploadSucceeded, setUploadSucceeded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setIsDragging(false);
      setIsChecking(false);
      setValidationResult(null);
      setIsPreviewExpanded(false);
      setUploadSucceeded(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectNewFile = async (file: File | null) => {
    setSelectedFile(file);
    setValidationResult(null);
    setIsPreviewExpanded(false);
    setUploadSucceeded(false);

    if (!file) return;

    setIsChecking(true);
    try {
      const result = await validateAndParseExamFile(file);
      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({
        isValid: false,
        questions: [],
        fileError: err?.message || '檔案解析失敗，請確認檔案格式',
        rowErrors: [],
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      handleSelectNewFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    if (file) {
      handleSelectNewFile(file);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelectNewFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePerformUpload = (autoGenerateExam: boolean) => {
    if (!selectedFile || !validationResult || !validationResult.isValid) return;
    if (validationResult.questions.length === 0) return;

    setUploadSucceeded(true);
    onUploadSuccess?.(validationResult.questions, selectedFile, autoGenerateExam);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const hasValidationFailed =
    validationResult !== null && !validationResult.isValid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-xl max-w-3xl w-full shadow-2xl p-6 flex flex-col gap-5 z-10 animate-in fade-in zoom-in-95 duration-200 border border-[#c3c6d7]/30 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#c3c6d7]/30">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#dbe1ff] text-[#004ac6] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">upload_file</span>
            </span>
            <h2 className="text-[18px] text-[#191c1e] font-bold">批次上傳</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#434655] hover:text-[#191c1e] p-1 rounded cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => { e.preventDefault(); handlePerformUpload(false); }} className="flex flex-col gap-4">
          {/* Sample Excel Download Banner - Single Line */}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-[#e8edff] text-[#004ac6] border border-[#b4c5ff]/60 text-[13px]">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="material-symbols-outlined text-[18px] shrink-0">
                table_view
              </span>
              <span>
                請依照「下載範例Excel 檔」新增題目 ，所有欄位皆填寫完成後即可上傳。
              </span>
            </div>
            <a
              href="/題庫試卷上傳範例.xlsx"
              download="題庫試卷上傳範例.xlsx"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#dbe1ff]/50 text-[#004ac6] border border-[#b4c5ff] rounded-md text-[12px] font-semibold transition-colors shrink-0 shadow-2xs whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>下載範例 Excel</span>
            </a>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Local File Picker Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-center transition-colors cursor-pointer ${
              isDragging
                ? 'border-[#004ac6] bg-[#dbe1ff]/30'
                : hasValidationFailed
                ? 'border-[#ba1a1a]/60 bg-[#fff8f7]'
                : uploadSucceeded
                ? 'border-[#137333]/60 bg-[#e6f4ea]/40'
                : selectedFile
                ? 'border-[#004ac6]/60 bg-[#f8f9ff]'
                : 'border-[#c3c6d7] bg-[#f8f9fa] hover:border-[#004ac6]/60 hover:bg-[#f2f4f6]'
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center justify-between w-full px-3.5 py-2.5 bg-white rounded-lg border border-[#c3c6d7]/50 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0 text-left">
                  <span className="w-9 h-9 rounded-lg bg-[#dbe1ff] text-[#004ac6] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">description</span>
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-[#191c1e] break-all">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-[#434655] font-mono">
                      {formatFileSize(selectedFile.size)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 text-[#434655] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="移除已選檔案並重新選擇"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            ) : (
              <>
                <span className="w-12 h-12 rounded-full bg-[#dbe1ff]/60 text-[#004ac6] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[26px]">folder_open</span>
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-[14px] font-semibold text-[#191c1e]">
                    點擊選取本地檔案，或將試卷檔案拖曳至此
                  </p>
                  <p className="text-[12px] text-[#434655]">
                    支援標準 Excel (.xlsx) 與 CSV (.csv) 格式試卷檔案
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-1 px-3.5 py-1.5 bg-white hover:bg-[#eceef0] text-[#004ac6] border border-[#c3c6d7] rounded-lg text-[12px] font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  瀏覽本地檔案
                </button>
              </>
            )}
          </div>

          {/* Checking Status Banner */}
          {isChecking && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#f2f4f6] text-[#004ac6] border border-[#c3c6d7]/60 text-[13px] animate-pulse">
              <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
              <span>正在即時解析檔案內容並檢查題目格式與欄位...</span>
            </div>
          )}

          {/* Validation Failure Report */}
          {hasValidationFailed && validationResult && (
            <div className="rounded-xl border border-[#ffdad6] bg-[#fff8f7] overflow-hidden animate-in fade-in duration-150">
              <div className="bg-[#ba1a1a]/10 px-4 py-3 flex items-center gap-2.5 border-b border-[#ba1a1a]/20">
                <span className="w-7 h-7 rounded-full bg-[#ba1a1a] text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                </span>
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold text-[#ba1a1a]">
                    審查未通過：檔案內容格式有誤
                  </span>
                  <span className="text-[12px] text-[#434655]">
                    {validationResult.fileError
                      ? '檔案結構或標題欄位不符合規範'
                      : `共有 ${validationResult.rowErrors.length} 題的欄位內容不完整或格式有誤，請修正後重新上傳`}
                  </span>
                </div>
              </div>

              <div className="p-4 max-h-52 overflow-y-auto flex flex-col gap-2.5">
                {validationResult.fileError ? (
                  <div className="p-3 bg-white border border-[#ffdad6] rounded-lg text-[13px] text-[#ba1a1a] flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                      cancel
                    </span>
                    <span>{validationResult.fileError}</span>
                  </div>
                ) : (
                  validationResult.rowErrors.map((err) => (
                    <div
                      key={err.rowNumber}
                      className="p-3 bg-white border border-[#ffdad6] rounded-lg flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-[13px] text-[#191c1e]">
                          第 {err.questionIndex} 題：{err.questionPreview}
                        </span>
                        <span className="font-mono text-[11px] text-[#ba1a1a] bg-[#fff8f7] px-2 py-0.5 rounded border border-[#ffdad6] shrink-0">
                          Excel 第 {err.rowNumber} 列
                        </span>
                      </div>
                      <div className="text-[12px] text-[#434655] font-medium">
                        有問題的欄位：
                      </div>
                      <ul className="text-[12px] text-[#ba1a1a] flex flex-col gap-1 pl-1">
                        {err.fieldErrors.map((fe, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-[#ba1a1a] shrink-0 mt-0.5">
                              cancel
                            </span>
                            <span>{fe}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Validation Success & Collapsible Question Preview */}
          {!hasValidationFailed && validationResult && validationResult.isValid && validationResult.questions.length > 0 && (
            <div className="rounded-xl border border-[#b4c5ff] bg-[#f8f9ff] p-3.5 flex flex-col gap-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#004ac6] text-white flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[17px]">check</span>
                  </span>
                  <div>
                    <span className="text-[13px] font-bold text-[#004ac6]">
                      檔案審查通過！成功讀取 {validationResult.questions.length} 筆題目
                    </span>
                    <div className="text-[11px] text-[#434655] flex items-center gap-2 mt-0.5">
                      <span>單選題 {validationResult.questions.filter(q => q.type === 'single').length} 題</span>
                      <span>•</span>
                      <span>多選題 {validationResult.questions.filter(q => q.type === 'multiple').length} 題</span>
                      <span>•</span>
                      <span>是非題 {validationResult.questions.filter(q => q.type === 'true_false').length} 題</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-[#e8edff] text-[#004ac6] border border-[#b4c5ff] text-[12px] font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isPreviewExpanded ? 'expand_less' : 'visibility'}
                  </span>
                  <span>{isPreviewExpanded ? '收合題目預覽' : '展開題目預覽'}</span>
                </button>
              </div>

              {/* Collapsible Questions List */}
              {isPreviewExpanded && (
                <div className="mt-1 max-h-56 overflow-y-auto space-y-2 pr-1 border-t border-[#b4c5ff]/40 pt-2.5 animate-in fade-in duration-150">
                  {validationResult.questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="bg-white p-3 rounded-lg border border-[#c3c6d7]/40 shadow-2xs flex flex-col gap-1.5 text-[12px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#e8edff] text-[#004ac6] font-mono font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.type === 'single'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : q.type === 'multiple'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {q.type === 'single' ? '單選題' : q.type === 'multiple' ? '多選題' : '是非題'}
                          </span>
                          <span className="text-[#434655] font-mono text-[11px]">{q.points} 分</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333] font-bold font-mono text-[11px]">
                          答案: {q.correctAnswer}
                        </span>
                      </div>
                      <p className="text-[#191c1e] font-medium line-clamp-2 pl-7">
                        {q.content}
                      </p>
                      {q.options && q.options.length > 0 && (
                        <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-[#434655]">
                          {q.options.map((opt, oIdx) => (
                            <span key={oIdx} className="truncate">
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal Footer: 取消、批次上傳、批次上傳並生成試卷 */}
          <div className="pt-3 border-t border-[#c3c6d7]/30 flex items-center justify-end gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#eceef0] text-[#191c1e] rounded-lg hover:bg-[#e0e3e5] text-[13px] font-medium transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => handlePerformUpload(false)}
              disabled={!selectedFile || isChecking || hasValidationFailed || !validationResult?.isValid}
              className="px-4 py-2 bg-white hover:bg-[#e8edff] text-[#004ac6] border border-[#004ac6] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              <span>批次上傳</span>
            </button>
            <button
              type="button"
              onClick={() => handlePerformUpload(true)}
              disabled={!selectedFile || isChecking || hasValidationFailed || !validationResult?.isValid}
              className="px-4.5 py-2 bg-[#004ac6] hover:bg-[#003ea8] text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-[13px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">post_add</span>
              <span>批次上傳並生成試卷</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
