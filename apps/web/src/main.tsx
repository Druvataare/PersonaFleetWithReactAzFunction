import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import App from "./App.tsx";
import { routes } from "./routes.tsx";
import "./styles/global.css";

/* Mock Service Worker registers /mockServiceWorker.js in the browser, and
   that registration outlives the build flag that created it. Turning mocks
   off stops us starting the worker, but does nothing about the one already
   installed in the browser of anyone who opened the demo — leaving an
   uncontrolled request interceptor in production. It passes requests through
   rather than mocking them, so it would not serve wrong data, but it is a
   component nobody intends to be running, and it is why the same URL can
   behave differently for two people. Removing it is the app's job, because
   nothing else can reach it. */
async function unregisterMockWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((r) =>
          [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith("/mockServiceWorker.js")),
        )
        .map((r) => r.unregister()),
    );
  } catch {
    /* Blocked by policy or unavailable; the app is correct either way, so
       this must never stop it starting. */
  }
}

/* The mock API (MSW) stands in for Azure Functions until the backend phase. */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") {
    await unregisterMockWorker();
    return;
  }
  const { worker } = await import("./mocks/browser.ts");
  await worker.start({ onUnhandledRequest: "bypass", quiet: import.meta.env.PROD });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App router={createBrowserRouter(routes)} />
    </StrictMode>,
  );
});
