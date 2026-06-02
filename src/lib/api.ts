/**
 * API base URL 헬퍼.
 *
 * - Static Site 분리 후: VITE_API_URL 환경변수에 API 서비스 주소 지정
 *   예: https://gyeol-api.onrender.com
 * - 통합 배포(로컬 개발·과거 단일 서비스): VITE_API_URL 미설정 → same-origin 호출
 *
 * 사용:
 *   import { api } from "./lib/api";
 *   await fetch(api("/api/ai/floor-plan"), { ... });
 */
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const api = (path: string): string => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return BASE ? `${BASE}${p}` : p;
};
