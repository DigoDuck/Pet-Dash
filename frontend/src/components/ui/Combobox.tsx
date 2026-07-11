import { useEffect, useId, useRef, useState } from "react";

export interface ItemCombobox {
  id: number;
  rotulo: string;
}

interface ComboboxProps {
  label: string;
  itens: ItemCombobox[];
  valor: ItemCombobox | null;
  aoSelecionar: (item: ItemCombobox | null) => void;
  aoDigitarBusca: (termo: string) => void;
  carregando?: boolean;
  placeholder?: string;
  error?: string;
}

export function Combobox({
  label, itens, valor, aoSelecionar, aoDigitarBusca, carregando, placeholder, error,
}: ComboboxProps) {
  const inputId = useId();
  const listId = useId();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora.
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  // O input mostra o rótulo selecionado quando fechado; o texto de busca quando aberto.
  const exibido = aberto ? texto : (valor?.rotulo ?? "");

  function selecionar(item: ItemCombobox) {
    aoSelecionar(item);
    setTexto("");
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setDestaque((d) => Math.min(d + 1, itens.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter" && aberto && itens[destaque]) {
      e.preventDefault();
      selecionar(itens[destaque]);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5" ref={raiz}>
      <label htmlFor={inputId} className="text-sm font-medium text-escuro">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={exibido}
          onChange={(e) => {
            setTexto(e.target.value);
            setAberto(true);
            setDestaque(0);
            aoDigitarBusca(e.target.value);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={aoTeclar}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-escuro outline-none focus:border-marsala focus:ring-2 focus:ring-marsala/20 ${
            error ? "border-erro" : "border-neutro-light"
          }`}
        />
        {aberto && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutro-light bg-white shadow-lg"
          >
            {carregando && <li className="px-3 py-2 text-sm text-neutro">Buscando...</li>}
            {!carregando && itens.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutro">Nenhum pet encontrado</li>
            )}
            {itens.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === destaque}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionar(item);
                }}
                onMouseEnter={() => setDestaque(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === destaque ? "bg-marsala/10 text-marsala" : "text-escuro"
                }`}
              >
                {item.rotulo}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
