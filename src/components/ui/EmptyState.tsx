import { cn } from "../../lib/cn";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** 색감 변형 */
  tone?: "default" | "mint" | "navy";
}

/**
 * 일관된 빈 상태 표시.
 * 큰 아이콘 + 제목(가독성 강조) + 설명 + CTA.
 */
export function EmptyState({ icon, title, description, action, className, tone = "default" }: Props) {
  const iconBg =
    tone === "mint"
      ? "bg-[var(--color-mint-100)] text-[var(--color-mint-700)]"
      : tone === "navy"
      ? "bg-[var(--color-navy-100)] text-[var(--color-navy-700)]"
      : "bg-[var(--color-ink-50)] text-[var(--color-ink-500)]";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 rounded-[var(--radius-lg)] bg-white border border-[var(--color-line)]",
        className
      )}
    >
      {icon && (
        <div className={cn("w-14 h-14 rounded-2xl inline-flex items-center justify-center mb-4", iconBg)}>
          {icon}
        </div>
      )}
      <h3 className="text-[16px] font-extrabold text-[var(--color-navy-900)] tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[13.5px] text-[var(--color-ink-600)] font-medium leading-relaxed max-w-[300px]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
