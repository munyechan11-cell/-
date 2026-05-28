import React from "react";
import { cn } from "../../lib/cn";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const pads = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({ padding = "md", interactive, className, ...rest }: Props) {
  return (
    <div
      className={cn(
        "bg-white border border-[var(--color-line)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)]",
        pads[padding],
        interactive && "transition-all hover:shadow-[var(--shadow-lifted)] cursor-pointer active:scale-[0.995]",
        className
      )}
      {...rest}
    />
  );
}
