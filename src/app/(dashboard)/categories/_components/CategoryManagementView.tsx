'use client';

import React, { useState, useMemo } from 'react';
import { CategoryItem, Question } from '@/types';
import {
  buildCategoryTree,
  buildCategoryBreadcrumb,
  getAllDescendantCategoryIds,
  generateNextCategoryId,
  countQuestionsInCategory,
  CategoryTreeNode,
} from '@/utils/categoryTree';

interface CategoryManagementViewProps {
  categories: CategoryItem[];
  questions?: Question[];
  onSaveCategories: (newCategories: CategoryItem[]) => Promise<void> | void;
  isSyncing?: boolean;
  onNavigateToQuestionBank?: (categoryId: number, subjectName: string) => void;
}

export const CategoryManagementView: React.FC<CategoryManagementViewProps> = ({
  categories = [],
  questions = [],
  onSaveCategories,
  isSyncing = false,
  onNavigateToQuestionBank,
}) => {
  // 樹狀節點展開狀態
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    categories.forEach((c) => {
      initial[c.id] = true; // 預設全展開
    });
    return initial;
  });

  // 當前選中的分類
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(() => {
    return categories.length > 0 ? categories[0].id : null;
  });

  // 搜尋過濾關鍵字
  const [searchFilter, setSearchFilter] = useState('');

  // 彈跳視窗狀態：新增 / 編輯分類
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTargetCat, setEditingTargetCat] = useState<CategoryItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<number>(0);
  const [formSortOrder, setFormSortOrder] = useState<number>(1);

  // 刪除確認狀態
  const [deletingCat, setDeletingCat] = useState<CategoryItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // 建立階層樹狀結構
  const treeData = useMemo(() => {
    return buildCategoryTree(categories, questions);
  }, [categories, questions]);

  // 切換折疊/展開
  const toggleNode = (id: number) => {
    setExpandedNodeIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const next: Record<number, boolean> = {};
    categories.forEach((c) => (next[c.id] = true));
    setExpandedNodeIds(next);
  };

  const collapseAll = () => {
    setExpandedNodeIds({});
  };

  // 開啟新增頂層分類
  const handleOpenCreateRoot = () => {
    setModalMode('create');
    setEditingTargetCat(null);
    setFormName('');
    setFormParentId(0);
    setFormSortOrder(categories.filter((c) => !c.parent_id || c.parent_id === 0).length + 1);
    setIsModalOpen(true);
  };

  // 開啟新增子分類
  const handleOpenCreateChild = (parentCat: CategoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalMode('create');
    setEditingTargetCat(null);
    setFormName('');
    setFormParentId(parentCat.id);
    const siblings = categories.filter((c) => c.parent_id === parentCat.id);
    setFormSortOrder(siblings.length + 1);
    setIsModalOpen(true);
  };

  // 開啟編輯分類
  const handleOpenEdit = (cat: CategoryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalMode('edit');
    setEditingTargetCat(cat);
    setFormName(cat.categories_name);
    setFormParentId(cat.parent_id || 0);
    setFormSortOrder(cat.sort_order || 1);
    setIsModalOpen(true);
  };

  // 儲存（新增或更新）
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      showFeedback('error', '分類名稱不能為空！');
      return;
    }

    let updatedList: CategoryItem[] = [];

    if (modalMode === 'create') {
      const newId = generateNextCategoryId(categories);
      const parentCat = categories.find((c) => c.id === formParentId);
      const newLevel = parentCat ? (parentCat.level || 1) + 1 : 1;

      const newCategory: CategoryItem = {
        id: newId,
        categories_name: cleanName,
        parent_id: formParentId,
        level: newLevel,
        sort_order: formSortOrder,
      };

      updatedList = [...categories, newCategory];
      setSelectedCategoryId(newId);
      setExpandedNodeIds((prev) => ({ ...prev, [formParentId]: true, [newId]: true }));
      showFeedback('success', `成功新增分類「${buildCategoryBreadcrumb(newId, updatedList)}」！`);
    } else if (modalMode === 'edit' && editingTargetCat) {
      // 檢查父節點不能是自己或自己的後代
      if (formParentId === editingTargetCat.id) {
        showFeedback('error', '父分類不能設定為自己本身！');
        return;
      }
      const descendants = getAllDescendantCategoryIds(editingTargetCat.id, categories);
      if (descendants.includes(formParentId)) {
        showFeedback('error', '父分類不能設定為自己的子孫分類！');
        return;
      }

      const parentCat = categories.find((c) => c.id === formParentId);
      const newLevel = parentCat ? (parentCat.level || 1) + 1 : 1;

      updatedList = categories.map((c) => {
        if (c.id === editingTargetCat.id) {
          return {
            ...c,
            categories_name: cleanName,
            parent_id: formParentId,
            level: newLevel,
            sort_order: formSortOrder,
          };
        }
        return c;
      });
      showFeedback('success', `已成功更新分類「${cleanName}」！`);
    }

    setIsModalOpen(false);
    await onSaveCategories(updatedList);
  };

  // 執行刪除分類
  const handleConfirmDelete = async () => {
    if (!deletingCat) return;
    const catId = deletingCat.id;
    const descendantIds = getAllDescendantCategoryIds(catId, categories);
    const allRemovedIds = new Set([catId, ...descendantIds]);

    const updatedList = categories.filter((c) => !allRemovedIds.has(c.id));
    if (selectedCategoryId && allRemovedIds.has(selectedCategoryId)) {
      setSelectedCategoryId(updatedList[0]?.id || null);
    }

    setDeletingCat(null);
    showFeedback('success', `已刪除「${deletingCat.categories_name}」及其關聯層級！`);
    await onSaveCategories(updatedList);
  };

  // 當前選取的分類物件
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // 當前選取分類下的題目
  const questionsInSelectedCategory = useMemo(() => {
    if (!selectedCategory) return [];
    const allIds = new Set<number>([selectedCategory.id, ...getAllDescendantCategoryIds(selectedCategory.id, categories)]);
    const catName = selectedCategory.categories_name;

    return questions.filter((q) => {
      if (q.categoryId && allIds.has(Number(q.categoryId))) return true;
      if (catName && (q.subjectId === catName || q.category_name === catName)) return true;
      return false;
    });
  }, [selectedCategory, categories, questions]);

  // 遞迴渲染單一節點（VS Code 檔案樹外觀）
  const renderTreeNode = (node: CategoryTreeNode, depth: number = 0) => {
    const isExpanded = expandedNodeIds[node.id] ?? true;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedCategoryId === node.id;
    const qCount = countQuestionsInCategory(node.id, categories, questions);

    // 關鍵字搜尋過濾判定
    const isMatched =
      !searchFilter.trim() ||
      node.categories_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      node.breadcrumb.toLowerCase().includes(searchFilter.toLowerCase());

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          onClick={() => setSelectedCategoryId(node.id)}
          className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-[13px] ${
            isSelected
              ? 'bg-[#004ac6] text-white font-medium shadow-xs'
              : 'hover:bg-[#f2f4f6] text-[#191c1e]'
          } ${!isMatched ? 'opacity-40' : ''}`}
          style={{ paddingLeft: `${Math.max(8, depth * 20 + 8)}px` }}
        >
          {/* 左側：展開箭頭、資料夾圖示、分類名稱、題目數徽章 */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
                className={`p-0.5 rounded hover:bg-black/10 transition-colors flex items-center justify-center cursor-pointer ${
                  isSelected ? 'text-white' : 'text-[#737686]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}
                </span>
              </button>
            ) : (
              <span className="w-5" />
            )}

            {/* 資料夾或標籤圖示 */}
            <span
              className={`material-symbols-outlined text-[18px] flex-shrink-0 ${
                isSelected ? 'text-white' : depth === 0 ? 'text-[#004ac6]' : 'text-[#f59e0b]'
              }`}
            >
              {depth === 0 ? (isExpanded ? 'folder_open' : 'folder') : hasChildren ? 'folder' : 'label'}
            </span>

            {/* 分類名稱 */}
            <span className="truncate font-medium">{node.categories_name}</span>

            {/* 層級標籤 */}
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                isSelected ? 'bg-white/20 text-white' : 'bg-[#e0e3e5] text-[#434655]'
              }`}
            >
              L{node.level || depth + 1}
            </span>

            {/* 題目數量 */}
            {qCount > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-[#e8edff] text-[#004ac6] font-semibold'
                }`}
              >
                {qCount} 題
              </span>
            )}
          </div>

          {/* 右側：動作按鈕 (新增子項、編輯、刪除) */}
          <div
            className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
              isSelected ? 'opacity-100 text-white' : 'text-[#434655]'
            }`}
          >
            <button
              type="button"
              onClick={(e) => handleOpenCreateChild(node, e)}
              title="新增子分類"
              className="p-1 rounded hover:bg-black/15 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenEdit(node, e)}
              title="編輯名稱與層級"
              className="p-1 rounded hover:bg-black/15 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingCat(node);
              }}
              title="刪除分類"
              className="p-1 rounded hover:bg-red-500/20 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>

        {/* 遞迴展開子節點 */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col border-l border-[#c3c6d7]/30 ml-4 pl-1">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto gap-5">
      {/* 頂部頁頭標題列 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#c3c6d7]/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#dbe1ff] text-[#004ac6] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">account_tree</span>
            </span>
            <h1 className="text-[22px] font-bold text-[#191c1e] tracking-tight">
              學科與分類層級管理 (Categories Hierarchy)
            </h1>
          </div>
          <p className="text-[13px] text-[#434655] mt-1">
            支援多層級樹狀組織、路徑麵包屑隔離、同名子分類防衝突，即時同步至雲端 Google Sheet 的 categories 表
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreateRoot}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#004ac6] text-white rounded-lg text-[13px] font-semibold hover:bg-[#2563eb] shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>新增頂層分類</span>
          </button>
          <button
            type="button"
            onClick={() => onSaveCategories(categories)}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#c3c6d7] text-[#191c1e] rounded-lg text-[13px] font-medium hover:bg-[#f2f4f6] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? '同步中...' : '同步至試算表'}</span>
          </button>
        </div>
      </div>

      {/* 狀態提示回饋 */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg border text-[13px] font-medium flex items-center gap-2 animate-in fade-in ${
            feedbackMessage.type === 'success'
              ? 'bg-[#6ffbbe]/25 border-[#007d55] text-[#006242]'
              : 'bg-red-50 border-red-300 text-red-700'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {feedbackMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* 主面板：左側樹狀檔案總管 + 右側詳情與題目檢視 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 左側：樹狀瀏覽器 (佔 5 格) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#c3c6d7]/40 shadow-xs p-4 flex flex-col gap-3 min-h-[500px]">
          {/* 工具列：搜尋與全部展開/收合 */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737686] text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="搜尋分類名稱或路徑..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-[#f2f4f6] text-[#191c1e] text-[12px] pl-8 pr-3 py-1.5 rounded-lg border border-[#c3c6d7]/60 focus:outline-none focus:ring-1 focus:ring-[#004ac6]"
              />
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#434655]">
              <button
                type="button"
                onClick={expandAll}
                className="px-2 py-1 hover:bg-[#f2f4f6] rounded transition-colors cursor-pointer"
                title="展開全部節點"
              >
                全部展開
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2 py-1 hover:bg-[#f2f4f6] rounded transition-colors cursor-pointer"
                title="收合全部節點"
              >
                全部收合
              </button>
            </div>
          </div>

          {/* 樹狀結構本體 */}
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[620px] pr-1">
            {treeData.length > 0 ? (
              treeData.map((node) => renderTreeNode(node, 0))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[#737686] gap-2">
                <span className="material-symbols-outlined text-[36px] text-[#c3c6d7]">account_tree</span>
                <p className="text-[13px]">目前尚未建立任何分類</p>
                <button
                  type="button"
                  onClick={handleOpenCreateRoot}
                  className="mt-2 text-xs text-[#004ac6] font-semibold underline hover:text-[#2563eb] cursor-pointer"
                >
                  立即建立第一個頂層分類
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右側：分類詳情與題目預覽 (佔 7 格) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {selectedCategory ? (
            <div className="bg-white rounded-xl border border-[#c3c6d7]/40 shadow-xs p-5 flex flex-col gap-4">
              {/* 分類路徑麵包屑 */}
              <div className="flex items-center justify-between pb-3 border-b border-[#c3c6d7]/30">
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-bold text-[#737686] uppercase tracking-wider">
                    完整路徑 (Breadcrumb)
                  </div>
                  <div className="text-[16px] font-bold text-[#004ac6] flex items-center gap-1.5 flex-wrap">
                    <span className="material-symbols-outlined text-[18px]">folder</span>
                    <span>{buildCategoryBreadcrumb(selectedCategory.id, categories)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenCreateChild(selectedCategory)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#e8edff] text-[#004ac6] text-xs font-semibold rounded-lg hover:bg-[#dbe1ff] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>新增子分類</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedCategory)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#c3c6d7] text-[#191c1e] text-xs font-medium rounded-lg hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>編輯</span>
                  </button>
                </div>
              </div>

              {/* 分類元資料資訊卡 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8fafc] p-3 rounded-lg border border-[#c3c6d7]/20 text-[12px]">
                <div>
                  <div className="text-[#737686]">分類代碼 (ID)</div>
                  <div className="font-mono font-bold text-[#191c1e]">#{selectedCategory.id}</div>
                </div>
                <div>
                  <div className="text-[#737686]">層級深度 (Level)</div>
                  <div className="font-mono font-bold text-[#191c1e]">第 {selectedCategory.level} 層</div>
                </div>
                <div>
                  <div className="text-[#737686]">排序權重 (Sort)</div>
                  <div className="font-mono font-bold text-[#191c1e]">{selectedCategory.sort_order}</div>
                </div>
                <div>
                  <div className="text-[#737686]">關聯試題數</div>
                  <div className="font-mono font-bold text-[#004ac6]">
                    {countQuestionsInCategory(selectedCategory.id, categories, questions)} 題
                  </div>
                </div>
              </div>

              {/* 該分類底下的試題列表預覽 */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-[#191c1e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#004ac6]">quiz</span>
                    <span>涵蓋試題預覽 ({questionsInSelectedCategory.length})</span>
                  </h3>
                  {onNavigateToQuestionBank && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToQuestionBank(selectedCategory.id, selectedCategory.categories_name)
                      }
                      className="text-xs text-[#004ac6] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>在題庫中完整瀏覽</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                  {questionsInSelectedCategory.length > 0 ? (
                    questionsInSelectedCategory.slice(0, 15).map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="p-3 rounded-lg bg-[#f9fafb] border border-[#c3c6d7]/30 flex flex-col gap-1.5 text-[12px]"
                      >
                        <div className="flex items-center justify-between text-[#737686]">
                          <span className="font-mono font-bold text-[#004ac6]">{q.id}</span>
                          <span className="px-2 py-0.5 rounded bg-white border border-[#c3c6d7]/40">
                            {q.type === 'single' ? '單選題' : q.type === 'multiple' ? '多選題' : '是非題'} · {q.points || 5} 分
                          </span>
                        </div>
                        <div className="text-[#191c1e] font-medium line-clamp-2">
                          {q.content || q.question}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-[#737686] text-xs bg-[#f9fafb] rounded-lg border border-dashed border-[#c3c6d7]/40">
                      此分類目前尚無試題關聯。建立題目或匯入試卷時可指定歸入此分類。
                    </div>
                  )}
                  {questionsInSelectedCategory.length > 15 && (
                    <div className="text-center text-xs text-[#737686] py-1">
                      ... 尚有 {questionsInSelectedCategory.length - 15} 道題目未列出
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#c3c6d7]/40 shadow-xs p-8 text-center text-[#737686] flex flex-col items-center justify-center min-h-[300px]">
              <span className="material-symbols-outlined text-[48px] text-[#c3c6d7] mb-2">account_tree</span>
              <p className="text-[14px] font-semibold text-[#191c1e]">請由左側選擇任一學科分類</p>
              <p className="text-xs text-[#737686] mt-1 max-w-sm">
                點選左側節點可檢視完整路徑麵包屑、包含的所有子分類，以及關聯題目的詳細清單。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 建立 / 編輯分類模態視窗 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl max-w-md w-full shadow-2xl p-5 flex flex-col gap-4 z-10 border border-[#c3c6d7]/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#c3c6d7]/30">
              <h3 className="text-[16px] font-bold text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004ac6]">
                  {modalMode === 'create' ? 'add_circle' : 'edit'}
                </span>
                <span>{modalMode === 'create' ? '新增學科/子分類' : '編輯分類節點'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#737686] hover:text-[#191c1e] p-1 rounded cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="flex flex-col gap-3.5 text-[13px]">
              {/* 分類名稱 */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#191c1e]">
                  分類名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如：中餐、西餐、甜點、微積分..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="bg-[#f2f4f6] text-[#191c1e] px-3 py-2 rounded-lg border border-[#c3c6d7] focus:ring-2 focus:ring-[#004ac6]/40 focus:outline-none"
                />
              </div>

              {/* 上層父分類 */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#191c1e]">上層父節點 (所屬母分類)</label>
                <select
                  value={formParentId}
                  onChange={(e) => setFormParentId(Number(e.target.value))}
                  className="bg-[#f2f4f6] text-[#191c1e] px-3 py-2 rounded-lg border border-[#c3c6d7] focus:ring-2 focus:ring-[#004ac6]/40 focus:outline-none"
                >
                  <option value={0}>[ 頂層獨立分類 (Root Category) ]</option>
                  {categories
                    .filter((c) => !editingTargetCat || c.id !== editingTargetCat.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {buildCategoryBreadcrumb(c.id, categories)} (Level {c.level})
                      </option>
                    ))}
                </select>
                <span className="text-[11px] text-[#737686]">
                  父節點若為頂層分類，代表它是第一層領域（如：烹調、自然科學）
                </span>
              </div>

              {/* 排序權重 */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-[#191c1e]">排序權重 (Sort Order)</label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(Number(e.target.value) || 1)}
                  className="bg-[#f2f4f6] text-[#191c1e] px-3 py-2 rounded-lg border border-[#c3c6d7] focus:ring-2 focus:ring-[#004ac6]/40 focus:outline-none"
                />
                <span className="text-[11px] text-[#737686]">數字越小排序越靠前</span>
              </div>

              {/* 預覽完整麵包屑 */}
              {formName.trim() && (
                <div className="p-2.5 rounded-lg bg-[#e8edff] text-[#004ac6] border border-[#b4c5ff]/50 text-[12px] flex flex-col gap-0.5">
                  <span className="font-bold">儲存後的完整路徑預覽：</span>
                  <span className="font-mono">
                    {formParentId > 0
                      ? `${buildCategoryBreadcrumb(formParentId, categories)} > ${formName.trim()}`
                      : formName.trim()}
                  </span>
                </div>
              )}

              {/* 按鈕組 */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#c3c6d7]/30">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#c3c6d7] text-[#434655] hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#004ac6] text-white font-semibold hover:bg-[#2563eb] shadow-sm transition-colors cursor-pointer"
                >
                  確認儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 刪除確認防呆視窗 */}
      {deletingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDeletingCat(null)}
          />
          <div className="relative bg-white rounded-xl max-w-sm w-full shadow-2xl p-5 flex flex-col gap-3.5 z-10 border border-[#c3c6d7]/30 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-red-600">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-[16px] font-bold text-[#191c1e]">確認刪除分類？</h3>
            </div>

            <p className="text-[13px] text-[#434655] leading-relaxed">
              您即將刪除「<strong className="text-[#191c1e]">{deletingCat.categories_name}</strong>」（路徑：{buildCategoryBreadcrumb(deletingCat.id, categories)}）。
            </p>

            {(() => {
              const descendantCount = getAllDescendantCategoryIds(deletingCat.id, categories).length;
              const qCount = countQuestionsInCategory(deletingCat.id, categories, questions);
              return (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700 flex flex-col gap-1">
                  {descendantCount > 0 && (
                    <div className="flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      <span>此分類下包含 {descendantCount} 個子分類，將一併移除！</span>
                    </div>
                  )}
                  {qCount > 0 && (
                    <div className="flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      <span>此分類及子分類下有 {qCount} 道題目的分類關聯將被解除！</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#c3c6d7]/30">
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#c3c6d7] text-[#434655] hover:bg-[#f2f4f6] text-[13px] transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 shadow-sm transition-colors cursor-pointer"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
