/**
 * 약관 본문 보기 모달.
 *
 * 회원가입 화면의 약관 동의 옆 '보기' 링크에서 호출.
 * 마크다운을 단순 텍스트 렌더로 표시 (라이브러리 없이) — # ## · | --- 만 처리.
 */
import { X } from "lucide-react";
import { useEffect, type ReactElement } from "react";
import type { TermDoc } from "../../lib/terms";
import { useLanguage, t } from "../../lib/i18n";

export function TermsModal({ term, onClose }: { term: TermDoc; onClose: () => void }) {
  const lang = useLanguage();
  // ESC 키 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // 배경 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={term.title}
        className="w-full sm:max-w-lg bg-white sm:rounded-[20px] rounded-t-[20px] overflow-hidden shadow-[var(--shadow-lifted)] flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-[var(--color-line)] flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[var(--color-ink-500)] uppercase tracking-wide">
              {term.required ? t("tmodal.required", lang) : t("tmodal.optional", lang)}
            </p>
            <h2 className="text-[16px] font-extrabold text-[var(--color-navy-900)] truncate">
              {term.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-[var(--color-ink-50)] inline-flex items-center justify-center"
            aria-label={t("tmodal.close", lang)}
          >
            <X className="w-5 h-5 text-[var(--color-ink-600)]" />
          </button>
        </div>

        {/* 왜 필요한지 강조 */}
        <div className="px-5 py-3 bg-[var(--color-mint-50)] border-b border-[var(--color-mint-200)] shrink-0">
          <p className="text-[11.5px] font-extrabold text-[var(--color-mint-700)] mb-0.5 uppercase tracking-wide">
            {t("tmodal.whyTitle", lang)}
          </p>
          <p className="text-[13px] text-[var(--color-mint-700)] font-semibold leading-relaxed">
            {term.why}
          </p>
        </div>

        {/* 본문 — 마크다운 평이 렌더 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-[13.5px] leading-relaxed text-[var(--color-ink-700)]">
          <MarkdownRender markdown={term.content} />
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-[var(--color-line)] flex items-center justify-between shrink-0 bg-[var(--color-bg)]">
          <span className="text-[11px] text-[var(--color-ink-500)] font-medium">
            v{term.version} · {term.lastUpdated}
          </span>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-full bg-[var(--color-navy-700)] text-white text-[12.5px] font-bold"
          >
            {t("tmodal.confirm", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 단순 마크다운 렌더 — 라이브러리 없이 핵심만
// ============================================================
function MarkdownRender({ markdown }: { markdown: string }) {
  const lines = markdown.trim().split("\n");
  const out: ReactElement[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (!line.trim()) { i++; continue; }

    // H1
    if (line.startsWith("# ")) {
      out.push(<h3 key={key++} className="text-[17px] font-extrabold text-[var(--color-navy-900)] mt-5 mb-2 first:mt-0">{line.slice(2)}</h3>);
      i++; continue;
    }
    // H2
    if (line.startsWith("## ")) {
      out.push(<h4 key={key++} className="text-[14.5px] font-extrabold text-[var(--color-navy-800)] mt-4 mb-1.5">{line.slice(3)}</h4>);
      i++; continue;
    }
    // H3
    if (line.startsWith("### ")) {
      out.push(<h5 key={key++} className="text-[13.5px] font-bold text-[var(--color-navy-700)] mt-3 mb-1">{line.slice(4)}</h5>);
      i++; continue;
    }
    // HR
    if (line.startsWith("---")) {
      out.push(<hr key={key++} className="border-t border-[var(--color-line)] my-3" />);
      i++; continue;
    }
    // 표
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(renderTable(tableLines, key++));
      continue;
    }
    // 리스트 (·, -)
    if (line.match(/^(\s*[-·]|\s*\d+\.)\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^(\s*[-·]|\s*\d+\.)\s/)) {
        items.push(lines[i].replace(/^(\s*[-·]|\s*\d+\.)\s/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-0.5">
          {items.map((it, idx) => (
            <li key={idx} className="text-[13px]"><InlineRender text={it} /></li>
          ))}
        </ul>
      );
      continue;
    }
    // 일반 단락
    out.push(<p key={key++} className="my-2 text-[13px]"><InlineRender text={line} /></p>);
    i++;
  }

  return <>{out}</>;
}

function renderTable(lines: string[], key: number): ReactElement {
  // |---|---| 행은 구분선이라 스킵
  const rows = lines.filter((l) => !l.match(/^\|[\s\-:|]+\|$/));
  const parsed = rows.map((row) =>
    row.split("|").slice(1, -1).map((c) => c.trim())
  );
  if (parsed.length === 0) return <span key={key} />;
  const [header, ...body] = parsed;
  return (
    <div key={key} className="my-3 overflow-x-auto rounded-[8px] border border-[var(--color-line)]">
      <table className="w-full text-[12.5px]">
        <thead className="bg-[var(--color-navy-50)]">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-2.5 py-1.5 text-left font-bold text-[var(--color-navy-700)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-line)]">
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci} className="px-2.5 py-1.5 align-top"><InlineRender text={c} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineRender({ text }: { text: string }) {
  // **bold** 만 처리
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="font-extrabold text-[var(--color-navy-900)]">{p.slice(2, -2)}</strong>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
