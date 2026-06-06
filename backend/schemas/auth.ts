import { z } from "zod";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_STRENGTH_MESSAGE = "Password must be at least 8 characters and include both letters and numbers.";
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_MESSAGE)
  .regex(/[A-Za-z]/, PASSWORD_STRENGTH_MESSAGE)
  .regex(/[0-9]/, PASSWORD_STRENGTH_MESSAGE);

const lettersOnlyRegex = /^[\p{L}\s]+$/u;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").refine(val => lettersOnlyRegex.test(val), "Name must contain only letters."),
  email: z.string().email("A valid email address is required."),
  password: passwordSchema,
  department: z.string().trim().min(1, "Department is required.").refine(val => lettersOnlyRegex.test(val), "Department must contain only letters."),
});

export const loginSchema = z.object({
  email: z.string().email("A valid email address is required."),
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional(),
});

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").refine(val => lettersOnlyRegex.test(val), "Name must contain only letters."),
  email: z.string().email("A valid email address is required."),
  role: z.enum(["staff", "manager", "technician"]),
  department: z.string().trim().min(1, "Department is required.").refine(val => lettersOnlyRegex.test(val), "Department must contain only letters."),
});

export const setupPasswordSchema = z.object({
  token: z.string().trim().min(1, "Invite token is required."),
  password: passwordSchema,
});

export const allowedEmailSchema = z.object({
  email: z.string().email("A valid email address is required."),
});
