import { describe, expect, it } from 'vitest';
import { validateAndParseExamFile, cleanOptionText } from '@/utils/fileParsers';

describe('fileParsers - cleanOptionText', () => {
  it('strips redundant option letters and prefixes', () => {
    expect(cleanOptionText('A. 文書編輯')).toBe('文書編輯');
    expect(cleanOptionText('B、記憶體與行程管理')).toBe('記憶體與行程管理');
    expect(cleanOptionText('(C) 網頁瀏覽')).toBe('網頁瀏覽');
    expect(cleanOptionText('D: 影像剪輯')).toBe('影像剪輯');
    expect(cleanOptionText('外部碎片')).toBe('外部碎片');
  });
});

describe('fileParsers - JSON exam file upload', () => {
  const sampleJson = [
    {
      id: 1,
      test_id: 'Q-BDA-1140201',
      question: '若某數據點的 Z 分數（Z-Score）= 2，請問代表下列哪一種意涵？',
      option: {
        A: '代表該數據點之原始數值為 2',
        B: '該數據點比平均值低 2 個標準差',
        C: '代表數據為異常值',
        D: '該數據點比平均值高 2 個標準差',
      },
      answer: 'D',
      Explanation: 'Z 分數定義為 (X - μ) / σ，用以衡量數值與平均值相差幾個標準差；Z = 2 代表該數據點比平均值高出 2 個標準差。',
      difficulty: 2.0,
      score: 2,
      category_id: 1,
      taqs: '統計分析, Z分數, 描述性統計',
      updated_at: '2026/11/24 17:09:00',
      updated_by: 1,
    },
    {
      id: 2,
      test_id: 'Q-BDA-1140202',
      question: '附圖為某資料之分佈圖，此圖資料之偏態（Skewness）值較有可能為下列哪個選項？',
      option: {
        A: 'Skewness < 0',
        B: 'Skewness > 0',
        C: 'Skewness = 0',
        D: '無法計算 Skewness',
      },
      answer: 'A',
      Explanation: '附圖的分佈呈現左側長尾、高峰偏向右側的形態，屬於左偏態。',
      difficulty: 3.0,
      score: 2,
      category_id: 1,
      taqs: '統計分析, 偏態, 資料分佈',
      image_url: 'https://drive.google.com/file/d/1A2B3C_DEMO_IMG/view?usp=sharing',
      updated_at: '2026/11/24 17:09:00',
      updated_by: 1,
    },
  ];

  it('successfully parses JSON file matching user format', async () => {
    const jsonString = JSON.stringify(sampleJson);
    const file = new File([jsonString], 'test_exam.json', { type: 'application/json' });

    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(true);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.questions).toHaveLength(2);

    const q1 = result.questions[0];
    expect(q1.id).toBe('Q-BDA-1140201');
    expect(q1.content).toContain('Z 分數');
    expect(q1.options).toHaveLength(4);
    expect(q1.options?.[0]).toBe('代表該數據點之原始數值為 2');
    expect(q1.correctAnswer).toBe('D');
    expect(q1.explanation).toContain('Z 分數定義為');
    expect(q1.difficulty).toBe('easy'); // difficulty 2.0 < 2.5
    expect(q1.points).toBe(2);
    expect(q1.tags).toEqual(['統計分析', 'Z分數', '描述性統計']);

    const q2 = result.questions[1];
    expect(q2.id).toBe('Q-BDA-1140202');
    expect(q2.difficulty).toBe('medium'); // difficulty 3.0 >= 2.5
    // image_url converted from Google Drive share link to direct lh3 URL
    expect(q2.imageUrl).toBe('https://lh3.googleusercontent.com/d/1A2B3C_DEMO_IMG');
  });

  it('detects and reports validation errors in JSON files', async () => {
    const invalidJson = [
      {
        test_id: 'Q-INVALID-1',
        question: '', // Empty question
        option: { A: '選項A' }, // Only 1 option
        answer: '', // Empty answer
      },
    ];

    const file = new File([JSON.stringify(invalidJson)], 'invalid.json', { type: 'application/json' });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.rowErrors).toHaveLength(1);
    expect(result.rowErrors[0].fieldErrors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('題幹內容不可為空白'),
        expect.stringContaining('選項數量不足'),
        expect.stringContaining('未指定正確答案'),
      ])
    );
  });
});
