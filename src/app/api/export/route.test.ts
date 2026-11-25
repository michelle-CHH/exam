import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

describe('/api/export API Route Handler', () => {
  it('成功接收有效 JSON 酬載時，應回傳 200 與包含 exportedAt 及 payload 的回應', async () => {
    const payload = {
      examId: 'EXAM-2024-MATH-001',
      studentName: '測試學生',
      score: 85,
      answers: { q1: ['A'], q2: ['B', 'C'] },
    };

    const req = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.payload).toEqual(payload);
    expect(typeof json.exportedAt).toBe('string');
  });

  it('當請求主體非合法 JSON 格式時，應捕捉例外並回傳 400 錯誤狀態', async () => {
    const brokenReq = {
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    } as unknown as NextRequest;

    const res = await POST(brokenReq);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('Unexpected token in JSON');
  });

  it('當拋出的例外非 Error 物件時，應提供預設錯誤字串', async () => {
    const brokenReq = {
      json: async () => {
        throw '非標準錯誤字串';
      },
    } as unknown as NextRequest;

    const res = await POST(brokenReq);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('匯出失敗');
  });
});
