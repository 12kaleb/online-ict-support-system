import { z } from "zod";

const PASSWORD_MIN_LENGTH = 6;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.email("A valid email address is required."),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
  department: z.string().trim().min(1, "Department is required."),
});

export const loginSchema = z.object({
  email: z.email("A valid email address is required."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.email("A valid email address is required."),
  role: z.enum(["manager", "technician"]),
  department: z.string().trim().min(1, "Department is required."),
});

export const setupPasswordSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required."),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
});

export const allowedEmailSchema = z.object({
  email: z.email("A valid email address is required."),
});
