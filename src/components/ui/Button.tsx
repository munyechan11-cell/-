import React from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "mint" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-bold tracking-tight transition-all duration-150 select-none active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-navy-700)] text-[var(--color-on-primary,white)] hover:bg-[var(--color-navy-800)] shadow-[var(--shadow-navy)]",
  mint: "bg-[var(--color-mint-500)] text-[var(--color-on-accent,white)] hover:bg-[var(--color-mint-600)] shadow-[var(--shadow-mint)]",
  ghost: "bg-[var(--color-navy-50)] text-[var(--color-navy-700)] hover:bg-[var(--color-navy-100)]",
  outline:
    "bg-white text-[var(--color-navy-700)] border-[1.5px] border-[var(--color-line)] hover:border-[var(--color-navy-700)]",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-11 px-4 text-[14px] rounded-[var(--radius-sm)]",
  md: "h-12 px-5 text-[15px] rounded-[var(--radius-md)]",
  lg: "h-14 px-6 text-[16px] rounded-[var(--radius-md)]",
};

export function Button({
  variant = "primary",
  size = "lg",
  block,
  loading,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], block && "w-full", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
