import { useId, type ComponentPropsWithRef } from "react";

interface SelectProps extends ComponentPropsWithRef<"select"> {
  label: string;
  error?: string;
}

export function Select({ label, error, id, className = "", ...props }: SelectProps) {
  const gerado = useId();
  const selectId = id ?? props.name ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-escuro transition-colors outline-none focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
          error ? "border-erro" : "border-neutro-light"
        } ${className}`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
