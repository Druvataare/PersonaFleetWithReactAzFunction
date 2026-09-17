import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createQueryClient } from "./lib/queryClient.ts";
import { useState } from "react";
import { RouterProvider } from "react-router/dom";
import type { createBrowserRouter } from "react-router";

type AppRouter = ReturnType<typeof createBrowserRouter>;

export default function App({ router, queryClient }: { router: AppRouter; queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
