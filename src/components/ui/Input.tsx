import React, { forwardRef } from "react";
import { cn } from "../../lib/cn";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftSlot?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, leftSlot, className, id, ...rest },
  ref
) {
  const inputId = id || `inp-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[13px] font-semibold text-[var(--color-navy-800)] mb-2 tracking-tight"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftSlot && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ink-500)]">
            {leftSlot}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white border-[1.5px] rounded-[var(--radius-md)] px-4 py-4 text-[16px] font-medium text-[var(--color-ink-900)] transition-all",
            "placeholder:text-[var(--color-ink-300)] placeholder:font-normal",
            "focus:outline-none focus:border-[var(--color-navy-700)] focus:ring-4 focus:ring-[var(--color-navy-100)]",
            error
              ? "border-[var(--color-danger)]"
              : "border-[var(--color-line)]",
            leftSlot && "pl-12",
            className
          )}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <p
          className={cn(
            "mt-2 text-[12px]",
            error ? "text-[var(--color-danger)]" : "text-[var(--color-ink-500)]"
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});
