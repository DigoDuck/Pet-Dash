import { useId, type ComponentPropsWithRef } from "react";

interface CheckboxProps extends ComponentPropsWithRef<"input"> {
  label: string;
  error?: string;
}

export function Checkbox({ label, error, id, className = "", ...props }: CheckboxProps) {
  const gerado = useId();
  const inputId = id ?? props.name ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium text-escuro">
        <input
          id={inputId}
          type="checkbox"
          className={`h-4 w-4 rounded border-neutro-light text-marsala focus:ring-2 focus:ring-marsala/20 ${className}`}
          {...props}
        />
        {label}
      </label>
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
