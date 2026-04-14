import type { IncomingMessage, ServerResponse } from "node:http";

export function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function writeText(
  response: ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/plain; charset=utf-8"
): void {
  response.writeHead(statusCode, {
    "content-type": contentType
  });
  response.end(body);
}

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

export function readBearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;

  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

export function matchRoute(pathname: string, pattern: RegExp): RegExpMatchArray | null {
  return pathname.match(pattern);
}

export function readIntegerSearchParam(
  url: URL,
  name: string,
  fallback: number,
  options: {
    min?: number;
    max?: number;
  } = {}
): number {
  const parsed = Number.parseInt(url.searchParams.get(name) ?? "", 10);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  const min = options.min ?? Number.MIN_SAFE_INTEGER;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;

  return Math.max(min, Math.min(max, parsed));
}
