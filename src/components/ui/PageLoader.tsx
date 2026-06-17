import { useLanguage, t } from "../../lib/i18n";
import { GyeolMark } from "./GyeolMark";

export function PageLoader({ label }: { label?: string }) {
  const lang = useLanguage();
  const text = label ?? t("loader.connecting", lang);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center px-6">
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-navy-100)]" />
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--color-navy-700)] border-r-[var(--color-mint-500)] animate-[spin_.9s_linear_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <GyeolMark className="w-10 h-10 rounded-[11px]" />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-[var(--color-ink-500)] tracking-tight">{text}</p>
    </div>
  );
}
