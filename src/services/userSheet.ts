import { Question, ExamPaper, ReadSpreadsheetResult } from '@/types';
import { extractSpreadsheetId, getOptionLetter } from '@/utils/sheetParser';
import {
  readAllTablesFromSpreadsheet,
  ensureSpreadsheetTablesExist,
  DATABASE_TABLE_SCHEMAS,
} from '@/services/publicSheet';
import { formatSheetTimestamp } from '@/utils/formatters';

/**
 * 私人 Sheet 存取服務 (動態依登入使用者的 google_sheet_URL 讀寫個人題庫、考卷與作答紀錄)
 */
export async function readUserPrivateSheet(
  accessToken: string | null,
  userSheetUrl: string
): Promise<ReadSpreadsheetResult> {
  const spreadsheetId = extractSpreadsheetId(userSheetUrl);
  if (!spreadsheetId) {
    throw new Error('無效的個人 Google 試算表網址 (google_sheet_URL)');
  }
  return readAllTablesFromSpreadsheet(accessToken, spreadsheetId);
}

/**
 * 在使用者的 Google Drive 自動建立專屬題庫試算表
 * 僅建立 4 張核心工作表：test_bank, quiz_bank_publish, quiz_bank_unpublish, log
 * 並自動寫入公用格式標準標題列
 */
export async function createPersonalDatabaseSpreadsheet(
  accessToken: string,
  title: string = '個人專屬題庫 (Personal Test Bank)'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const targetTables = ['test_bank', 'quiz_bank_publish', 'quiz_bank_unpublish', 'log'];
  const sheetsPayload = targetTables.map((tableName, index) => ({
    properties: {
      sheetId: index + 100,
      title: tableName,
      gridProperties: {
        frozenRowCount: 1,
        rowCount: 100,
        columnCount: (DATABASE_TABLE_SCHEMAS[tableName]?.columns.length || 10) + 2,
      },
    },
  }));

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'zh_TW',
      },
      sheets: sheetsPayload,
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `建立個人 Google 試算表失敗 (${createRes.status})`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl = createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 寫入公用格式標題
  const batchData = targetTables.map((tableName) => {
    const standardColumns = DATABASE_TABLE_SCHEMAS[tableName]?.columns || [];
    const labels = standardColumns.map((c) => c.label);
    if (
      (tableName === 'quiz_bank_publish' || tableName === 'quiz_bank_unpublish') &&
      !labels.includes('test_id')
    ) {
      labels.push('test_id');
    }
    return {
      range: `${tableName}!A1`,
      values: [labels],
    };
  });

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: batchData,
    }),
  });

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * 檢查並自動初始化個人 Google 試算表的分頁與標準欄位格式
 * 1. 檢查是否存在核心分頁：test_bank, quiz_bank_publish, quiz_bank_unpublish, log
 * 2. 若缺少分頁，自動呼叫 addSheet 建立新分頁
 * 3. 檢查分頁第一行欄位標題是否符合，不符合或為空則填入標準標題列
 * 4. 容錯：使用者後續刪除未使用的分頁也不會影響系統讀取
 */
export async function ensurePersonalSpreadsheetTablesExist(
  accessToken: string,
  userSheetUrl: string
): Promise<{ createdSheets: string[]; updatedHeaders: string[] }> {
  const spreadsheetId = extractSpreadsheetId(userSheetUrl);
  if (!spreadsheetId) {
    throw new Error('無效的個人 Google 試算表網址 (google_sheet_URL)');
  }

  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `無法讀取個人試算表資訊 (${metaRes.status})`);
  }
  const metaData = await metaRes.json();
  const existingTitles = new Set<string>((metaData.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title));

  const targetSheets = ['test_bank', 'quiz_bank_publish', 'quiz_bank_unpublish', 'log'];
  const missingSheets = targetSheets.filter((title) => !existingTitles.has(title));
  const createdSheets: string[] = [];

  if (missingSheets.length > 0) {
    const requests = missingSheets.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { rowCount: 100, columnCount: 15 },
        },
      },
    }));

    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!addRes.ok) {
      const err = await addRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `自動建立個人試算表分頁失敗 (${addRes.status})`);
    }

    createdSheets.push(...missingSheets);
    missingSheets.forEach((t) => existingTitles.add(t));
  }

  // 檢查所有目標分頁第一列標題格式
  const updatedHeaders: string[] = [];
  const sheetsToCheck = targetSheets.filter((t) => existingTitles.has(t));
  if (sheetsToCheck.length > 0) {
    const ranges = sheetsToCheck.map((t) => `${t}!A1:Z1`);
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const headerDataMap: Record<string, string[]> = {};
    if (headerRes.ok) {
      const hJson = await headerRes.json();
      (hJson.valueRanges || []).forEach((vr: { range?: string; values?: unknown[][] }) => {
        const title = (vr.range || '').split('!')[0].replace(/['"]/g, '');
        headerDataMap[title] = (vr.values?.[0] || []).map((v: unknown) => String(v || '').trim().toLowerCase());
      });
    }

    const updates: { range: string; values: string[][] }[] = [];
    for (const title of sheetsToCheck) {
      const standardColumns = DATABASE_TABLE_SCHEMAS[title]?.columns || [];
      const standardLabels = standardColumns.map((c) => c.label);
      if (
        (title === 'quiz_bank_publish' || title === 'quiz_bank_unpublish') &&
        !standardLabels.includes('test_id')
      ) {
        standardLabels.push('test_id');
      }

      const existingHeader = headerDataMap[title] || [];
      const isHeaderMissingOrEmpty =
        existingHeader.length === 0 ||
        !existingHeader.includes('id') ||
        (title === 'test_bank' && !existingHeader.includes('question')) ||
        (title === 'quiz_bank_publish' && !existingHeader.includes('title'));

      if (isHeaderMissingOrEmpty) {
        updates.push({
          range: `${title}!A1`,
          values: [standardLabels],
        });
        updatedHeaders.push(title);
      }
    }

    if (updates.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: updates,
        }),
      });
    }
  }

  return { createdSheets, updatedHeaders };
}

export async function appendQuestionToUserSheet(
  accessToken: string | null,
  userSheetUrl: string,
  question: Question,
  rowIndex: number = 1
): Promise<{ success: boolean; message: string }> {
  const spreadsheetId = extractSpreadsheetId(userSheetUrl);
  if (!spreadsheetId) {
    throw new Error('無效的個人 Google 試算表網址 (google_sheet_URL)');
  }

  if (!accessToken) {
    throw new Error('需完成 Google 帳號授權，才能將題目寫入個人試算表');
  }

  // 確保個人試算表具備標準分頁與標題
  await ensurePersonalSpreadsheetTablesExist(accessToken, userSheetUrl);

  const categoryId = question.categoryId || 0;
  const optionsMapOrList = question.options || (question as { optionsMap?: unknown }).optionsMap;
  let optionsStr = '';
  if (Array.isArray(optionsMapOrList)) {
    const obj: Record<string, string> = {};
    (optionsMapOrList as (string | { text?: string })[]).forEach((opt, i: number) => {
      obj[getOptionLetter(i)] = typeof opt === 'string' ? opt : (opt?.text || '');
    });
    optionsStr = JSON.stringify(obj);
  } else if (typeof optionsMapOrList === 'object' && optionsMapOrList !== null) {
    optionsStr = JSON.stringify(optionsMapOrList);
  }

  const diffScore =
    question.difficultyScore ??
    (question.difficulty === 'hard' ? 4 : question.difficulty === 'medium' ? 3 : 2);
  const tagsStr = Array.isArray(question.tags) ? question.tags.join(', ') : '';
  const nowTimestamp = formatSheetTimestamp();

  const rowValues = [
    rowIndex,
    question.id,
    categoryId,
    question.subjectId,
    question.type,
    question.content,
    optionsStr,
    question.correctAnswer,
    question.points,
    diffScore,
    question.explanation || '',
    tagsStr,
    nowTimestamp,
  ];

  // 直接使用 REST API 寫入使用者的個人試算表，不走公用 GAS 代理
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/test_bank!A:M:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `寫入題目至個人試算表失敗 (${res.status})`);
  }

  return {
    success: true,
    message: `題目 [${question.id}] 已成功寫入個人 Google 試算表 test_bank 表！`,
  };
}

export async function appendExamToUserSheet(
  accessToken: string | null,
  userSheetUrl: string,
  exam: ExamPaper,
  rowIndex: number = 1
): Promise<{ success: boolean; message: string }> {
  const spreadsheetId = extractSpreadsheetId(userSheetUrl);
  if (!spreadsheetId) {
    throw new Error('無效的個人 Google 試算表網址 (google_sheet_URL)');
  }

  if (!accessToken) {
    throw new Error('需完成 Google 帳號授權，才能將試卷寫入個人試算表');
  }

  // 確保個人試算表具備標準分頁與標題
  await ensurePersonalSpreadsheetTablesExist(accessToken, userSheetUrl);

  const targetSheet = exam.status === 'published' ? 'quiz_bank_publish' : 'quiz_bank_unpublish';
  const nowTimestamp = formatSheetTimestamp();

  const rowValues = [
    rowIndex,
    exam.id,
    exam.title,
    exam.subject,
    exam.difficultyLv,
    exam.questionCount,
    exam.totalScore,
    exam.durationMinutes,
    nowTimestamp,
    exam.questionIds ? exam.questionIds.join(', ') : '',
  ];

  // 直接使用 REST API 寫入使用者的個人試算表，不走公用 GAS 代理
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${targetSheet}!A:J:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `寫入考卷至個人試算表失敗 (${res.status})`);
  }

  return {
    success: true,
    message: `考卷 [${exam.id}] 已成功寫入個人 Google 試算表 ${targetSheet}！`,
  };
}

/**
 * 當衝突解決選擇「以本地為主，更新線上」時：
 * 將本地個人題庫與個人試卷完整覆蓋寫入使用者的個人 Google Sheet (test_bank, quiz_bank_publish)
 */
export async function syncPersonalDataToUserSheet(
  accessToken: string,
  userSheetUrl: string,
  questions: Question[],
  exams: ExamPaper[]
): Promise<{ success: boolean; message: string }> {
  const spreadsheetId = extractSpreadsheetId(userSheetUrl);
  if (!spreadsheetId) {
    throw new Error('無效的個人 Google 試算表網址 (google_sheet_URL)');
  }

  await ensureSpreadsheetTablesExist(accessToken, spreadsheetId);

  // 清空使用者的 test_bank 與 quiz_bank_publish 既有內容
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: ['test_bank!A1:Z', 'quiz_bank_publish!A1:Z'],
      }),
    });
  } catch (err) {
    console.warn('Clear user sheet warning:', err);
  }

  // 1. 產生 test_bank 資料
  const testBankHeaders = DATABASE_TABLE_SCHEMAS.test_bank.columns.map((c) => c.label);
  const now = formatSheetTimestamp();
  const testBankRows: (string | number)[][] = [
    testBankHeaders,
    ...questions.map((q, idx) => {
      let optionStr = '';
      if (q.option) {
        optionStr = q.option;
      } else if (q.options && q.options.length > 0) {
        optionStr = JSON.stringify(q.options);
      } else if (q.optionsMap) {
        optionStr = JSON.stringify(q.optionsMap);
      }
      return [
        idx + 1,
        q.id || q.test_id || `Q-${idx + 1}`,
        q.content || q.question || '',
        optionStr,
        q.correctAnswer || q.answer || '',
        q.explanation || '',
        Number(q.difficultyScore ?? 3),
        Number(q.points ?? 10),
        Number(q.categoryId ?? 0),
        Array.isArray(q.tags) ? q.tags.join(', ') : (q.tags || ''),
        q.updatedAt || now,
        Number(q.updatedBy ?? 1),
        Number(q.time ?? 1),
      ];
    }),
  ];

  // 2. 產生 quiz_bank_publish 資料
  const pubHeaders = [...DATABASE_TABLE_SCHEMAS.quiz_bank_publish.columns.map((c) => c.label), 'test_id'];
  const pubRows: (string | number)[][] = [
    pubHeaders,
    ...exams.map((e, idx) => [
      idx + 1,
      e.id,
      e.title,
      e.subject,
      e.difficultyLv ?? 3,
      e.questionCount ?? 0,
      e.totalScore ?? 100,
      e.durationMinutes ?? 30,
      e.createdAt || now,
      e.questionIds ? e.questionIds.join(', ') : '',
    ]),
  ];

  const batchData = [
    { range: 'test_bank!A1', values: testBankRows },
    { range: 'quiz_bank_publish!A1', values: pubRows },
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `寫入個人試算表失敗 (${res.status})`);
  }

  return {
    success: true,
    message: `已成功將本地 ${questions.length} 題個人試題與 ${exams.length} 份個人試卷同步寫入至個人 Google Sheet！`,
  };
}

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  url: string;
  modifiedTime?: string;
  isPersonalDatabase?: boolean;
}

/**
 * 查詢使用者 Google Drive 內的試算表，自動尋找題庫試算表
 */
export async function searchPersonalSpreadsheetsInDrive(
  accessToken: string
): Promise<DriveSpreadsheetItem[]> {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime desc&pageSize=30`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `查詢雲端硬碟試算表失敗 (${res.status})`);
  }

  const data = await res.json();
  const files: { id: string; name?: string; webViewLink?: string; modifiedTime?: string }[] = data.files || [];

  return files.map((file) => {
    const nameLower = (file.name || '').toLowerCase();
    const isPersonal =
      nameLower.includes('個人專屬題庫') ||
      nameLower.includes('personal test bank') ||
      nameLower.includes('題庫') ||
      nameLower.includes('test bank') ||
      nameLower.includes('quiz');

    return {
      id: file.id,
      name: file.name,
      url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
      modifiedTime: file.modifiedTime,
      isPersonalDatabase: isPersonal,
    };
  });
}

export interface WrongQuestionRecord {
  id: string;
  submitTime: string;
  examTitle: string;
  questionId: string;
  prompt: string;
  options: { id: string; text: string }[];
  actual: string[];
  expected: string[];
  status: 'wrong' | 'unanswered';
  difficulty: string;
  subject: string;
  explanation: string;
}

/**
 * 從使用者的個人 Google 試算表讀取 'Review notebook' 錯題紀錄
 */
export async function fetchWrongQuestionsFromUserSheet(
  accessToken: string | null,
  userSheetUrl: string
): Promise<{ questions: Question[]; records: WrongQuestionRecord[] }> {
  const spreadsheetId = extractSpreadsheetId(userSheetUrl);
  if (!spreadsheetId) {
    throw new Error('無效的個人 Google 試算表網址 (google_sheet_URL)');
  }

  let rows: string[][] = [];

  // 1. 若有 token 優先以 REST API 讀取
  if (accessToken) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Review notebook'!A1:K`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        rows = data.values || [];
      }
    } catch (e) {
      console.warn('REST API fetch Review notebook failed, falling back to gviz:', e);
    }
  }

  // 2. 降級使用 gviz 讀取公開試算表
  if (rows.length === 0) {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent('Review notebook')}`;
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?\s*$/);
      if (match && match[1]) {
        const json = JSON.parse(match[1]);
        if (json.table?.rows) {
          rows = (json.table.rows as { c?: { v?: unknown }[] }[]).map((r) =>
            (r.c || []).map((cell) => (cell?.v !== undefined && cell?.v !== null ? String(cell.v) : ''))
          );
        }
      }
    }
  }

  if (rows.length === 0) {
    return { questions: [], records: [] };
  }

  // 排除標題列 (若第一列是交卷時間等標題)
  const dataRows = (rows[0][0] || '').includes('交卷時間') || (rows[0][0] || '').includes('Timestamp')
    ? rows.slice(1)
    : rows;

  const questions: Question[] = [];
  const records: WrongQuestionRecord[] = [];

  dataRows.forEach((row, idx) => {
    // 欄位對應:
    // 0: submitTime, 1: examTitle, 2: questionId, 3: prompt, 4: optionsStr,
    // 5: actual, 6: expected, 7: status, 8: difficulty, 9: subject, 10: explanation
    const submitTime = row[0] || '';
    const examTitle = row[1] || '';
    const questionId = row[2] || `WRONG-Q-${idx + 1}`;
    const prompt = row[3] || '';
    const optionsStr = row[4] || '';
    const actualStr = row[5] || '';
    const expectedStr = row[6] || '';
    const statusStr = row[7] || '';
    const difficultyStr = row[8] || '中等';
    const subjectStr = row[9] || '綜合';
    const explanation = row[10] || '';

    // 解析 options: 例如 "A. 選項內容\nB. 選項內容"
    const parsedOptions: { id: string; text: string }[] = [];
    if (optionsStr) {
      const lines = optionsStr.split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        const m = trimmed.match(/^([A-Ea-e1-9])[\.\:\、\s](.+)$/);
        if (m) {
          parsedOptions.push({ id: m[1].toUpperCase(), text: m[2].trim() });
        } else if (trimmed) {
          const letter = getOptionLetter(parsedOptions.length);
          parsedOptions.push({ id: letter, text: trimmed });
        }
      });
    }

    if (parsedOptions.length === 0) {
      parsedOptions.push(
        { id: 'A', text: '選項 A' },
        { id: 'B', text: '選項 B' },
        { id: 'C', text: '選項 C' },
        { id: 'D', text: '選項 D' }
      );
    }

    const actual = actualStr.split(/[,、\s]+/).filter(Boolean);
    const expected = expectedStr.split(/[,、\s]+/).filter(Boolean);
    const status: 'wrong' | 'unanswered' =
      statusStr.includes('未作答') || actual.length === 0 ? 'unanswered' : 'wrong';

    const subjectId =
      subjectStr.includes('國') ? 'chinese' :
        subjectStr.includes('英') ? 'english' :
          subjectStr.includes('數') ? 'math' :
            subjectStr.includes('物') ? 'physics' :
              subjectStr.includes('化') ? 'chemistry' :
                subjectStr.includes('生') ? 'biology' :
                  subjectStr.includes('歷') ? 'history' :
                    subjectStr.includes('地') ? 'geography' : 'math';

    const difficulty: 'easy' | 'medium' | 'hard' =
      difficultyStr.includes('難') || difficultyStr.includes('hard') ? 'hard' :
        difficultyStr.includes('易') || difficultyStr.includes('簡') || difficultyStr.includes('easy') ? 'easy' : 'medium';

    const qItem: Question = {
      id: questionId,
      categoryId: 1,
      subjectId,
      type: expected.length > 1 ? 'multiple' : 'single',
      content: prompt,
      options: parsedOptions.map((o) => `${o.id}. ${o.text}`),
      optionsMap: Object.fromEntries(parsedOptions.map((o) => [o.id, o.text])),
      correctAnswer: expected.join(','),
      points: 5,
      difficulty,
      explanation,
      tags: [subjectStr, difficultyStr, '錯題複習'],
      updatedAt: formatSheetTimestamp(),
    };

    questions.push(qItem);
    records.push({
      id: questionId,
      submitTime,
      examTitle,
      questionId,
      prompt,
      options: parsedOptions,
      actual,
      expected,
      status,
      difficulty: difficultyStr,
      subject: subjectStr,
      explanation,
    });
  });

  return { questions, records };
}
