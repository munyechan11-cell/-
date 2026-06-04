import { Link } from "react-router-dom";
import { useLanguage, t } from "../lib/i18n";

export default function NotFound() {
  const lang = useLanguage();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-[var(--color-bg)]">
      <div className="text-7xl font-extrabold text-[var(--color-navy-700)] tracking-tighter">
        404
      </div>
      <p className="mt-3 text-[15px] text-[var(--color-ink-500)] font-medium">
        {t("notFound.desc", lang)}
      </p>
      <Link
        to="/"
        className="mt-8 h-12 px-6 inline-flex items-center rounded-[14px] bg-[var(--color-navy-700)] text-white font-bold"
      >
        {t("notFound.home", lang)}
      </Link>
    </div>
  );
}
