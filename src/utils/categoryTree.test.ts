import { describe, it, expect } from 'vitest';
import {
  buildCategoryBreadcrumb,
  buildCategoryTree,
  getAllDescendantCategoryIds,
  countQuestionsInCategory,
  generateNextCategoryId,
  getCategoryPath,
} from './categoryTree';
import { CategoryItem, Question } from '@/types';

describe('categoryTree utilities', () => {
  const sampleCategories: CategoryItem[] = [
    { id: 1, categories_name: '烹調', parent_id: 0, level: 1, sort_order: 1 },
    { id: 2, categories_name: '中餐', parent_id: 1, level: 2, sort_order: 1 },
    { id: 3, categories_name: '西餐', parent_id: 1, level: 2, sort_order: 2 },
    { id: 4, categories_name: '甜點', parent_id: 2, level: 3, sort_order: 1 },
    { id: 5, categories_name: '甜點', parent_id: 3, level: 3, sort_order: 1 },
    { id: 6, categories_name: '正餐', parent_id: 2, level: 3, sort_order: 2 },
  ];

  it('correctly builds breadcrumb path for identically named categories without conflict', () => {
    // 中餐 > 甜點
    const chineseDessertBreadcrumb = buildCategoryBreadcrumb(4, sampleCategories);
    expect(chineseDessertBreadcrumb).toBe('烹調 > 中餐 > 甜點');

    // 西餐 > 甜點
    const westernDessertBreadcrumb = buildCategoryBreadcrumb(5, sampleCategories);
    expect(westernDessertBreadcrumb).toBe('烹調 > 西餐 > 甜點');

    // 根節點
    expect(buildCategoryBreadcrumb(1, sampleCategories)).toBe('烹調');
  });

  it('retrieves full category path array', () => {
    const path = getCategoryPath(4, sampleCategories);
    expect(path.map((c) => c.categories_name)).toEqual(['烹調', '中餐', '甜點']);
    expect(path.map((c) => c.id)).toEqual([1, 2, 4]);
  });

  it('correctly extracts all descendant category IDs', () => {
    const descendantsOfCooking = getAllDescendantCategoryIds(1, sampleCategories);
    // 包含中餐(2), 西餐(3), 中餐甜點(4), 西餐甜點(5), 中餐正餐(6)
    expect(descendantsOfCooking).toContain(2);
    expect(descendantsOfCooking).toContain(3);
    expect(descendantsOfCooking).toContain(4);
    expect(descendantsOfCooking).toContain(5);
    expect(descendantsOfCooking).toContain(6);
    expect(descendantsOfCooking.length).toBe(5);

    const descendantsOfChinese = getAllDescendantCategoryIds(2, sampleCategories);
    expect(descendantsOfChinese).toEqual([4, 6]);

    const descendantsOfLeaf = getAllDescendantCategoryIds(4, sampleCategories);
    expect(descendantsOfLeaf).toEqual([]);
  });

  it('builds recursive tree nodes with correct nesting', () => {
    const tree = buildCategoryTree(sampleCategories);
    expect(tree.length).toBe(1); // 頂層根節點為「烹調」
    expect(tree[0].categories_name).toBe('烹調');
    expect(tree[0].children.length).toBe(2); // 中餐, 西餐

    const chineseNode = tree[0].children.find((c) => c.id === 2);
    expect(chineseNode?.children.length).toBe(2); // 甜點, 正餐
    expect(chineseNode?.children.map((c) => c.categories_name)).toEqual(['甜點', '正餐']);

    const westernNode = tree[0].children.find((c) => c.id === 3);
    expect(westernNode?.children.length).toBe(1); // 甜點
    expect(westernNode?.children[0].categories_name).toBe('甜點');
    expect(westernNode?.children[0].breadcrumb).toBe('烹調 > 西餐 > 甜點');
  });

  it('counts questions accurately including descendant categories', () => {
    const questions: Partial<Question>[] = [
      { id: 'Q1', categoryId: 4, points: 5, difficulty: 'medium' } as Question, // 中餐甜點
      { id: 'Q2', categoryId: 4, points: 5, difficulty: 'medium' } as Question, // 中餐甜點
      { id: 'Q3', categoryId: 6, points: 5, difficulty: 'medium' } as Question, // 中餐正餐
      { id: 'Q4', categoryId: 5, points: 5, difficulty: 'medium' } as Question, // 西餐甜點
    ];

    // 中餐甜點: 2 題
    expect(countQuestionsInCategory(4, sampleCategories, questions as Question[])).toBe(2);
    // 西餐甜點: 1 題
    expect(countQuestionsInCategory(5, sampleCategories, questions as Question[])).toBe(1);
    // 中餐整體（含甜點+正餐）: 3 題
    expect(countQuestionsInCategory(2, sampleCategories, questions as Question[])).toBe(3);
    // 烹調整體（全部）: 4 題
    expect(countQuestionsInCategory(1, sampleCategories, questions as Question[])).toBe(4);
  });

  it('generates unique next category ID', () => {
    expect(generateNextCategoryId([])).toBe(1);
    expect(generateNextCategoryId(sampleCategories)).toBe(7);
  });
});
