import React from "react";
import { cn } from "../../lib/cn";

interface Props {
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
  className?: string;
  /** 데스크톱에서 폰 프레임처럼 보일지(true) 전체 폭(false) */
  framed?: boolean;
}

/**
 * 고객·로그인·QR 등 폰-앱 UX 셸.
 * 모바일: 자연스러운 풀스크린 480px max.
 * 데스크톱: 가운데 폰 프레임 미감으로 멋스럽게 정렬.
 */
export function MobileShell({ children, bottomNav, className, framed = true }: Props) {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] lg:bg-[var(--color-bg-alt)] lg:flex lg:items-center lg:justify-center lg:py-10">
      <div
        className={cn(
          "mx-auto w-full max-w-[480px] min-h-screen bg-[var(--color-bg)] relative pb-[env(safe-area-inset-bottom)]",
          framed &&
            "lg:min-h-0 lg:my-0 lg:h-[860px] lg:max-h-[92vh] lg:rounded-[36px] lg:shadow-[0_24px_60px_-24px_rgba(11,18,32,0.30),0_8px_24px_rgba(11,18,32,0.08)] lg:overflow-hidden lg:border lg:border-[var(--color-line)] lg:flex lg:flex-col",
          className
        )}
      >
        <main
          className={cn(
            framed ? "lg:flex-1 lg:overflow-y-auto" : "",
            bottomNav ? "pb-28" : "pb-8"
          )}
        >
          {children}
        </main>
        {bottomNav && (
          <nav
            className={cn(
              "bg-white/95 backdrop-blur-md border-t border-[var(--color-line)] pb-[env(safe-area-inset-bottom)] z-40",
              framed
                ? "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] lg:relative lg:translate-x-0 lg:left-auto lg:bottom-auto lg:w-auto"
                : "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px]"
            )}
          >
            {bottomNav}
          </nav>
        )}
      </div>
    </div>
  );
}
