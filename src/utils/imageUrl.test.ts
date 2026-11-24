import { describe, expect, it } from 'vitest';
import { normalizeGoogleDriveImageUrl } from '@/utils/imageUrl';

describe('normalizeGoogleDriveImageUrl', () => {
  it('converts standard Google Drive share links to lh3 direct image links', () => {
    const shareUrl = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing';
    const expected = 'https://lh3.googleusercontent.com/d/1A2B3C4D5E6F7G8H9I0J';
    expect(normalizeGoogleDriveImageUrl(shareUrl)).toBe(expected);
  });

  it('converts Google Drive uc / open query links to lh3 direct image links', () => {
    const ucUrl = 'https://drive.google.com/uc?id=XYZ123_456-abc&export=download';
    const expected = 'https://lh3.googleusercontent.com/d/XYZ123_456-abc';
    expect(normalizeGoogleDriveImageUrl(ucUrl)).toBe(expected);
  });

  it('preserves existing lh3 Googleusercontent direct image links', () => {
    const lh3Url = 'https://lh3.googleusercontent.com/d/1A2B3C4D5E6F7G8H9I0J';
    expect(normalizeGoogleDriveImageUrl(lh3Url)).toBe(lh3Url);
  });

  it('preserves base64 data URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(normalizeGoogleDriveImageUrl(dataUrl)).toBe(dataUrl);
  });

  it('returns empty string for empty or null inputs', () => {
    expect(normalizeGoogleDriveImageUrl('')).toBe('');
    expect(normalizeGoogleDriveImageUrl(undefined)).toBe('');
  });
});
