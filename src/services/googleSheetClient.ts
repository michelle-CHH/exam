/**
 * Google Sheets REST API & GAS 底層連線輔助函式庫
 * 提供統一的驗證 Header 注入、請求派送與錯誤訊息解碼
 */

export interface CreatedSpreadsheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * 建立全新 Google 試算表 (Google Sheets API v4)
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  payload: {
    title: string;
    sheets: unknown[];
    locale?: string;
    autoRecalc?: string;
  },
  errorLabel = '建立 Google 試算表'
): Promise<CreatedSpreadsheetResult> {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: payload.title,
        locale: payload.locale || 'zh_TW',
        ...(payload.autoRecalc ? { autoRecalc: payload.autoRecalc } : {}),
      },
      sheets: payload.sheets,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `${errorLabel}失敗 (${res.status})`);
  }

  const createdData = await res.json();
  const spreadsheetId = createdData.spreadsheetId;
  const spreadsheetUrl =
    createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * 讀取試算表 Metadata（分頁清單等結構）
 */
export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
  errorLabel = '試算表資訊'
): Promise<{ sheets?: Array<{ properties?: { title?: string; sheetId?: number } }> }> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `無法讀取${errorLabel} (${metaRes.status})`);
  }

  return metaRes.json();
}

/**
 * 批次更新試算表結構（如新增分頁、凍結列等 batchUpdate）
 */
export async function batchUpdateSpreadsheetRequests(
  accessToken: string,
  spreadsheetId: string,
  requests: unknown[],
  errorLabel = '更新試算表結構'
): Promise<unknown> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${errorLabel}失敗 (${res.status})`);
  }

  return res.json();
}

/**
 * 批次寫入試算表儲存格資料（values:batchUpdate）
 */
export async function batchUpdateSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  data: Array<{ range: string; values: unknown[][] }>,
  valueInputOption = 'USER_ENTERED',
  errorLabel = '寫入試算表資料'
): Promise<unknown> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption,
        data,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${errorLabel}失敗 (${res.status})`);
  }

  return res.json();
}

/**
 * 單筆/批次將資料列附加至試算表尾端（values:append）
 */
export async function appendSpreadsheetRowValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rowValues: unknown[],
  errorLabel = '寫入資料至試算表'
): Promise<unknown> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${errorLabel}失敗 (${res.status})`);
  }

  return res.json();
}
