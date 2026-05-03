import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "no-reply@ict-support.local";

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

  return transporterPromise;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.warn(`SMTP is not configured. Skipping email delivery to ${input.to}.`);
    console.log(input.text);
    return { delivered: false as const };
  }

  await transporter.sendMail({
    from: smtpFrom,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  return { delivered: true as const };
}
