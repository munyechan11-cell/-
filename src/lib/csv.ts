/**
 * CSV 파일 생성·다운로드 헬퍼.
 *
 * 한국어 엑셀 호환:
 * - UTF-8 BOM (﻿) 추가 — Excel for Windows 가 인코딩을 정확히 인식
 * - 콤마/큰따옴표/줄바꿈 포함 셀은 자동 큰따옴표 인용
 * - 큰따옴표 안에서는 `"` 를 `""` 로 이스케이프
 *
 * 사용:
 *   downloadCsv(
 *     "고객명단_2026-06-02.csv",
 *     ["이름", "전화번호", "등급"],
 *     [
 *       ["홍길동", "010-1234-5678", "VIP"],
 *       ["김영희", "010-9999-9999", "신규"],
 *     ]
 *   );
 */

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // 콤마, 따옴표, 줄바꿈 포함 시 인용 필요
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: CsvCell[][]): string {
  const head = headers.map(escapeCell).join(",");
  const body = rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
  // ﻿: UTF-8 BOM — 한국어 엑셀 호환의 핵심
  return "﻿" + head + "\r\n" + body;
}

export function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const csv = rowsToCsv(headers, rows);
  // text/csv;charset=utf-8 명시 — 일부 브라우저가 다른 인코딩으로 추정하는 사고 방지
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/** 오늘 날짜를 YYYY-MM-DD 형식 문자열로 (파일명용) */
export function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
