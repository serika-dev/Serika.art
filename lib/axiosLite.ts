// The browser bundle's "axios" (aliased in next.config.ts). The real axios is
// ~20 KB gzipped on every page; the client code only ever does JSON requests
// to our own API, which this covers with fetch: get/post/put/patch/delete,
// `params`, `headers`, `signal`, `response.data`, and axios-style errors
// (`error.response.status/data`, `axios.isAxiosError`). Server code keeps the
// real axios (danbooru imports need arraybuffers and timeouts).

type Params = Record<string, unknown>;

export interface AxiosRequestConfig {
  params?: Params;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  baseURL?: string;
  withCredentials?: boolean;
}

export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: AxiosRequestConfig;
}

export class AxiosError<T = any> extends Error {
  isAxiosError = true as const;
  response?: AxiosResponse<T>;
  code?: string;
  constructor(message: string, response?: AxiosResponse<T>, code?: string) {
    super(message);
    this.name = 'AxiosError';
    this.response = response;
    this.code = code;
  }
}

function appendParam(search: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) value.forEach((v) => appendParam(search, `${key}[]`, v));
  else if (value instanceof Date) search.append(key, value.toISOString());
  else if (typeof value === 'object') search.append(key, JSON.stringify(value));
  else search.append(key, String(value));
}

function buildUrl(url: string, config?: AxiosRequestConfig) {
  let full = config?.baseURL && !/^https?:\/\//.test(url) ? config.baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '') : url;
  if (config?.params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(config.params)) appendParam(search, k, v);
    const qs = search.toString();
    if (qs) full += (full.includes('?') ? '&' : '?') + qs;
  }
  return full;
}

function encodeBody(data: unknown, headers: Record<string, string>): BodyInit | undefined {
  if (data === undefined) return undefined;
  if (data instanceof FormData) {
    // Like real axios: drop any Content-Type the caller set ("multipart/form-data"
    // without a boundary) so the browser writes the full header with the
    // boundary. Without it the server can't split the parts and every upload
    // fails with "Failed to parse body as FormData".
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-type') delete headers[key];
    }
    return data;
  }
  if (
    typeof data === 'string' ||
    data instanceof FormData ||
    data instanceof Blob ||
    data instanceof URLSearchParams ||
    data instanceof ArrayBuffer
  ) {
    return data as BodyInit;
  }
  if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
  return JSON.stringify(data);
}

async function request<T>(method: string, url: string, data: unknown, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
  const headers: Record<string, string> = { Accept: 'application/json, text/plain, */*', ...(config.headers || {}) };
  let res: Response;
  try {
    res = await fetch(buildUrl(url, config), {
      method,
      headers,
      body: encodeBody(data, headers),
      signal: config.signal,
      credentials: config.withCredentials ? 'include' : 'same-origin',
    });
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    throw new AxiosError(aborted ? 'canceled' : 'Network Error', undefined, aborted ? 'ERR_CANCELED' : 'ERR_NETWORK');
  }

  const text = await res.text();
  let body: unknown = text;
  if (text && (res.headers.get('content-type') || '').includes('json')) {
    try {
      body = JSON.parse(text);
    } catch {
      // leave it as text
    }
  } else if (!text) {
    body = '';
  }

  const response: AxiosResponse<T> = {
    data: body as T,
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
    config,
  };
  if (!res.ok) {
    throw new AxiosError(`Request failed with status code ${res.status}`, response, res.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST');
  }
  return response;
}

function create(defaults: AxiosRequestConfig = {}) {
  const merge = (config?: AxiosRequestConfig): AxiosRequestConfig => ({
    ...defaults,
    ...config,
    headers: { ...(defaults.headers || {}), ...(config?.headers || {}) },
    params: defaults.params || config?.params ? { ...(defaults.params || {}), ...(config?.params || {}) } : undefined,
  });
  return {
    get: <T = any>(url: string, config?: AxiosRequestConfig) => request<T>('GET', url, undefined, merge(config)),
    delete: <T = any>(url: string, config?: AxiosRequestConfig & { data?: unknown }) => request<T>('DELETE', url, config?.data, merge(config)),
    post: <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>('POST', url, data, merge(config)),
    put: <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>('PUT', url, data, merge(config)),
    patch: <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>('PATCH', url, data, merge(config)),
    isAxiosError: (e: unknown): e is AxiosError => !!e && (e as AxiosError).isAxiosError === true,
    create,
  };
}

const axios = create();
export const isAxiosError = axios.isAxiosError;
export default axios;
