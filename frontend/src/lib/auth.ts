const ACCESS_KEY = "petdash.access";
const REFRESH_KEY = "petdash.refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: { access: string; refresh?: string }): void {
  localStorage.setItem(ACCESS_KEY, tokens.access);
  if (tokens.refresh) {
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return getRefreshToken() !== null;
}
