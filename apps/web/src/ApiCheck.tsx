/* Temporary step 3 page: calls every mock endpoint and summarises the response.
   Replaced by the app shell in step 4. */
import { useEffect, useState } from "react";
import { apiGet } from "./api/client.ts";
import { CHECKS } from "./apiChecks.ts";

type Result =
  { status: "loading" } | { status: "ok"; summary: string } | { status: "error"; message: string };

export default function ApiCheck() {
  const [results, setResults] = useState<Record<string, Result>>({});

  useEffect(() => {
    CHECKS.forEach((c) => {
      apiGet<never>(c.path)
        .then((body) => setResults((r) => ({ ...r, [c.path]: { status: "ok", summary: c.summarise(body) } })))
        .catch((e: Error) =>
          setResults((r) => ({ ...r, [c.path]: { status: "error", message: e.message } })),
        );
    });
  }, []);

  return (
    <section className="apicheck" aria-label="Mock API check">
      <h2>Mock API check</h2>
      <p>
        Every endpoint is served by the in-browser mock API with the wireframe's sample data. Open DevTools →
        Network to see the requests.
      </p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Status</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {CHECKS.map((c) => {
            const r = results[c.path] ?? { status: "loading" };
            return (
              <tr key={c.path}>
                <td>
                  <code>GET {c.path}</code>
                </td>
                <td className={`status ${r.status}`}>
                  {r.status === "ok" ? "OK" : r.status === "error" ? "Failed" : "…"}
                </td>
                <td>{r.status === "ok" ? r.summary : r.status === "error" ? r.message : "Loading"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
