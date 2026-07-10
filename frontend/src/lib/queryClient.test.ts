import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("aoFalharComo401", () => {
  it("redireciona uma única vez quando N queries falham com 401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });

    const { queryClient } = await import("./queryClient");
    const { ApiError } = await import("./api");

    const erro = new ApiError(401, "Sessão expirada");
    const cache = queryClient.getQueryCache();
    cache.config.onError?.(erro, {} as never);
    cache.config.onError?.(erro, {} as never);
    cache.config.onError?.(erro, {} as never);

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("não redireciona em erro que não é 401", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });

    const { queryClient } = await import("./queryClient");
    const { ApiError } = await import("./api");

    queryClient.getQueryCache().config.onError?.(new ApiError(500, "boom"), {} as never);

    expect(assign).not.toHaveBeenCalled();
  });
});
