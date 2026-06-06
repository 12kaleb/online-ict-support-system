import nodemailer from "nodemailer";
import dns from "node:dns";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "no-reply@ict-support.local";
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM || smtpFrom;
const gmailClientId = process.env.GMAIL_CLIENT_ID;
const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
const gmailFrom = process.env.GMAIL_FROM || smtpFrom;

dns.setDefaultResultOrder("ipv4first");

let transporterPromise: Promise<nodemailer.Transporter | null> | null = null;

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function encodeHeader(value: string) {
  return /[^\x00-\x7F]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
    : value;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMimeMessage(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const boundary = `ict-support-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return [
    `From: ${gmailFrom}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

async function getSmtpHostConfig() {
  if (!smtpHost) {
    return null;
  }

  const forceIpv4 = process.env.SMTP_FORCE_IPV4 !== "false";
  if (!forceIpv4) {
    return { host: smtpHost };
  }

  const { address } = await dns.promises.lookup(smtpHost, { family: 4 });
  return {
    host: address,
    tls: {
      servername: smtpHost,
    },
  };
}

async function getTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    if (!smtpHost || !smtpUser || !smtpPass) {
      return null;
    }

    const hostConfig = await getSmtpHostConfig();
    if (!hostConfig) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      ...hostConfig,
      port: smtpPort,
      secure: smtpPort === 465,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.verify();
    return transporter;
  })();

  try {
    return await transporterPromise;
  } catch (err) {
    transporterPromise = null;
    throw err;
  }
}

async function sendWithResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!resendApiKey) {
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend API error ${response.status}: ${details.slice(0, 300)}`);
  }

  return { delivered: true as const, provider: "resend" as const };
}

async function getGmailAccessToken() {
  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: gmailClientId,
      client_secret: gmailClientSecret,
      refresh_token: gmailRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => null) as { access_token?: string } | null;
  if (!response.ok) {
    throw new Error(`Gmail token error ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  if (!data?.access_token) {
    throw new Error("Gmail token response did not include an access token");
  }

  return data.access_token as string;
}

async function sendWithGmailApi(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return null;
  }

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodeBase64Url(buildMimeMessage(input)),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gmail API error ${response.status}: ${details.slice(0, 300)}`);
  }

  return { delivered: true as const, provider: "gmail-api" as const };
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  try {
    const gmailResult = await sendWithGmailApi(input);
    if (gmailResult) {
      return gmailResult;
    }
  } catch (err) {
    console.error(`Gmail API send failed. Falling back to other email providers for ${input.to}.`, err);
    if (!resendApiKey && (!smtpHost || !smtpUser || !smtpPass)) {
      const reason = `Gmail API send failed: ${errorMessage(err)}`;
      console.log(input.text);
      return { delivered: false as const, reason };
    }
  }

  try {
    const resendResult = await sendWithResend(input);
    if (resendResult) {
      return resendResult;
    }
  } catch (err) {
    const reason = `Resend send failed: ${errorMessage(err)}`;
    console.error(`Resend send failed. Falling back to SMTP for ${input.to}.`, err);
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(input.text);
      return { delivered: false as const, reason };
    }
  }

  const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass);
  let failedReason = hasSmtpConfig ? "SMTP is unavailable" : "SMTP is not configured";
  const transporter = await getTransporter().catch((err) => {
    failedReason = `SMTP connection failed: ${errorMessage(err)}`;
    console.error(`SMTP connection failed. Skipping email delivery to ${input.to}.`, err);
    return null;
  });

  if (!transporter) {
    console.warn(`${failedReason}. Skipping email delivery to ${input.to}.`);
    console.log(input.text);
    return { delivered: false as const, reason: failedReason };
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (err) {
    const reason = `SMTP send failed: ${errorMessage(err)}`;
    console.error(`SMTP send failed. Skipping email delivery to ${input.to}.`, err);
    return { delivered: false as const, reason };
  }

  return { delivered: true as const };
}
