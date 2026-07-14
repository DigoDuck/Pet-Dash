#!/usr/bin/env python3
"""Smoke test de produção do PetDash.

Exercita o caminho crítico contra uma API de verdade: healthcheck, login JWT, leitura
autenticada, o catálogo semeado, um round-trip de escrita e os três endpoints do
dashboard. Sai com código != 0 no primeiro problema.

Só stdlib: este script roda na máquina do Diogo, fora do venv do projeto, e uma
dependência aqui seria uma dependência a instalar no dia em que algo já deu errado.

Uso:
    python scripts/smoke.py https://petdash.up.railway.app --user patricia
    SMOKE_PASS=... python scripts/smoke.py https://petdash.up.railway.app --user patricia

A senha nunca vai como argumento por padrão: ela ficaria no histórico do shell.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from getpass import getpass

TIMEOUT = 30  # Railway hiberna o container; o primeiro request do dia é lento.


class Falhou(Exception):
    pass


def chamar(url, metodo="GET", corpo=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, headers=headers, method=metodo)

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            texto = resp.read().decode()
            return resp.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as erro:
        texto = erro.read().decode()
        return erro.code, (json.loads(texto) if texto else None)
    except urllib.error.URLError as erro:
        raise Falhou(f"não consegui alcançar {url}: {erro.reason}") from erro


def checar(descricao, condicao, detalhe=""):
    if condicao:
        print(f"  ok    {descricao}")
    else:
        raise Falhou(f"{descricao} — {detalhe}")


def main():
    parser = argparse.ArgumentParser(description="Smoke test de produção do PetDash.")
    parser.add_argument("base_url", help="ex.: https://petdash.up.railway.app")
    parser.add_argument("--user", required=True)
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    api = f"{base}/api"
    senha = os.environ.get("SMOKE_PASS") or getpass("Senha: ")

    print(f"\nSmoke test · {api}\n")

    # 1. Health — o único endpoint público. Se falhar, o resto não faz sentido.
    print("health")
    status, corpo = chamar(f"{api}/health/")
    checar("GET /health/ responde 200", status == 200, f"veio {status}")
    checar("status ok", corpo == {"status": "ok"}, f"veio {corpo}")

    # 2. Auth
    print("\nautenticação")
    status, corpo = chamar(
        f"{api}/token/", "POST", {"username": args.user, "password": senha}
    )
    checar("POST /token/ responde 200", status == 200, f"veio {status}: {corpo}")
    token = (corpo or {}).get("access")
    checar("veio um access token", bool(token))

    status, _ = chamar(f"{api}/tutores/")
    checar("sem token, /tutores/ devolve 401", status == 401, f"veio {status}")

    # 3. Catálogo — prova que o seed_catalogo rodou.
    print("\ncatálogo")
    status, corpo = chamar(f"{api}/servicos/", token=token)
    checar("GET /servicos/ autenticado responde 200", status == 200, f"veio {status}")
    nomes = [s["nome"] for s in (corpo or {}).get("results", [])]
    checar("o catálogo tem serviços", bool(nomes), "nenhum serviço: rodou o seed_catalogo?")
    checar(
        "Pacote Fidelidade existe e é pacote",
        any(s["nome"] == "Pacote Fidelidade" and s["is_pacote"] for s in corpo["results"]),
        f"serviços encontrados: {nomes}",
    )

    # 4. Escrita — o único jeito de provar que o Postgres aceita gravação.
    #    O DELETE é soft (views.perform_destroy seta ativo=False) e a lista filtra
    #    ativo=True, então o registro some da tela da Patricia sem sumir do histórico.
    print("\nescrita (round-trip)")
    status, criado = chamar(
        f"{api}/tutores/",
        "POST",
        {"nome": "SMOKE TEST — pode apagar", "telefone": "71900000000", "email": ""},
        token=token,
    )
    checar("POST /tutores/ responde 201", status == 201, f"veio {status}: {criado}")
    tutor_id = (criado or {}).get("id")

    try:
        status, lido = chamar(f"{api}/tutores/{tutor_id}/", token=token)
        checar("GET do tutor criado responde 200", status == 200, f"veio {status}")
        checar("o nome persistiu", (lido or {}).get("nome", "").startswith("SMOKE TEST"))
    finally:
        status, _ = chamar(f"{api}/tutores/{tutor_id}/", "DELETE", token=token)
        checar("DELETE (soft) responde 204", status == 204, f"veio {status}")

    # 5. Dashboard — as três rotas que a home consome.
    print("\ndashboard")
    periodo = "inicio=2026-01-01&fim=2026-12-31"
    status, corpo = chamar(f"{api}/dashboard/?{periodo}", token=token)
    checar("GET /dashboard/ responde 200", status == 200, f"veio {status}")
    for campo in ("faturamento", "transporte", "lucro", "margem", "custos_por_categoria"):
        checar(f"o resumo traz `{campo}`", campo in (corpo or {}))

    status, serie = chamar(f"{api}/dashboard/serie/?{periodo}", token=token)
    checar("GET /dashboard/serie/ responde 200", status == 200, f"veio {status}")
    checar("a série é uma lista", isinstance(serie, list))

    status, feed = chamar(f"{api}/dashboard/transacoes/?{periodo}", token=token)
    checar("GET /dashboard/transacoes/ responde 200", status == 200, f"veio {status}")
    checar("o feed é uma lista", isinstance(feed, list))

    status, _ = chamar(f"{api}/dashboard/", token=token)
    checar("sem inicio/fim, /dashboard/ devolve 400", status == 400, f"veio {status}")

    print("\nTudo passou.\n")


if __name__ == "__main__":
    try:
        main()
    except Falhou as erro:
        # O flush não é cosmético: redirecionado para arquivo, o stdout é bufferizado
        # e o stderr não. Sem ele, a linha do erro aparece ANTES dos "ok" que vieram
        # antes dela, e quem lê o log não descobre em que passo o deploy quebrou.
        sys.stdout.flush()
        print(f"\n  FALHOU  {erro}\n", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
