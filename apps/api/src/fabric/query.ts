/* The only place SQL runs (AD-18, layer 3). Every query is named, parameterised,
   retried on transient faults, timed, and its rows are validated before they
   become JSON — a renamed column fails loudly here instead of arriving as
   undefined and being graded as zero. */
import type { z } from "zod";
import type { FabricConfig } from "./config.ts";
import { readConfig } from "./config.ts";
import { getPool, resetPool, type SqlDriver, type TokenSource } from "./pool.ts";

export interface QueryOptions<T> {
  /** Short name for logs and errors, e.g. "personas". */
  name: string;
  /** SQL text; values always arrive as @parameters, never concatenated. */
  sql: string;
  params?: Record<string, string | number | boolean | null>;
  /** Schema for one row. */
  schema: z.ZodType<T>;
}

export interface QueryResult<T> {
  rows: T[];
  ms: number;
}

export class QueryFailedError extends Error {
  constructor(
    readonly queryName: string,
    readonly attempts: number,
    cause: unknown,
  ) {
    super(`Query "${queryName}" failed after ${attempts} attempt(s): ${describe(cause)}`);
    this.name = "QueryFailedError";
    this.cause = cause;
  }
}

export class RowShapeError extends Error {
  constructor(
    readonly queryName: string,
    readonly problems: string[],
  ) {
    super(`Query "${queryName}" returned unexpected rows: ${problems.join("; ")}`);
    this.name = "RowShapeError";
  }
}

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* Faults worth retrying: the connection dropped, or Fabric was busy. Anything
   else — bad SQL, no permission on a view — fails on the first attempt. */
const TRANSIENT_CODES = new Set(["ESOCKET", "ETIMEOUT", "ECONNCLOSED", "ECONNRESET", "EREQUEST_TIMEOUT"]);
const TRANSIENT_NUMBERS = new Set([4060, 10928, 10929, 40197, 40501, 40613, 49918, 49919, 49920]);

function isTransient(error: unknown): boolean {
  const e = error as { code?: string; number?: number; originalError?: { info?: { number?: number } } };
  return (
    (typeof e?.code === "string" && TRANSIENT_CODES.has(e.code)) ||
    (typeof e?.number === "number" && TRANSIENT_NUMBERS.has(e.number)) ||
    TRANSIENT_NUMBERS.has(e?.originalError?.info?.number ?? -1)
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface QueryDeps {
  config?: FabricConfig;
  driver?: SqlDriver;
  tokens?: TokenSource;
  log?: (message: string) => void;
  /** Milliseconds before each retry; its length is the retry count. */
  backoffMs?: number[];
}

/** Runs `sql` against Fabric and returns rows that match `schema`. */
export async function query<T>(options: QueryOptions<T>, deps: QueryDeps = {}): Promise<QueryResult<T>> {
  const { config = readConfig(), driver, tokens, log = () => {}, backoffMs = [200, 600] } = deps;
  const started = Date.now();
  let lastError: unknown;

  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    try {
      const pool = await getPool(config, driver, tokens);
      const request = pool.request();
      for (const [key, value] of Object.entries(options.params ?? {})) request.input(key, value);
      const result = await request.query<unknown>(options.sql);
      const ms = Date.now() - started;
      log(`fabric ${options.name}: ${result.recordset.length} rows in ${ms}ms`);
      return { rows: validate(options, result.recordset), ms };
    } catch (error) {
      if (error instanceof RowShapeError) throw error;
      lastError = error;
      if (attempt === backoffMs.length || !isTransient(error)) break;
      log(`fabric ${options.name}: ${describe(error)} — retrying`);
      /* A dropped connection leaves the pool unusable; the next attempt rebuilds it. */
      await resetPool(config);
      await wait(backoffMs[attempt]);
    }
  }
  throw new QueryFailedError(options.name, backoffMs.length + 1, lastError);
}

function validate<T>(options: QueryOptions<T>, rows: unknown[]): T[] {
  const problems: string[] = [];
  const parsed: T[] = [];
  for (const [index, row] of rows.entries()) {
    const result = options.schema.safeParse(row);
    if (result.success) parsed.push(result.data);
    else if (problems.length < 3) {
      problems.push(
        `row ${index}: ${result.error.issues.map((i) => `${i.path.join(".") || "(row)"} ${i.message}`).join(", ")}`,
      );
    }
  }
  if (problems.length) throw new RowShapeError(options.name, problems);
  return parsed;
}
