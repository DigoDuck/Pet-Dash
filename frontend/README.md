# Frontend (React + Vite + Tailwind v4)

App React do PetDash. Consome a API DRF do `backend/` via JWT.

## Rodar local

```bash
npm install
cp .env.example .env   # ajuste VITE_API_URL se a API não estiver em localhost:8000
npm run dev            # http://localhost:5173 (backend precisa estar de pé)
```

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — type-check (`tsc -b`) + build de produção
- `npm run test` — suíte (Vitest + Testing Library + MSW)
- `npm run test:watch` — testes em modo watch

## Convenções

- Tokens da marca em `src/styles/index.css` (bloco `@theme` do Tailwind v4).
- HTTP sempre via `src/lib/api.ts` (injeta JWT e faz refresh em 401); nunca `fetch` direto nas páginas.
- Protótipos do Lovable são só referência visual (sem Supabase, sem portar estrutura). Ver `CLAUDE.md` na raiz.
