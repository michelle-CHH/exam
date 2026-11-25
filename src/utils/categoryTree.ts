import { CategoryItem, Question } from '@/types';

export interface CategoryTreeNode extends CategoryItem {
  children: CategoryTreeNode[];
  breadcrumb: string;
  questionCount?: number;
}

/**
 * 取得指定分類向上回溯至根節點的完整路徑陣列
 */
export function getCategoryPath(
  categoryIdOrName: number | string | undefined,
  categories: CategoryItem[] = []
): CategoryItem[] {
  if (categoryIdOrName === undefined || categoryIdOrName === null || categoryIdOrName === '') {
    return [];
  }

  const catMap = new Map<number, CategoryItem>();
  categories.forEach((c) => catMap.set(Number(c.id), c));

  let current: CategoryItem | undefined;
  if (typeof categoryIdOrName === 'number' || !isNaN(Number(categoryIdOrName))) {
    current = catMap.get(Number(categoryIdOrName));
  } else {
    current = categories.find((c) => c.categories_name === categoryIdOrName);
  }

  if (!current) return [];

  const path: CategoryItem[] = [current];
  const visited = new Set<number>([current.id]);

  let parentId = current.parent_id;
  while (parentId && parentId > 0 && catMap.has(parentId)) {
    if (visited.has(parentId)) break; // 防止死循環防禦
    visited.add(parentId);
    const parent = catMap.get(parentId)!;
    path.unshift(parent);
    parentId = parent.parent_id;
  }

  return path;
}

/**
 * 組合完整麵包屑路徑，如：「烹調 > 中餐 > 甜點」
 * 徹底解決同名子分類（如中西餐皆有「甜點」）在視覺與選擇時的混淆
 */
export function buildCategoryBreadcrumb(
  categoryIdOrName: number | string | undefined,
  categories: CategoryItem[] = []
): string {
  const path = getCategoryPath(categoryIdOrName, categories);
  if (path.length === 0) {
    return typeof categoryIdOrName === 'string' ? categoryIdOrName : '';
  }
  return path.map((c) => c.categories_name).join(' > ');
}

/**
 * 取得某分類下的所有後代分類 ID（包含子節點、孫節點等）
 */
export function getAllDescendantCategoryIds(
  categoryId: number,
  categories: CategoryItem[] = []
): number[] {
  const result: number[] = [];
  const childrenMap = new Map<number, CategoryItem[]>();

  categories.forEach((c) => {
    const pId = Number(c.parent_id) || 0;
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, []);
    }
    childrenMap.get(pId)!.push(c);
  });

  function collect(pId: number) {
    const kids = childrenMap.get(pId) || [];
    for (const kid of kids) {
      result.push(kid.id);
      collect(kid.id);
    }
  }

  collect(categoryId);
  return result;
}

/**
 * 計算指定分類（含所有子孫分類）涵蓋的試題數量
 */
export function countQuestionsInCategory(
  categoryId: number,
  categories: CategoryItem[] = [],
  questions: Question[] = []
): number {
  const allIds = new Set<number>([categoryId, ...getAllDescendantCategoryIds(categoryId, categories)]);
  const currentCat = categories.find((c) => c.id === categoryId);
  const catName = currentCat?.categories_name;

  return questions.filter((q) => {
    if (q.categoryId && allIds.has(Number(q.categoryId))) return true;
    if (catName && (q.subjectId === catName || q.category_name === catName)) return true;
    return false;
  }).length;
}

/**
 * 自動產生下一個不重複的 Category ID
 */
export function generateNextCategoryId(categories: CategoryItem[] = []): number {
  if (!categories || categories.length === 0) return 1;
  const maxId = categories.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0);
  return maxId + 1;
}

/**
 * 將扁平的 CategoryItem 陣列轉換為 VS Code 風格的多層階層樹
 */
export function buildCategoryTree(
  categories: CategoryItem[] = [],
  questions: Question[] = []
): CategoryTreeNode[] {
  if (!categories || categories.length === 0) return [];

  const sorted = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const nodeMap = new Map<number, CategoryTreeNode>();

  sorted.forEach((c) => {
    nodeMap.set(c.id, {
      ...c,
      children: [],
      breadcrumb: buildCategoryBreadcrumb(c.id, categories),
      questionCount: questions.length > 0 ? countQuestionsInCategory(c.id, categories, questions) : 0,
    });
  });

  const roots: CategoryTreeNode[] = [];

  sorted.forEach((c) => {
    const node = nodeMap.get(c.id)!;
    const parentId = Number(c.parent_id) || 0;
    if (parentId > 0 && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
