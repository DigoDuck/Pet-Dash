import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setTokens } from "../lib/auth";
import { ProtectedRoute } from "./ProtectedRoute";

function renderProtegido() {
  const router = createMemoryRouter(
    [
      { path: "/login", element: <p>página de login</p> },
      {
        element: <ProtectedRoute />,
        children: [{ path: "/", element: <p>conteúdo protegido</p> }],
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

describe("ProtectedRoute", () => {
  it("sem refresh token redireciona para /login", () => {
    renderProtegido();
    expect(screen.getByText("página de login")).toBeInTheDocument();
    expect(screen.queryByText("conteúdo protegido")).not.toBeInTheDocument();
  });

  it("com refresh token renderiza o conteúdo", () => {
    setTokens({ access: "a", refresh: "r" });
    renderProtegido();
    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });
});
