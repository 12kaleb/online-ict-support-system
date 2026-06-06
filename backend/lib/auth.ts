import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { ZodError, ZodType } from "zod";
import { PASSWORD_MIN_LENGTH } from "../config/app.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "ict-support-secret-key-123") {
  throw new Error("JWT_SECRET must be set to a strong unique value.");
}

const JWT_SECRET = process.env.JWT_SECRET;

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function signAuthToken(profile: { id: string; email: string; role: string }) {
  return jwt.sign(
    {
      sub: profile.id,
      email: profile.email,
      role: profile.role,
    } satisfies AuthTokenPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function isValidPassword(password?: string) {
  return typeof password === "string"
    && password.length >= PASSWORD_MIN_LENGTH
    && /[A-Za-z]/.test(password)
    && /[0-9]/.test(password);
}

export function formatValidationError(error: ZodError) {
  const issue = error.issues[0];
  return issue?.message || "Invalid request payload.";
}

export function parseBody<T>(schema: ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const err = new Error(formatValidationError(parsed.error)) as Error & { status?: number; code?: string };
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  return parsed.data;
}
