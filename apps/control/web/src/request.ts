import type { IncomingMessage, ServerResponse } from "node:http";

const sessionCookieName = "shp_session";
const localeCookieName = "shp_lang";

export type WebLocale = "en" | "es";

export function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function writeHtml(
  response: ServerResponse,
  statusCode: number,
  html: string,
  headers: Record<string, string> = {}
): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    ...headers
  });
  response.end(html);
}

export function redirect(
  response: ServerResponse,
  location: string,
  cookie?: string | string[]
): void {
  response.writeHead(303, {
    location,
    ...(cookie ? { "set-cookie": cookie } : {})
  });
  response.end();
}

export async function readTextBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function readFormBody(
  request: IncomingMessage
): Promise<URLSearchParams> {
  return new URLSearchParams(await readTextBody(request));
}

export function parseCookies(request: IncomingMessage): Map<string, string> {
  const cookies = new Map<string, string>();
  const header = request.headers.cookie;

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (!rawName) {
      continue;
    }

    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

export function readSessionToken(request: IncomingMessage): string | null {
  return parseCookies(request).get(sessionCookieName) ?? null;
}

export function normalizeLocale(value: string | null | undefined): WebLocale {
  return value === "en" ? "en" : "es";
}

export function readLocale(request: IncomingMessage): WebLocale {
  const cookieLocale = parseCookies(request).get(localeCookieName);

  if (cookieLocale === "en" || cookieLocale === "es") {
    return cookieLocale;
  }

  const acceptLanguage = request.headers["accept-language"];

  if (typeof acceptLanguage === "string" && !acceptLanguage.toLowerCase().includes("es")) {
    return "en";
  }

  return "es";
}

export function serializeSessionCookie(token: string, expiresAt: string): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );

  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function serializeLocaleCookie(locale: WebLocale): string {
  return `${localeCookieName}=${encodeURIComponent(locale)}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
