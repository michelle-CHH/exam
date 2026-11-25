import { describe, expect, it } from 'vitest';
import {
  cleanOptionText,
  colRefToIndex,
  parseCsvQuestions,
  parseCsvRows,
  parseJsonExamFile,
  parseQuestionsFromUpload,
  parseQuestionType,
  parseSubject,
  parseWrongQuestionsExcel,
  validateAndParseExamFile,
} from '@/utils/fileParsers';

describe('fileParsers - cleanOptionText', () => {
  it('strips redundant option letters and prefixes', () => {
    expect(cleanOptionText('A. 文書編輯')).toBe('文書編輯');
    expect(cleanOptionText('B、記憶體與行程管理')).toBe('記憶體與行程管理');
    expect(cleanOptionText('(C) 網頁瀏覽')).toBe('網頁瀏覽');
    expect(cleanOptionText('D: 影像剪輯')).toBe('影像剪輯');
    expect(cleanOptionText('外部碎片')).toBe('外部碎片');
  });
});

describe('fileParsers - parseSubject', () => {
  it('correctly maps standard subjects by exact match or aliases', () => {
    expect(parseSubject('數學')).toBe('math');
    expect(parseSubject('math')).toBe('math');
    expect(parseSubject('數學科')).toBe('math');
    expect(parseSubject('國文')).toBe('chinese');
    expect(parseSubject('英文科')).toBe('english');
    expect(parseSubject('物理')).toBe('physics');
    expect(parseSubject('化學')).toBe('chemistry');
    expect(parseSubject('生物')).toBe('biology');
    expect(parseSubject('天文')).toBe('astronomy');
    expect(parseSubject('公民')).toBe('civics');
    expect(parseSubject('地理')).toBe('geography');
    expect(parseSubject('歷史')).toBe('history');
  });

  it('matches compound categories containing subject keywords', () => {
    expect(parseSubject('自然 (物理)')).toBe('physics');
    expect(parseSubject('自然 (化學)')).toBe('chemistry');
    expect(parseSubject('自然 (生物)')).toBe('biology');
    expect(parseSubject('社會 (地理)')).toBe('geography');
    expect(parseSubject('社會 (歷史)')).toBe('history');
  });

  it('preserves custom subject names if not in default 10 subjects', () => {
    expect(parseSubject('資料結構與演算法')).toBe('資料結構與演算法');
    expect(parseSubject('  烹飪概論  ')).toBe('烹飪概論');
  });

  it('returns null for empty or whitespace strings', () => {
    expect(parseSubject('')).toBeNull();
    expect(parseSubject('   ')).toBeNull();
  });
});

describe('fileParsers - parseQuestionType', () => {
  it('correctly identifies single choice variations', () => {
    expect(parseQuestionType('單選')).toBe('single');
    expect(parseQuestionType('單選題')).toBe('single');
    expect(parseQuestionType('single')).toBe('single');
    expect(parseQuestionType('Single Choice')).toBe('single');
  });

  it('correctly identifies multiple choice variations', () => {
    expect(parseQuestionType('多選')).toBe('multiple');
    expect(parseQuestionType('多選題')).toBe('multiple');
    expect(parseQuestionType('複選')).toBe('multiple');
    expect(parseQuestionType('multiple')).toBe('multiple');
    expect(parseQuestionType('multiple choice')).toBe('multiple');
  });

  it('correctly identifies true/false variations', () => {
    expect(parseQuestionType('是非')).toBe('true_false');
    expect(parseQuestionType('是非題')).toBe('true_false');
    expect(parseQuestionType('true_false')).toBe('true_false');
    expect(parseQuestionType('true/false')).toBe('true_false');
  });

  it('returns null for unsupported or empty question types', () => {
    expect(parseQuestionType('問答題')).toBeNull();
    expect(parseQuestionType('填空題')).toBeNull();
    expect(parseQuestionType('')).toBeNull();
    expect(parseQuestionType('   ')).toBeNull();
  });
});

describe('fileParsers - colRefToIndex', () => {
  it('converts single-letter column references to zero-based index', () => {
    expect(colRefToIndex('A')).toBe(0);
    expect(colRefToIndex('B')).toBe(1);
    expect(colRefToIndex('Z')).toBe(25);
    expect(colRefToIndex('a1')).toBe(0);
  });

  it('converts multi-letter column references to zero-based index', () => {
    expect(colRefToIndex('AA')).toBe(26);
    expect(colRefToIndex('AB')).toBe(27);
    expect(colRefToIndex('AZ')).toBe(51);
    expect(colRefToIndex('BA')).toBe(52);
  });

  it('safely handles cell references without leading letters', () => {
    expect(colRefToIndex('')).toBe(0);
    expect(colRefToIndex('123')).toBe(0);
  });
});

describe('fileParsers - parseCsvRows', () => {
  it('parses basic CSV content with commas and newlines', () => {
    const csv = 'A,B,C\r\n1,2,3\n4,5,6';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ['A', 'B', 'C'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ]);
  });

  it('handles fields with commas inside quotes', () => {
    const csv = '"Hello, World",Foo,"Bar, Baz"';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([['Hello, World', 'Foo', 'Bar, Baz']]);
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = '"He said ""Hi!""",Normal';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([['He said "Hi!"', 'Normal']]);
  });

  it('handles multiline fields enclosed in quotes', () => {
    const csv = '"Line 1\nLine 2",Simple\r\n"Another\r\nLine",Row2';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ['Line 1\nLine 2', 'Simple'],
      ['Another\r\nLine', 'Row2'],
    ]);
  });

  it('strips UTF-8 BOM if present', () => {
    const csv = '\uFEFFA,B\n1,2';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });
});

describe('fileParsers - parseCsvQuestions (Legacy helper)', () => {
  it('returns empty array if lines are insufficient', () => {
    expect(parseCsvQuestions('')).toEqual([]);
    expect(parseCsvQuestions('Header')).toEqual([]);
  });

  it('parses valid simple CSV questions', () => {
    const csv = 'ID,Content,Answer,Explanation\nQ-1,題目一,A,詳解一\n,題目二,B,詳解二';
    const result = parseCsvQuestions(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'Q-1',
      content: '題目一',
      correctAnswer: 'A',
      explanation: '詳解一',
    });
    expect(result[1].id).toBe('Q-UPLOAD-2');
    expect(result[1].content).toBe('題目二');
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
    expect(q1.difficulty).toBe('easy');
    expect(q1.points).toBe(2);
    expect(q1.tags).toEqual(['統計分析', 'Z分數', '描述性統計']);

    const q2 = result.questions[1];
    expect(q2.id).toBe('Q-BDA-1140202');
    expect(q2.difficulty).toBe('medium');
    expect(q2.imageUrl).toBe('https://lh3.googleusercontent.com/d/1A2B3C_DEMO_IMG');
  });

  it('supports JSON files wrapped in an object with a questions array', async () => {
    const wrappedJson = { questions: sampleJson.slice(0, 1) };
    const file = new File([JSON.stringify(wrappedJson)], 'wrapped.json', { type: 'application/json' });
    const result = await parseJsonExamFile(file);

    expect(result.isValid).toBe(true);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].id).toBe('Q-BDA-1140201');
  });

  it('supports JSON files wrapped in data or items, and stringified option object/array', async () => {
    const dataWrapped = {
      data: [
        {
          question: '題幹一',
          options: '{"A": "選項A", "B": "選項B"}',
          answer: 'A',
          difficulty: 'hard',
        },
      ],
    };
    const file1 = new File([JSON.stringify(dataWrapped)], 'data_wrapped.json', { type: 'application/json' });
    const res1 = await parseJsonExamFile(file1);
    expect(res1.isValid).toBe(true);
    expect(res1.questions[0].difficulty).toBe('hard');

    const itemsWrapped = {
      items: [
        {
          question: '題幹二',
          options: '["選項A", "選項B"]',
          answer: 'A',
          difficulty: 'easy',
        },
      ],
    };
    const file2 = new File([JSON.stringify(itemsWrapped)], 'items_wrapped.json', { type: 'application/json' });
    const res2 = await parseJsonExamFile(file2);
    expect(res2.isValid).toBe(true);
    expect(res2.questions[0].difficulty).toBe('easy');
  });

  it('handles non-object items in JSON array', async () => {
    const file = new File([JSON.stringify(['invalid_item', null])], 'bad_items.json', { type: 'application/json' });
    const result = await parseJsonExamFile(file);
    expect(result.isValid).toBe(false);
    expect(result.rowErrors).toHaveLength(2);
    expect(result.rowErrors[0].fieldErrors).toContain('題目資料必須為 JSON 物件');
  });

  it('detects and reports validation errors in JSON files', async () => {
    const invalidJson = [
      {
        test_id: 'Q-INVALID-1',
        question: '',
        option: { A: '選項A' },
        answer: '',
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

  it('reports error when JSON structure is not an array or object with questions', async () => {
    const file = new File(['"just a string"'], 'bad_type.json', { type: 'application/json' });
    const result = await parseJsonExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.fileError).toContain('未包含任何試題資料');
  });

  it('reports error when JSON file is invalid syntax', async () => {
    const file = new File(['{ invalid json'], 'corrupt.json', { type: 'application/json' });
    const result = await parseJsonExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.fileError).toContain('JSON 格式解析失敗');
  });
});

describe('fileParsers - validateAndParseExamFile (CSV and format validation)', () => {
  it('rejects unsupported file extensions', async () => {
    const file = new File(['some content'], 'exam.pdf', { type: 'application/pdf' });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.fileError).toContain('不支援的檔案格式「.pdf」');
  });

  it('rejects corrupt xlsx files that cannot be unzipped', async () => {
    const file = new File(['not a valid zip binary content'], 'corrupted.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.fileError).toContain('無法解析 Excel 檔案結構');
  });

  it('rejects empty files', async () => {
    const file = new File([''], 'empty.csv', { type: 'text/csv' });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.fileError).toContain('上傳的檔案內容為空白');
  });

  it('rejects CSV missing required headers', async () => {
    const invalidHeaderCsv = '學科,題型\n數學,單選題';
    const file = new File([invalidHeaderCsv], 'missing_headers.csv', { type: 'text/csv' });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.fileError).toContain('標題列缺少必要欄位');
  });

  it('successfully parses valid CSV with single-choice and true-false questions', async () => {
    const csv = [
      '所屬學科,試題類型,難度 (1~5),配分 (score),"題目時長 (time, 分鐘)",知識點標籤 (以逗號隔開),題目內文,選項 A,選項 B,選項 C,選項 D,正確解答,題目詳解 / 評分標準',
      '數學,單選題,2,5,3,"幾何, 三角形",直角三角形面積為何？,底乘高除二,底乘高,底加高,邊長平方,A,根據公式S=(1/2)*a*b',
      '國文,是非題,1,4,2,修辭,「沉魚落雁」常用於形容女子貌美。,正確 (True),錯誤 (False),,,A,沉魚落雁形容容貌美麗。',
    ].join('\n');

    const file = new File([csv], 'valid_exam.csv', { type: 'text/csv' });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(true);
    expect(result.rowErrors).toHaveLength(0);
    expect(result.questions).toHaveLength(2);

    const q1 = result.questions[0];
    expect(q1.subjectId).toBe('math');
    expect(q1.type).toBe('single');
    expect(q1.points).toBe(5);
    expect(q1.difficulty).toBe('easy');
    expect(q1.tags).toEqual(['幾何', '三角形']);
    expect(q1.options).toEqual(['底乘高除二', '底乘高', '底加高', '邊長平方']);
    expect(q1.correctAnswer).toBe('A');

    const q2 = result.questions[1];
    expect(q2.subjectId).toBe('chinese');
    expect(q2.type).toBe('true_false');
    expect(q2.options).toEqual(['正確 (True)', '錯誤 (False)']);
    expect(q2.correctAnswer).toBe('A');

    // Also test parseQuestionsFromUpload returns the same questions
    const uploadResult = await parseQuestionsFromUpload(file);
    expect(uploadResult).toHaveLength(2);
    expect(uploadResult[0].content).toBe(q1.content);
    expect(uploadResult[0].subjectId).toBe(q1.subjectId);
  });

  it('collects field errors for rows with invalid fields in CSV', async () => {
    const badCsv = [
      '所屬學科,試題類型,難度 (1~5),配分 (score),"題目時長 (time, 分鐘)",知識點標籤 (以逗號隔開),題目內文,選項 A,選項 B,選項 C,選項 D,正確解答,題目詳解 / 評分標準',
      ',未知題型,99,-5,0,,,,,,,',
      '數學,單選題,,,,,,,,,,,',
    ].join('\n');

    const file = new File([badCsv], 'bad_rows.csv', { type: 'text/csv' });
    const result = await validateAndParseExamFile(file);

    expect(result.isValid).toBe(false);
    expect(result.rowErrors).toHaveLength(2);
    expect(result.rowErrors[1].fieldErrors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('「難度 (1~5)」未填寫'),
        expect.stringContaining('「配分 (score)」未填寫'),
        expect.stringContaining('「題目時長 (time, 分鐘)」未填寫'),
      ])
    );
    const errors = result.rowErrors[0].fieldErrors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('「所屬學科」未填寫'),
        expect.stringContaining('「試題類型」內容無效'),
        expect.stringContaining('「難度 (1~5)」數值有誤'),
        expect.stringContaining('「配分 (score)」數值有誤'),
        expect.stringContaining('「題目時長 (time, 分鐘)」數值有誤'),
        expect.stringContaining('「知識點標籤 (以逗號隔開)」未填寫'),
        expect.stringContaining('「題目內文」未填寫'),
        expect.stringContaining('「選項 A」未填寫'),
        expect.stringContaining('「正確解答」未填寫'),
        expect.stringContaining('「題目詳解 / 評分標準」未填寫'),
      ])
    );
  });
});

describe('fileParsers - parseWrongQuestionsExcel', () => {
  it('throws error when file extension is not xlsx or csv', async () => {
    const file = new File(['data'], 'wrong.json', { type: 'application/json' });
    await expect(parseWrongQuestionsExcel(file)).rejects.toThrow('請上傳 .xlsx 或 .csv 格式之錯題檔案');
  });

  it('throws error when xlsx wrong file is corrupted', async () => {
    const file = new File(['bad xlsx binary content'], 'corrupted.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await expect(parseWrongQuestionsExcel(file)).rejects.toThrow('無法解析 Excel 檔案結構');
  });

  it('throws error when file has no data rows', async () => {
    const file = new File(['題號,題目\n'], 'empty_wrong.csv', { type: 'text/csv' });
    await expect(parseWrongQuestionsExcel(file)).rejects.toThrow('檔案中無任何錯題資料');
  });

  it('successfully parses CSV wrong questions with standard headers', async () => {
    const csv = [
      '題號,題目 id,學科,難度,題目,選項,考生答案,正確答案,作答結果,配分,得分,解析,交卷時間',
      '1,Q-WRONG-101,數學,易,1+1等於多少？,"[""1"", ""2"", ""3"", ""4""]",A,B,錯誤,5,0,基礎加法,1700000000000',
      '2,Q-WRONG-102,物理,難,動量守恆定律？,"A. 能量守恆\nB. 動量守恆",A,B,錯誤,10,0,牛頓運動定律,2026/11/25 10:00:00',
    ].join('\n');

    const file = new File([csv], 'wrong_questions.csv', { type: 'text/csv' });
    const result = await parseWrongQuestionsExcel(file);

    expect(result.questions).toHaveLength(2);
    expect(result.wrongRecords).toHaveLength(2);

    const q1 = result.questions[0];
    expect(q1.id).toBe('Q-WRONG-101');
    expect(q1.subjectId).toBe('math');
    expect(q1.difficulty).toBe('easy');
    expect(q1.options).toEqual(['1', '2', '3', '4']);

    const rec1 = result.wrongRecords[0];
    expect(rec1.questionId).toBe('Q-WRONG-101');
    expect(rec1.userAnswer).toBe('A');
    expect(rec1.correctAnswer).toBe('B');
    expect(rec1.status).toBe('錯誤');

    const q2 = result.questions[1];
    expect(q2.id).toBe('Q-WRONG-102');
    expect(q2.subjectId).toBe('physics');
    expect(q2.difficulty).toBe('hard');
    expect(q2.options).toEqual(['能量守恆', '動量守恆']);
  });

  it('falls back to validateAndParseExamFile when wrong question columns are not found', async () => {
    const examCsv = [
      '所屬學科,試題類型,難度 (1~5),配分 (score),"題目時長 (time, 分鐘)",知識點標籤 (以逗號隔開),題目內文,選項 A,選項 B,選項 C,選項 D,正確解答,題目詳解 / 評分標準',
      '化學,單選題,2,5,3,週期表,元素週期表第一個元素是？,氫,氦,鋰,鈹,A,原子序為1的元素為氫',
    ].join('\n');

    const file = new File([examCsv], 'fallback_exam.csv', { type: 'text/csv' });
    const result = await parseWrongQuestionsExcel(file);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].subjectId).toBe('chemistry');
    expect(result.wrongRecords).toHaveLength(1);
    expect(result.wrongRecords[0].userAnswer).toBe('未作答');
    expect(result.wrongRecords[0].status).toBe('錯誤');
  });

  it('throws error when neither wrong question nor valid exam headers are found in fallback', async () => {
    const randomCsv = '欄位甲,欄位乙\n資料一,資料二';
    const file = new File([randomCsv], 'random.csv', { type: 'text/csv' });
    await expect(parseWrongQuestionsExcel(file)).rejects.toThrow();
  });
});
