import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { clearTokens } from "./auth";

// N queries paralelas podem falhar com 401 no mesmo tick (o detalhe do tutor
// busca tutor e pets juntos). Sem esta flag, cada uma dispararia seu próprio
// redirect. Não é loop, mas empilha navegações.
let redirecionando = false;

function aoFalharComo401(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && !redirecionando) {
    redirecionando = true;
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
