import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './route';

describe('/api/sheet BFF Route Handler', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('GET 方法 (Google Sheet gviz 查詢代理)', () => {
    it('未傳入任何 request 參數時，應安全回傳伺服器是否配置試算表之狀態', async () => {
      const res = await GET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(typeof json.configured).toBe('boolean');
    });

    it('請求中無 spreadsheetId 與 sheet query params 時，應回傳基本配置狀態', async () => {
      const req = new Request('http://localhost:3000/api/sheet');
      const res = await GET(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(typeof json.configured).toBe('boolean');
    });

    it('提供無效的試算表 ID 時，應回傳 400 錯誤狀態', async () => {
      // 傳遞空白的 spreadsheetId 且無預設環境變數
      const originalEnv = process.env.GOOGLE_SHEET_URL;
      const originalNextPublicEnv = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;
      delete process.env.GOOGLE_SHEET_URL;
      delete process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;

      try {
        const req = new Request('http://localhost:3000/api/sheet?spreadsheetId=&sheet=test_bank');
        const res = await GET(req);
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error).toContain('未提供有效的試算表 ID');
      } finally {
        process.env.GOOGLE_SHEET_URL = originalEnv;
        process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL = originalNextPublicEnv;
      }
    });

    it('上游 Google Sheet gviz 回應成功時，應回傳原始文字資料與 200', async () => {
      const mockRawGvizText = '/*O_o*/\ngoogle.visualization.Query.setResponse({"status":"ok"});';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockRawGvizText,
      } as unknown as Response);

      const req = new Request('http://localhost:3000/api/sheet?spreadsheetId=mock-sheet-id&sheet=test_bank');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');
      const text = await res.text();
      expect(text).toBe(mockRawGvizText);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://docs.google.com/spreadsheets/d/mock-sheet-id/gviz/tq'),
        expect.any(Object)
      );
    });

    it('上游 Google Sheet 回應 HTTP 錯誤 (如 404) 時，應正確透通錯誤狀態碼', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      const req = new Request('http://localhost:3000/api/sheet?spreadsheetId=non-existent-id&sheet=test_bank');
      const res = await GET(req);

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain('404');
    });

    it('當底層網路連線拋出異常時，應安全捕獲並回傳 500 錯誤狀態', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

      const req = new Request('http://localhost:3000/api/sheet?spreadsheetId=mock-sheet-id&sheet=test_bank');
      const res = await GET(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe('DNS resolution failed');
    });
  });

  describe('POST 方法 (GAS 寫入/刪除代理)', () => {
    it('未設定 scriptUrl 且環境變數為空時，應回傳 500 提示未配置 GAS endpoint', async () => {
      const originalEnv = process.env.GOOGLE_SCRIPT_URL;
      const originalNextPublicEnv = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
      delete process.env.GOOGLE_SCRIPT_URL;
      delete process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

      try {
        const req = new Request('http://localhost:3000/api/sheet', {
          method: 'POST',
          body: JSON.stringify({ action: 'append', payload: {} }),
          headers: { 'Content-Type': 'application/json' },
        });

        const res = await POST(req);
        expect(res.status).toBe(500);

        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error).toContain('GAS endpoint not configured');
      } finally {
        process.env.GOOGLE_SCRIPT_URL = originalEnv;
        process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL = originalNextPublicEnv;
      }
    });

    it('正常提供 scriptUrl 與酬載時，應轉發至 GAS 並回傳執行結果', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, insertedRow: 42 }),
      } as unknown as Response);

      const req = new Request('http://localhost:3000/api/sheet', {
        method: 'POST',
        body: JSON.stringify({
          scriptUrl: 'https://script.google.com/macros/s/AKfycby_mock/exec',
          payload: { action: 'insert_question', id: 'Q1' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ success: true, insertedRow: 42 });
    });

    it('當請求主體無法解析或發生未知異常時，應回傳 500 錯誤', async () => {
      const brokenReq = {
        json: async () => {
          throw new Error('Malformed JSON payload');
        },
      } as unknown as Request;

      const res = await POST(brokenReq);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe('Malformed JSON payload');
    });
  });
});
