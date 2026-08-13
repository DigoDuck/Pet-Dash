import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [posicaoLista, setPosicaoLista] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const atualizarPosicaoLista = useCallback(() => {
    const retangulo = input.current?.getBoundingClientRect();
    if (!retangulo) return;

    setPosicaoLista({
      top: retangulo.bottom + 4,
      left: retangulo.left,
      width: retangulo.width,
    });
  }, []);

  // Fecha ao clicar fora.
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node;
      if (!raiz.current?.contains(alvo) && !lista.current?.contains(alvo)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  useEffect(() => {
    if (!aberto) {
      setPosicaoLista(null);
      return;
    }

    atualizarPosicaoLista();
    window.addEventListener("resize", atualizarPosicaoLista);
    window.addEventListener("scroll", atualizarPosicaoLista, true);
    return () => {
      window.removeEventListener("resize", atualizarPosicaoLista);
      window.removeEventListener("scroll", atualizarPosicaoLista, true);
    };
  }, [aberto, atualizarPosicaoLista]);

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
          ref={input}
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
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-escuro outline-none focus:border-marsala focus:ring-2 focus:ring-marsala/20 pointer-coarse:text-base ${
            error ? "border-erro" : "border-neutro-light"
          }`}
        />
        {aberto && posicaoLista
          ? createPortal(
              <ul
                ref={lista}
                id={listId}
                role="listbox"
                className="z-10 max-h-60 overflow-auto rounded-lg border border-neutro-light bg-white shadow-lg"
                style={{
                  position: "fixed",
                  top: posicaoLista.top,
                  left: posicaoLista.left,
                  width: posicaoLista.width,
                  pointerEvents: "auto",
                }}
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
              </ul>,
              document.body,
            )
          : null}
      </div>
      {error && (
        <p role="alert" className="text-xs text-erro">
          {error}
        </p>
      )}
    </div>
  );
}
