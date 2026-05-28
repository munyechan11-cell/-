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
      setToasts((arr) => [...arr, { id, message: detail.message, type: detail.type }]);
      setTimeout(() => setToasts((arr) => arr.filter((t) => t.id !== id)), 3200);
    };
    window.addEventListener("gyeol:toast", handler);
    return () => window.removeEventListener("gyeol:toast", handler);
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 px-5 py-3.5 bg-white rounded-2xl border border-[var(--color-line)] shadow-[var(--shadow-lifted)] animate-[slideIn_.25s_ease-out]"
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
