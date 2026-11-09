import { vi } from 'vitest';

export interface FakeAnswer {
  data?: unknown;
  errors?: { message: string; path?: string[]; extensions?: { code: string } }[];
  status?: number;
  headers?: Record<string, string>;
}

export interface FakeCall {
  operation: string;
  query: string;
  variables: Record<string, unknown> | undefined;
  url: string;
  headers: Record<string, string>;
  /** The files of a multipart request, by their part name. */
  files?: Record<string, File>;
}

type Handler = FakeAnswer | ((call: FakeCall) => FakeAnswer);

const OPERATION_NAME = /^\s*(?:query|mutation)\s+(\w+)/;

/**
 * A stand-in for the Shop API or the Admin API: answers each operation by its name and records every call, so a test
 * can say what was asked and how often. Installs itself as the global `fetch`.
 */
export const fakeShopApi = (handlers: Record<string, Handler>) => {
  const calls: FakeCall[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const form = init.body instanceof FormData ? init.body : undefined;
    const body = JSON.parse(String(form ? form.get('operations') : init.body)) as { query: string; variables?: Record<string, unknown> };
    const operation = OPERATION_NAME.exec(body.query)?.[1] ?? 'anonymous';
    const files = form && Object.fromEntries([...form.entries()].filter((entry): entry is [string, File] => entry[1] instanceof File));
    const call = { operation, query: body.query, variables: body.variables, url, headers: init.headers as Record<string, string>, ...(files ? { files } : {}) };
    calls.push(call);
    const handler = handlers[operation];
    if (!handler) throw new Error(`fakeShopApi: no answer for ${operation}`);
    const answer = typeof handler === 'function' ? handler(call) : handler;
    return new Response(JSON.stringify({ data: answer.data ?? null, ...(answer.errors ? { errors: answer.errors } : {}) }), {
      status: answer.status ?? 200,
      headers: { 'content-type': 'application/json', ...answer.headers },
    });
  });
  vi.stubGlobal('fetch', fetch);
  return { calls, fetch, operations: () => calls.map((call) => call.operation) };
};

export const forbidden = { errors: [{ message: 'You are not currently authorized to perform this action', extensions: { code: 'FORBIDDEN' } }] };
