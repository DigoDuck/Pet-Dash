import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "./msw/server";

describe("infra de testes", () => {
  it("MSW intercepta fetch no ambiente de teste", async () => {
    server.use(
      http.get("http://localhost:8000/api/health/", () =>
        HttpResponse.json({ status: "ok" }),
      ),
    );
    const res = await fetch("http://localhost:8000/api/health/");
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
