import { MobileShell } from "../components/layout/MobileShell";
import { TopBar } from "../components/ui/TopBar";

export function Stub({ title, note }: { title: string; note?: string }) {
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
          {note ?? "다음 단계에서 구현됩니다."}
        </p>
      </div>
    </MobileShell>
  );
}

export default function StubPage() {
  return <Stub title="준비 중" />;
}
