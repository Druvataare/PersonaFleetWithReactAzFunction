import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { useUi } from "../store/ui.ts";
import { applyTheme } from "../theme/themes.ts";
import { Crumbs } from "./Crumbs.tsx";
import { Topbar } from "./Topbar.tsx";

/** Applies preferences that live outside React's tree: theme variables and body classes. */
function useDocumentPreferences() {
  const { theme, motion, chartNames } = useUi();
  /* Effects use block bodies: an expression body returns its value, and after
     minification that value can become a non-function "cleanup" that crashes React. */
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    document.body.classList.toggle("motion", motion);
    document.body.classList.toggle("types", chartNames);
  }, [motion, chartNames]);
}

export function AppLayout() {
  useDocumentPreferences();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <>
      <Topbar />
      <Crumbs />
      <main className="wrap body" id="app">
        <Outlet />
      </main>
    </>
  );
}
