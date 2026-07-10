import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { clearTokens } from "./auth";

function aoFalharComo401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    clearTokens();
    window.location.assign("/login");
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: aoFalharComo401 }),
  mutationCache: new MutationCache({ onError: aoFalharComo401 }),
  defaultOptions: {
    queries: {
      // Erro 4xx é determinístico (auth, validação, 404): repetir não ajuda.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});
