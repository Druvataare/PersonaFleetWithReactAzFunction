import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import App from "../App.tsx";
import { routes } from "../routes.tsx";

/** Renders the whole app at a URL, with a fresh query cache and the mock API. */
export function renderApp(path = "/") {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const utils = render(<App router={router} queryClient={queryClient} />);
  return { ...utils, router, user, queryClient };
}
