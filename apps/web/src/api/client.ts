/* Minimal fetch wrapper for /api/*. TanStack Query hooks build on this in step 4. */

export class ApiRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const toUrl = (path: string) => new URL(path, window.location.origin);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(toUrl(path), {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
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
