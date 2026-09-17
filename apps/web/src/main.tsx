import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/* The mock API (MSW) stands in for Azure Functions until the backend phase. */
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== "true") return;
  const { worker } = await import("./mocks/browser.ts");
  await worker.start({ onUnhandledRequest: "bypass", quiet: import.meta.env.PROD });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
