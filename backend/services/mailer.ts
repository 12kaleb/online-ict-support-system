import nodemailer from "nodemailer";
import dns from "node:dns";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "no-reply@ict-support.local";

dns.setDefaultResultOrder("ipv4first");

let transporterPromise: Promise<nodemailer.Transporter | null> | null = null;

async function getTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    if (!smtpHost || !smtpUser || !smtpPass) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
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

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass);
  const transporter = await getTransporter().catch((err) => {
    console.error(`SMTP connection failed. Skipping email delivery to ${input.to}.`, err);
    return null;
  });

  if (!transporter) {
    const reason = hasSmtpConfig ? "SMTP is unavailable" : "SMTP is not configured";
    console.warn(`${reason}. Skipping email delivery to ${input.to}.`);
    console.log(input.text);
    return { delivered: false as const };
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
    console.error(`SMTP send failed. Skipping email delivery to ${input.to}.`, err);
    return { delivered: false as const };
  }

  return { delivered: true as const };
}
