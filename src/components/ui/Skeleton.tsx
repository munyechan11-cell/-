import { cn } from "../../lib/cn";

interface Props {
  className?: string;
  /** 한번에 여러 줄 렌더 */
  lines?: number;
}

/**
 * 데이터 로딩 중 placeholder. 부드러운 shimmer 효과.
 */
export function Skeleton({ className, lines = 1 }: Props) {
  if (lines === 1) {
    return (
      <div
        className={cn(
          "bg-gradient-to-r from-[var(--color-ink-50)] via-[var(--color-ink-100)] to-[var(--color-ink-50)] rounded-md animate-pulse",
          className
        )}
        style={{ backgroundSize: "200% 100%" }}
      />
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(className, i === lines - 1 && "w-3/5")}
        />
      ))}
    </div>
  );
}

/** 카드 형태 스켈레톤 */
export function SkeletonCard() {
  return (
    <div className="bg-white border border-[var(--color-line)] rounded-[var(--radius-lg)] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
