import { describe, expect, it } from "vitest";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isAuthenticated,
  setTokens,
} from "./auth";

describe("auth storage", () => {
  it("grava e lê access e refresh", () => {
    setTokens({ access: "a1", refresh: "r1" });
    expect(getAccessToken()).toBe("a1");
    expect(getRefreshToken()).toBe("r1");
  });

  it("setTokens sem refresh preserva o refresh existente", () => {
    setTokens({ access: "a1", refresh: "r1" });
    setTokens({ access: "a2" });
    expect(getAccessToken()).toBe("a2");
    expect(getRefreshToken()).toBe("r1");
  });

  it("clearTokens remove tudo e derruba isAuthenticated", () => {
    setTokens({ access: "a1", refresh: "r1" });
    expect(isAuthenticated()).toBe(true);
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it("sem nada no storage, isAuthenticated é false", () => {
    expect(isAuthenticated()).toBe(false);
  });
});
