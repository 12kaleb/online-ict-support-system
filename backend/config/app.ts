export const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const TELEGRAM_LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 8;
export const JWT_COOKIE_NAME = "token";
export const HIGH_PRIORITY_LEVELS = new Set(["high", "critical"]);

export const isProduction = process.env.NODE_ENV === "production";

export const cookieOptions: {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
} = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
};

export const TICKET_TEMPLATES: Record<string, { category: string; title: string; description: string; priority: string }> = {
  network: {
    category: "Network",
    title: "Network connectivity issue",
    description: "Describe the location, affected device, error message, and whether other users are impacted.",
    priority: "high",
  },
  hardware: {
    category: "Hardware",
    title: "Hardware fault or damage",
    description: "Describe the device, symptoms, and whether the device is still usable.",
    priority: "medium",
  },
  account: {
    category: "Account/Access",
    title: "Account or access issue",
    description: "Describe the account, affected system, and what access is missing or failing.",
    priority: "medium",
  },
  software: {
    category: "Software",
    title: "Software/application issue",
    description: "Describe the application, steps taken, and exact error shown.",
    priority: "medium",
  },
};
