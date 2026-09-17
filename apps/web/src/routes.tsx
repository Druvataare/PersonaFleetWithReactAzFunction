import { Navigate, type RouteObject } from "react-router";
import { AppLayout } from "./layout/AppLayout.tsx";
import BaselinesPage from "./pages/BaselinesPage.tsx";
import ChangePage from "./pages/ChangePage.tsx";
import DevChartsPage from "./pages/DevChartsPage.tsx";
import DevicePage from "./pages/DevicePage.tsx";
import NotFoundPage, { RouteError } from "./pages/NotFoundPage.tsx";
import PersonaDetailPage from "./pages/PersonaDetailPage.tsx";
import PersonasPage from "./pages/PersonasPage.tsx";
import SwitchPage from "./pages/SwitchPage.tsx";
import TicketsPage from "./pages/TicketsPage.tsx";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/personas" replace /> },
      { path: "personas", element: <PersonasPage /> },
      { path: "personas/:pid", element: <PersonaDetailPage /> },
      { path: "personas/:pid/devices/:did", element: <DevicePage /> },
      { path: "baselines/:pid?", element: <BaselinesPage /> },
      { path: "tickets", element: <TicketsPage /> },
      { path: "change", element: <ChangePage /> },
      { path: "switch", element: <SwitchPage /> },
      /* Temporary chart comparison page (step 5), removed in step 12. */
      { path: "dev/charts", element: <DevChartsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
