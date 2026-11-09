import type { VendureDocument } from './operations';
import {
  API_KEY_REQUEST_HEADER,
  CHANNEL_TOKEN_REQUEST_HEADER,
  REQUEST_TIMEOUT_MS,
  SESSION_TOKEN_RESPONSE_HEADER,
  UPLOAD_TIMEOUT_MS,
} from '../const';
import { isErrorResult, mapVendureError, VendureApiError, type VendureFailureContext } from '../errors/mapVendureError';

export interface VendureClientOptions {
  /** The Shop API or the Admin API endpoint. */
  apiUrl: string;
  channelToken?: string;
  /**
   * An Admin API key, sent as `vendure-api-key`. A client with a key acts as the key's role and
   * keeps no session.
   */
  apiKey?: string;
  /** Sent as `?languageCode=`; unset leaves the channel's default language. */
  languageCode?: string;
  /** Sent as `?currencyCode=`; unset leaves the channel's default currency. */
  currencyCode?: string;
  /** The visitor's session, restored from the storefront's cookie. */
  sessionToken?: string;
  /** Called when Vendure issues or rotates the session token, to persist it. */
  onSessionToken?: (token: string) => void;
}

export interface GraphQLError {
  message?: string;
  path?: (string | number)[];
  extensions?: { code?: string };
}

interface GraphQLResponse<TData> {
  data?: TData | null;
  errors?: GraphQLError[];
}

/** A file sent with a multipart request, at the variable path it fills (`input.0.file`). */
export interface UploadPart {
  variablePath: string;
  file: Blob;
  fileName: string;
}

const JSON_CONTENT = { 'Content-Type': 'application/json' };

/** Fields of the answer whose value is a union that may be an `ErrorResult`. */
type UnionField<TData> = Extract<keyof TData, string>;

/**
 * One Vendure API endpoint: the Shop API for one visitor's request, or the Admin API with a key.
 *
 * Vendure keeps the cart and the signed-in customer in one session token. It arrives in a response
 * header and goes back as a bearer token; the client keeps the newest one for the rest of the request
 * and hands it to `onSessionToken`.
 */
export class VendureClient {
  private sessionToken: string | undefined;

  constructor(private readonly options: VendureClientOptions) {
    this.sessionToken = options.sessionToken || undefined;
  }

  get hasSession(): boolean {
    return !!this.sessionToken;
  }

  /**
   * A client for the same channel and language with no session, whose tokens are not kept: for a
   * call whose session must not become the visitor's (a password reset signs the customer in).
   */
  withoutSession(): VendureClient {
    return new VendureClient({ ...this.options, sessionToken: undefined, onSessionToken: undefined });
  }

  /** Forgets the session for the rest of this request, after Vendure ended it. */
  dropSession(): void {
    this.sessionToken = undefined;
  }

  /**
   * Runs one operation. A top-level GraphQL error is thrown through `mapVendureError`, with
   * `context` naming what the operation was about.
   */
  async request<TData, TVariables>(
    document: VendureDocument<TData, TVariables>,
    variables?: TVariables,
    context?: VendureFailureContext
  ): Promise<TData> {
    return this.dataOf(await this.payloadOf<TData>(JSON.stringify({ query: document, variables }), JSON_CONTENT), context);
  }

  /**
   * Runs one operation with files, as the GraphQL multipart request: the variables name each file
   * `null`, and the `map` part says which file fills which. Vendure takes uploads only this way.
   */
  async requestWithFiles<TData, TVariables>(
    document: VendureDocument<TData, TVariables>,
    variables: TVariables,
    parts: readonly UploadPart[],
    context?: VendureFailureContext
  ): Promise<TData> {
    const form = new FormData();
    form.append('operations', JSON.stringify({ query: document, variables }));
    form.append('map', JSON.stringify(Object.fromEntries(parts.map((part, index) => [String(index), [`variables.${part.variablePath}`]]))));
    parts.forEach((part, index) => form.append(String(index), part.file, part.fileName));
    // The multipart body sets its own content type; the extra header passes the server's CSRF guard,
    // which refuses a multipart request a browser form could have sent.
    return this.dataOf(await this.payloadOf<TData>(form, { 'apollo-require-preflight': 'true' }, UPLOAD_TIMEOUT_MS), context);
  }

  /**
   * Runs one operation and answers its errors beside whatever data came back, for an operation of
   * several aliased fields whose failures are told apart by their `path`. Only a failure of the
   * whole request throws.
   */
  async requestEach<TData, TVariables>(
    document: VendureDocument<TData, TVariables>,
    variables?: TVariables
  ): Promise<{ data: TData | null; errors: GraphQLError[] }> {
    const payload = await this.payloadOf<TData>(JSON.stringify({ query: document, variables }), JSON_CONTENT);
    return { data: payload.data ?? null, errors: payload.errors ?? [] };
  }

  private async payloadOf<TData>(body: string | FormData, contentHeaders: Record<string, string>, timeoutMs = REQUEST_TIMEOUT_MS) {
    return this.parse<TData>(await this.received(await this.send(body, contentHeaders, timeoutMs)));
  }

  private dataOf<TData>(payload: GraphQLResponse<TData>, context: VendureFailureContext | undefined): TData {
    const firstError = payload.errors?.[0];
    if (firstError) {
      throw mapVendureError(
        { errorCode: firstError.extensions?.code, message: firstError.message },
        this.options.apiKey ? { ...context, viaApiKey: true } : context
      );
    }
    if (!payload.data) throw new VendureApiError(undefined, 'empty GraphQL data');

    return payload.data;
  }

  private async received(response: Response): Promise<Response> {
    // Read before anything can throw: Vendure issues the token on the call that creates the
    // session, and losing it there loses the cart on the next request. A key carries no session.
    const issued = this.options.apiKey ? null : response.headers.get(SESSION_TOKEN_RESPONSE_HEADER);
    if (issued && issued !== this.sessionToken) {
      this.sessionToken = issued;
      this.options.onSessionToken?.(issued);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new VendureApiError(`HTTP_${response.status}`, body.slice(0, 300));
    }
    return response;
  }

  /**
   * Runs a mutation whose `field` answers an error union, and throws the `ErrorResult` member
   * through `mapVendureError`. Answers the payload member.
   */
  async mutate<TData, TVariables, TField extends UnionField<TData>>(
    document: VendureDocument<TData, TVariables>,
    variables: TVariables,
    field: TField,
    context?: VendureFailureContext
  ): Promise<Exclude<TData[TField], { errorCode: unknown }>> {
    const data = await this.request(document, variables, context);
    const result = data[field];
    if (isErrorResult(result)) throw mapVendureError(result, context);
    if (result === null || result === undefined) throw new VendureApiError(undefined, `${field} answered nothing`);
    return result as Exclude<TData[TField], { errorCode: unknown }>;
  }

  private async send(body: string | FormData, contentHeaders: Record<string, string>, timeoutMs: number): Promise<Response> {
    try {
      return await fetch(this.url(), {
        method: 'POST',
        headers: { ...this.headers(), ...contentHeaders },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new VendureApiError(timedOut ? 'TIMEOUT' : 'NETWORK', timedOut ? `no answer within ${timeoutMs} ms` : String(error));
    }
  }

  /** A proxy in front of Vendure may answer an HTML error page with status 200. */
  private async parse<TData>(response: Response): Promise<GraphQLResponse<TData>> {
    try {
      return (await response.json()) as GraphQLResponse<TData>;
    } catch {
      throw new VendureApiError('INVALID_RESPONSE', `not JSON (${response.headers.get('content-type') ?? 'no content type'})`);
    }
  }

  private url(): string {
    const url = new URL(this.options.apiUrl);
    if (this.options.languageCode) url.searchParams.set('languageCode', this.options.languageCode);
    if (this.options.currencyCode) url.searchParams.set('currencyCode', this.options.currencyCode);
    return url.toString();
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(this.options.channelToken ? { [CHANNEL_TOKEN_REQUEST_HEADER]: this.options.channelToken } : {}),
      ...(this.options.apiKey ? { [API_KEY_REQUEST_HEADER]: this.options.apiKey } : {}),
      ...(this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {}),
    };
  }
}
