import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { getAccessToken, getRefreshToken } from "../lib/auth";
import { server } from "../test/msw/server";
import { Login } from "./Login";

const API = "http://localhost:8000/api";

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <Login /> },
      { path: "/", element: <p>dashboard fake</p> },
    ],
    { initialEntries: ["/login"] },
  );
  render(<RouterProvider router={router} />);
}

describe("Login", () => {
  it("com credenciais válidas grava os tokens e navega para /", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ access: "a1", refresh: "r1" }),
      ),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuário"), "patricia");
    await user.type(screen.getByLabelText("Senha"), "segredo");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("dashboard fake")).toBeInTheDocument();
    expect(getAccessToken()).toBe("a1");
    expect(getRefreshToken()).toBe("r1");
  });

  it("com credencial inválida mostra a mensagem de erro e não navega", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/token/`, () =>
        HttpResponse.json({ detail: "no active account" }, { status: 401 }),
      ),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuário"), "patricia");
    await user.type(screen.getByLabelText("Senha"), "errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuário ou senha inválidos",
    );
    expect(getAccessToken()).toBeNull();
  });

  it("campos vazios mostram validação sem chamar a API", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
  });
});
