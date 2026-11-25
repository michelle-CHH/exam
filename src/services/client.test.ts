import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { googleSheetsRequest } from './client';

describe('client - googleSheetsRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends request with correct authorization header and relative URL', async () => {
    const mockData = { spreadsheetId: 'test-id' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await googleSheetsRequest('/v4/spreadsheets/test-id', {
      accessToken: 'mock-token-123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sheets.googleapis.com/v4/spreadsheets/v4/spreadsheets/test-id',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token-123',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('preserves full URL if endpoint starts with http', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await googleSheetsRequest('https://custom.api.com/sheets', {
      accessToken: 'custom-token',
      headers: { 'X-Custom-Header': 'custom-val' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.api.com/sheets',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer custom-token',
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-val',
        }),
      })
    );
  });

  it('throws custom error message from API response when !response.ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({
        error: { message: 'The caller does not have permission' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      googleSheetsRequest('/values', { accessToken: 'invalid-token' })
    ).rejects.toThrow('The caller does not have permission');
  });

  it('throws fallback status error message when error JSON cannot be parsed or lacks message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      googleSheetsRequest('/values', { accessToken: 'token' })
    ).rejects.toThrow('Google Sheets API 請求失敗 (500)');
  });
});
