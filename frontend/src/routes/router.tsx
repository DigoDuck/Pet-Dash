import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { Agenda } from "../pages/Agenda";
import { AtendimentoForm } from "../pages/AtendimentoForm";
import { Atendimentos } from "../pages/Atendimentos";
import { Clientes } from "../pages/Clientes";
import { Dashboard } from "../pages/Dashboard";
import { Financeiro } from "../pages/Financeiro";
import { Login } from "../pages/Login";
import { NotFound } from "../pages/NotFound";
import { Pacotes } from "../pages/Pacotes";
import { PetDetalhe } from "../pages/PetDetalhe";
import { Servicos } from "../pages/Servicos";
import { TutorDetalhe } from "../pages/TutorDetalhe";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/agenda", element: <Agenda /> },
          { path: "/clientes", element: <Clientes /> },
          { path: "/clientes/:id", element: <TutorDetalhe /> },
          { path: "/pets/:id", element: <PetDetalhe /> },
          { path: "/servicos", element: <Servicos /> },
          { path: "/atendimentos", element: <Atendimentos /> },
          { path: "/atendimentos/novo", element: <AtendimentoForm /> },
          { path: "/atendimentos/:id/editar", element: <AtendimentoForm /> },
          { path: "/pacotes", element: <Pacotes /> },
          { path: "/financeiro", element: <Financeiro /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
