/* Minimal fetch wrapper for /api/*. TanStack Query hooks build on this. */

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const toUrl = (path: string) => new URL(path, window.location.origin);

/* An expired session must end in a sign-in prompt, not an error message.

   Static Web Apps rewrites a 401 into a 302 at /.auth/login/aad, which then
   redirects cross-origin to Entra. A fetch follows that and rejects with a
   TypeError, because the sign-in page sends no CORS headers — so without
   this, a session that timed out surfaced as "Failed to fetch" and the user
   was given no way to recover. The API can also answer 401 directly, since
   every endpoint now authenticates for itself; both paths land here.

   /.auth/me is the arbiter rather than guessing from the failure: it is
   same-origin, unauthenticated-safe, and returns a null clientPrincipal
   precisely when the session is gone. A network fault answers nothing, so
   the original error is rethrown and the caller reports it as before. */
async function signedOut(): Promise<boolean> {
  try {
    const res = await fetch(toUrl("/.auth/me"), { headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const me = (await res.json()) as { clientPrincipal?: unknown } | null;
    return !me?.clientPrincipal;
  } catch {
    return false;
  }
}

async function toSignIn(): Promise<never> {
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/.auth/login/aad?post_login_redirect_uri=${returnTo}`);
  /* Navigation is asynchronous; never resolve, so no caller renders an error
     in the moment before the page goes away. */
  return new Promise<never>(() => {});
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(toUrl(path), {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch (cause) {
    if (await signedOut()) return toSignIn();
    throw cause;
  }

  if (res.status === 401 && (await signedOut())) return toSignIn();

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new ApiRequestError(res.status, message);
  }
  return body as T;
}

export const apiGet = <T>(path: string) => request<T>(path);

export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
