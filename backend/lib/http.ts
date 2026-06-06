export function parseOrigin(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseOriginList(value?: string) {
  return (value || "")
    .split(",")
    .map((origin) => parseOrigin(origin.trim()))
    .filter(Boolean) as string[];
}

export const configuredOrigins = [
  ...parseOriginList(process.env.APP_BASE_URL),
  ...parseOriginList(process.env.FRONTEND_ORIGIN),
  "https://localhost:3001",
  "http://localhost:3001",
  "https://127.0.0.1:3001",
  "http://127.0.0.1:3001",
].filter(Boolean) as string[];

function isVercelOrigin(origin: string) {
  const { hostname, protocol } = new URL(origin);
  return protocol === "https:" && hostname.endsWith(".vercel.app");
}

export function isAllowedOrigin(origin?: string) {
  const parsedOrigin = parseOrigin(origin);
  return Boolean(
    parsedOrigin
      && (configuredOrigins.includes(parsedOrigin) || isVercelOrigin(parsedOrigin)),
  );
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
