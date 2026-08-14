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

const ALTURA_MAXIMA_LISTA = 240;
const ESPACO_ENTRE_CAMPO_E_LISTA = 4;

interface PosicaoLista {
  bottom?: number;
  left: number;
  maxHeight: number;
  top?: number;
  width: number;
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
  const [posicaoLista, setPosicaoLista] = useState<PosicaoLista | null>(null);

  const atualizarPosicaoLista = useCallback(() => {
    const retangulo = input.current?.getBoundingClientRect();
    if (!retangulo) return;

    const alturaViewport = window.visualViewport?.height ?? window.innerHeight;
    const espacoAbaixo = alturaViewport - retangulo.bottom - ESPACO_ENTRE_CAMPO_E_LISTA;
    const espacoAcima = retangulo.top - ESPACO_ENTRE_CAMPO_E_LISTA;
    // Vira para cima só quando a lista não cabe abaixo E em cima cabe mais. A segunda
    // metade não é detalhe: com o teclado aberto os dois lados costumam ficar apertados,
    // e decidir só pelo primeiro teste abria a lista no lado MENOR — 116px de opções
    // acima quando havia 236px abaixo.
    const abreParaCima = espacoAbaixo < ALTURA_MAXIMA_LISTA && espacoAcima > espacoAbaixo;
    const espacoDisponivel = abreParaCima ? espacoAcima : espacoAbaixo;

    setPosicaoLista({
      bottom: abreParaCima
        ? alturaViewport - retangulo.top + ESPACO_ENTRE_CAMPO_E_LISTA
        : undefined,
      left: retangulo.left,
      maxHeight: Math.max(0, Math.min(ALTURA_MAXIMA_LISTA, espacoDisponivel)),
      top: abreParaCima ? undefined : retangulo.bottom + ESPACO_ENTRE_CAMPO_E_LISTA,
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

    const viewportVisual = window.visualViewport;
    atualizarPosicaoLista();
    window.addEventListener("resize", atualizarPosicaoLista);
    window.addEventListener("scroll", atualizarPosicaoLista, true);
    viewportVisual?.addEventListener("resize", atualizarPosicaoLista);
    viewportVisual?.addEventListener("scroll", atualizarPosicaoLista);
    return () => {
      window.removeEventListener("resize", atualizarPosicaoLista);
      window.removeEventListener("scroll", atualizarPosicaoLista, true);
      viewportVisual?.removeEventListener("resize", atualizarPosicaoLista);
      viewportVisual?.removeEventListener("scroll", atualizarPosicaoLista);
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
                className="z-10 overflow-auto rounded-lg border border-neutro-light bg-white shadow-lg"
                style={{
                  bottom: posicaoLista.bottom,
                  maxHeight: posicaoLista.maxHeight,
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
