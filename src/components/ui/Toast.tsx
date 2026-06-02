import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { ToastType } from "../../lib/toast";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; type: ToastType };
      const id = Date.now() + Math.random();
      // 동일 메시지가 1초 이내 연속 발화되면 무시 — 중복 toast 폭주 방지
      setToasts((arr) => {
        const last = arr[arr.length - 1];
        if (last && last.message === detail.message && Date.now() - last.id < 1000) return arr;
        return [...arr, { id, message: detail.message, type: detail.type }];
      });
      // 에러는 더 오래 보이게 — 사용자가 원인을 읽을 시간 보장
      const ttl = detail.type === "error" ? 5200 : detail.type === "success" ? 3200 : 2800;
      setTimeout(() => setToasts((arr) => arr.filter((t) => t.id !== id)), ttl);
    };
    window.addEventListener("gyeol:toast", handler);
    return () => window.removeEventListener("gyeol:toast", handler);
  }, []);

  const borderByType: Record<ToastType, string> = {
    success: "border-l-[3px] border-l-[var(--color-success)]",
    error: "border-l-[3px] border-l-[var(--color-danger)]",
    info: "border-l-[3px] border-l-[var(--color-navy-700)]",
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none px-3 w-full max-w-md"
      style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-white rounded-2xl border border-[var(--color-line)] shadow-[var(--shadow-lifted)] animate-[slideIn_.25s_ease-out] ${borderByType[t.type]}`}
        >
          {t.type === "success" && (
            <CheckCircle2 className="w-5 h-5 text-[var(--color-success)] shrink-0" />
          )}
          {t.type === "error" && (
            <AlertTriangle className="w-5 h-5 text-[var(--color-danger)] shrink-0" />
          )}
          {t.type === "info" && <Info className="w-5 h-5 text-[var(--color-navy-700)] shrink-0" />}
          <span className="text-[14px] font-semibold text-[var(--color-ink-900)] tracking-tight">
            {t.message}
          </span>
        </div>
      ))}
      <style>{`@keyframes slideIn { from {opacity:0; transform: translateY(-8px) } to {opacity:1; transform:translateY(0)} }`}</style>
    </div>
  );
}
