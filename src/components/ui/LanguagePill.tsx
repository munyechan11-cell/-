/**
 * 컴팩트한 언어 전환 칩.
 * 로그인 이전 화면(손님 진입, 사장님/직원 로그인)에서 우상단에 노출해
 * 외국인 손님이 한국어 UI를 만나기 전에 즉시 자기 언어로 전환할 수 있게 한다.
 *
 * 동작: Globe 아이콘 버튼 클릭 → 드롭다운에서 4개 언어 중 선택.
 */
import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { LANGS, useLanguage, setLanguage, t } from "../../lib/i18n";

export function LanguagePill() {
  const lang = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = LANGS.find((l) => l.code === lang);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("langPill.change", lang)}
        className="h-9 px-3 rounded-full bg-white border border-[var(--color-line)] inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-navy-800)] hover:border-[var(--color-mint-500)] transition-colors"
      >
        <Globe className="w-3.5 h-3.5 text-[var(--color-ink-500)]" />
        <span>{current?.native ?? lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[44px] z-50 w-[160px] bg-white border border-[var(--color-line)] rounded-[14px] shadow-[var(--shadow-lifted)] py-1.5 overflow-hidden">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
              className="w-full px-3 py-2 inline-flex items-center justify-between gap-2 text-left hover:bg-[var(--color-bg)]"
            >
              <span className="text-[13px] font-semibold text-[var(--color-ink-700)]">{l.native}</span>
              {lang === l.code && <Check className="w-4 h-4 text-[var(--color-mint-700)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
