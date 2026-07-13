import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../test/msw/server";
import { ApiError, login, mensagemDeErro, request } from "./api";
import { getAccessToken, getRefreshToken, setTokens } from "./auth";

const API = "http://localhost:8000/api";

describe("request", () => {
  beforeEach(() => {
    setTokens({ access: "access-velho", refresh: "refresh-ok" });
  });

  it("injeta o Bearer e devolve o JSON", async () => {
    server.use(
      http.get(`${API}/tutores/`, ({ request: req }) => {
        expect(req.headers.get("Authorization")).toBe("Bearer access-velho");
        return HttpResponse.json({ results: [] });
      }),
    );
    await expect(request("/tutores/")).resolves.toEqual({ results: [] });
  });

  it("erro da API vira ApiError com status e detail", async () => {
    server.use(
      http.get(`${API}/tutores/`, () =>
        HttpResponse.json({ detail: "quebrou" }, { status: 500 }),
      ),
    );
    const err = await request("/tutores/").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
    expect((err as ApiError).detail).toEqual({ detail: "quebrou" });
  });

  it("em 401 faz refresh, refaz a chamada e grava o novo access", async () => {
    let chamadas = 0;
    server.use(
      http.get(`${API}/tutores/`, ({ request: req }) => {
        chamadas += 1;
        if (req.headers.get("Authorization") === "Bearer access-novo") {
          return HttpResponse.json({ results: ["ok"] });
        }
        return HttpResponse.json({ detail: "token expirado" }, { status: 401 });
      }),
      http.post(`${API}/token/refresh/`, () =>
        HttpResponse.json({ access: "access-novo" }),
      ),
    );
    await expect(request("/tutores/")).resolves.toEqual({ results: ["ok"] });
    expect(chamadas).toBe(2);
    expect(getAccessToken()).toBe("access-novo");
    expect(getRefreshToken()).toBe("refresh-ok");
  });

  it("duas chamadas concorrentes com 401 disparam um único refresh", async () => {
    let refreshes = 0;
    const protegido = ({ request: req }: { request: Request }) =>
      req.headers.get("Authorization") === "Bearer access-novo"
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({}, { status: 401 });
    server.use(
      http.get(`${API}/tutores/`, protegido),
      http.get(`${API}/pets/`, protegido),
      http.post(`${API}/token/refresh/`, async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json({ access: "access-novo" });
      }),
    );
    await Promise.all([request("/tutores/"), request("/pets/")]);
    expect(refreshes).toBe(1);
  });

  it("refresh falho limpa os tokens e lança ApiError 401", async () => {
    server.use(
      http.get(`${API}/tutores/`, () => HttpResponse.json({}, { status: 401 })),
      http.post(`${API}/token/refresh/`, () =>
        HttpResponse.json({ detail: "refresh expirado" }, { status: 401 }),
      ),
    );
    await expect(request("/tutores/")).rejects.toMatchObject({ status: 401 });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("401 no /token/ não dispara refresh (é senha errada)", async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ detail: "no active account" }, { status: 401 }),
      ),
      http.post(`${API}/token/refresh/`, () => {
        refreshes += 1;
        return HttpResponse.json({ access: "x" });
      }),
    );
    await expect(login("patricia", "senha-errada")).rejects.toBeInstanceOf(ApiError);
    expect(refreshes).toBe(0);
  });
});

describe("login", () => {
  it("grava access e refresh após autenticar", async () => {
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ access: "a1", refresh: "r1" }),
      ),
    );
    await login("patricia", "segredo");
    expect(getAccessToken()).toBe("a1");
    expect(getRefreshToken()).toBe("r1");
  });
});

describe("mensagemDeErro", () => {
  it("extrai a mensagem de non_field_errors do DRF", () => {
    const erro = new ApiError(400, {
      non_field_errors: ["Já existe um pacote para este pet nesta competência."],
    });
    expect(mensagemDeErro(erro)).toBe("Já existe um pacote para este pet nesta competência.");
  });

  it("extrai a mensagem de um erro de campo", () => {
    const erro = new ApiError(400, { valor_pago: ["Informe um número válido."] });
    expect(mensagemDeErro(erro)).toBe("Informe um número válido.");
  });

  it("tem fallback para erro que não é da API", () => {
    expect(mensagemDeErro(new Error("boom"))).toBe("Erro inesperado. Tente de novo.");
  });
});
