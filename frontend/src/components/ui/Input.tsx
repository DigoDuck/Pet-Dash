import { useId, type ComponentPropsWithRef } from "react";

interface InputProps extends ComponentPropsWithRef<"input"> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  // O register() do react-hook-form sempre passa `name`, mas um campo via
  // Controller pode não passar. Sem o useId, label e input ficam órfãos.
  const gerado = useId();
  const inputId = id ?? props.name ?? gerado;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-escuro transition-colors outline-none placeholder:text-neutro focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
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
