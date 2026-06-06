export function parseOrigin(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export const configuredOrigins = [
  parseOrigin(process.env.APP_BASE_URL),
  parseOrigin(process.env.FRONTEND_ORIGIN),
  "https://localhost:3001",
  "http://localhost:3001",
  "https://127.0.0.1:3001",
  "http://127.0.0.1:3001",
].filter(Boolean) as string[];

export function isAllowedOrigin(origin?: string) {
  const parsedOrigin = parseOrigin(origin);
  return Boolean(parsedOrigin && configuredOrigins.includes(parsedOrigin));
}

export function parseCookieHeader(header?: string) {
  return Object.fromEntries(
    (header || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, separatorIndex).trim()),
          decodeURIComponent(part.slice(separatorIndex + 1).trim()),
        ];
      }),
  );
}
