import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./auth";

const BASE_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(`Erro ${status} na API`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Single-flight: N chamadas concorrentes com 401 compartilham esta Promise,
// garantindo exatamente um POST /token/refresh/ por expiração.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(`${BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { access: string };
  setTokens({ access: data.access });
  return true;
}

function refreshOnce(): Promise<boolean> {
  refreshPromise ??= tryRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const doFetch = () => {
    const access = getAccessToken();
    return fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
    });
  };

  let res = await doFetch();

  // 401 em /token/ é credencial inválida, não sessão expirada — sem refresh.
  if (res.status === 401 && !path.startsWith("/token/")) {
    const renovado = await refreshOnce();
    if (!renovado) {
      clearTokens();
      throw new ApiError(401, "Sessão expirada");
    }
    res = await doFetch();
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res));
  }
  return (await parseBody(res)) as T;
}

export async function login(username: string, password: string): Promise<void> {
  const data = await request<{ access: string; refresh: string }>("/token/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setTokens(data);
}

export function logout(): void {
  clearTokens();
}

/** Extrai a mensagem legível de um erro do DRF ({"non_field_errors": ["..."]}
 *  ou {"campo": ["..."]}). Sem isto, uma mutation rejeitada falharia calada. */
export function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof ApiError)) return "Erro inesperado. Tente de novo.";
  const detail = erro.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const primeiro = Object.values(detail as Record<string, unknown>)[0];
    if (Array.isArray(primeiro) && typeof primeiro[0] === "string") return primeiro[0];
    if (typeof primeiro === "string") return primeiro;
  }
  return "Não foi possível salvar. Tente de novo.";
}
