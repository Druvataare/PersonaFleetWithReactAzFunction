import { Link, useRouteError } from "react-router";
import { PageHead } from "../components/ui.tsx";

export default function NotFoundPage({ what = "This page" }: { what?: string }) {
  return (
    <>
      <PageHead
        step="NOT FOUND"
        title={`${what} does not exist`}
        sub="Check the address, or go back to the persona overview."
      />
      <Link to="/personas" className="btn btn-primary" style={{ textDecoration: "none" }}>
        Go to Personas
      </Link>
    </>
  );
}

/** Rendered by the router when a page throws while rendering. */
export function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Unexpected error";
  return (
    <div className="wrap body">
      <PageHead step="ERROR" title="Something went wrong" sub={message} />
      <a href="/personas" className="btn btn-primary" style={{ textDecoration: "none" }}>
        Reload Personas
      </a>
    </div>
  );
}
