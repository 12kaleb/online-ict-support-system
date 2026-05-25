import { sendMail } from "./mailer.js";

function getBaseUrl(baseUrl?: string) {
  if (baseUrl) {
    return baseUrl.replace(/\/+$/, "");
  }

  return (process.env.APP_BASE_URL || "https://domain.com").replace(/\/+$/, "");
}

export function buildInviteUrl(token: string, baseUrl?: string) {
  return `${getBaseUrl(baseUrl)}/setup-password?token=${encodeURIComponent(token)}`;
}

export async function sendInviteEmail(input: {
  email: string;
  name: string;
  role: string;
  inviteUrl: string;
}) {
  const subject = `You're invited to the ICT Support System as ${input.role}`;
  const text = [
    `Hello ${input.name},`,
    "",
    `You have been invited to join the ICT Support System as a ${input.role}.`,
    `Set your password using this secure link: ${input.inviteUrl}`,
    "",
    "This invite expires in 24 hours.",
  ].join("\n");

  const html = [
    `<p>Hello ${input.name},</p>`,
    `<p>You have been invited to join the ICT Support System as a <strong>${input.role}</strong>.</p>`,
    `<p><a href="${input.inviteUrl}">Set your password</a></p>`,
    "<p>This invite expires in 24 hours.</p>",
  ].join("");

  return sendMail({
    to: input.email,
    subject,
    text,
    html,
  });
}
