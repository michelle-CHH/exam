/**
 * Google Drive 分享連結與圖床網址正規化工具
 */
export function normalizeGoogleDriveImageUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 若為 Base64 Data URL 則直接回傳
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // 若已是 Googleusercontent 圖片直連網址
  if (trimmed.includes('lh3.googleusercontent.com/d/')) {
    return trimmed;
  }

  // 1. Google Drive 檔案分享連結：https://drive.google.com/file/d/{FILE_ID}/view...
  const fileDMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  // 2. Google Drive open?id={FILE_ID} 或 uc?id={FILE_ID}
  const idMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  return trimmed;
}
