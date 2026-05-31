import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/cn";

interface Props {
  title?: string;
  back?: boolean | (() => void);
  right?: React.ReactNode;
  transparent?: boolean;
}

export function TopBar({ title, back, right, transparent }: Props) {
  const nav = useNavigate();
  const handleBack = () => {
    if (typeof back === "function") back();
    else nav(-1);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-[60px] sm:h-[64px] flex items-center px-3 gap-2",
        transparent
          ? "bg-transparent"
          : "bg-white/90 backdrop-blur-md border-b border-[var(--color-line)]"
      )}
    >
      {back ? (
        <button
          onClick={handleBack}
          aria-label="뒤로"
          className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[var(--color-navy-50)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-[var(--color-navy-800)]" />
        </button>
      ) : (
        <div className="w-11" />
      )}
      <h1 className="flex-1 text-center text-[17px] sm:text-[18px] font-extrabold text-[var(--color-navy-900)] tracking-tight truncate px-1">
        {title}
      </h1>
      <div className="min-w-11 flex items-center justify-end gap-1">{right}</div>
    </header>
  );
}
