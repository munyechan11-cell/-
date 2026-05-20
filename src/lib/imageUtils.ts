// 클라이언트 이미지 리사이즈 + JPEG 압축.
// Firestore 1MB 문서 한도와 모바일 메모리 보호를 위해 긴 변 1280px, JPEG q=0.75 기본.

const MAX_SIDE = 1280;
const QUALITY = 0.75;

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const resizeDataUrl = (
  dataUrl: string,
  maxSide: number = MAX_SIDE,
  quality: number = QUALITY
): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const longSide = Math.max(w, h);
      const scale = longSide > maxSide ? maxSide / longSide : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas context 사용 불가'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = dataUrl;
  });

export const fileToCompressedDataUrl = async (file: File): Promise<string> => {
  const raw = await fileToDataUrl(file);
  return resizeDataUrl(raw);
};

// 대략적 base64 바이트 추정 (data URL 헤더 제외, 4/3 비율 보정)
export const estimateBytes = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor(base64.length * 0.75);
};
