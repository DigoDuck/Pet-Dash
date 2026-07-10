import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-neutro-light/60 bg-creme p-6 shadow-sm ${className}`}
      {...props}
    />
  );
}
