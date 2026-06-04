import { MobileShell } from "../components/layout/MobileShell";
import { TopBar } from "../components/ui/TopBar";
import { useLanguage, t } from "../lib/i18n";

export function Stub({ title, note }: { title: string; note?: string }) {
  const lang = useLanguage();
  return (
    <MobileShell>
      <TopBar title={title} back />
      <div className="px-6 pt-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-navy-50)] text-[var(--color-navy-700)] text-2xl font-extrabold mb-4">
          ⚙
        </div>
        <h2 className="text-xl font-extrabold text-[var(--color-navy-900)] tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-[14px] text-[var(--color-ink-500)]">
          {note ?? t("stub.note", lang)}
        </p>
      </div>
    </MobileShell>
  );
}

export default function StubPage() {
  const lang = useLanguage();
  return <Stub title={t("stub.title", lang)} />;
}
