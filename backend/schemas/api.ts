import { z } from "zod";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_STRENGTH_MESSAGE = "Password must be at least 8 characters and include both letters and numbers.";
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_MESSAGE)
  .regex(/[A-Za-z]/, PASSWORD_STRENGTH_MESSAGE)
  .regex(/[0-9]/, PASSWORD_STRENGTH_MESSAGE);

const optionalTrimmedString = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().trim().optional(),
);

const requiredTrimmedString = (field: string, max = 500) =>
  z.string({ error: `${field} is required.` }).trim().min(1, `${field} is required.`).max(max, `${field} is too long.`);

const optionalNullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(max, "Value is too long.").nullable().optional(),
  );

const positiveInteger = (field: string) =>
  z.coerce.number({ error: `${field} must be a number.` }).int(`${field} must be a whole number.`).min(1, `${field} must be at least 1.`);

const nonNegativeInteger = (field: string) =>
  z.coerce.number({ error: `${field} must be a number.` }).int(`${field} must be a whole number.`).min(0, `${field} cannot be negative.`);

const dateString = (field: string) =>
  z.string({ error: `${field} is required.` }).trim().refine((value) => !Number.isNaN(Date.parse(value)), `${field} must be a valid date.`);

const isFutureOrCurrentDate = (value: string) => new Date(value).getTime() >= Date.now() - 60_000;

const MAX_ATTACHMENT_DATA_URL_LENGTH = 2_500_000;
const allowedAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const optionalId = z.preprocess((value) => (value === "" || value === null ? undefined : value), z.uuid().optional());
const optionalNullableId = z.preprocess((value) => (value === "" ? null : value), z.uuid().nullable().optional());
const coordinateSchema = z.object({
  latitude: z.coerce.number({ error: "Latitude must be a number." }).min(-90, "Latitude must be between -90 and 90.").max(90, "Latitude must be between -90 and 90."),
  longitude: z.coerce.number({ error: "Longitude must be a number." }).min(-180, "Longitude must be between -180 and 180.").max(180, "Longitude must be between -180 and 180."),
  accuracy: z.coerce.number({ error: "Location accuracy must be a number." }).min(0, "Location accuracy cannot be negative.").optional(),
});

export const roleSchema = z.enum(["staff", "technician", "manager", "admin"]);
export const userStatusSchema = z.enum(["pending", "active", "disabled"]);
export const ticketStatusSchema = z.enum(["open", "in-progress", "pending-confirmation", "resolved", "closed"]);
export const ticketPrioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const assetStatusSchema = z.enum(["active", "maintenance", "retired", "requested"]);
export const maintenanceStatusSchema = z.enum(["scheduled", "in-progress", "completed"]);
export const approvalResponseStatusSchema = z.enum(["approved", "rejected"]);

export const attachmentSchema = z.object({
  name: requiredTrimmedString("Attachment name", 255),
  url: requiredTrimmedString("Attachment data", MAX_ATTACHMENT_DATA_URL_LENGTH),
  type: requiredTrimmedString("Attachment type", 255),
}).superRefine((attachment, ctx) => {
  const match = attachment.url.match(/^data:([^;,]+);base64,/i);
  const mimeType = match?.[1]?.toLowerCase();

  if (!mimeType || !allowedAttachmentTypes.has(mimeType)) {
    ctx.addIssue({
      code: "custom",
      path: ["url"],
      message: "Attachment must be a PDF, image, or plain text file.",
    });
    return;
  }

  if (attachment.type.toLowerCase() !== mimeType) {
    ctx.addIssue({
      code: "custom",
      path: ["type"],
      message: "Attachment type does not match the uploaded file data.",
    });
  }
});

export const createTicketSchema = z.object({
  title: optionalTrimmedString,
  description: optionalTrimmedString,
  category: optionalTrimmedString,
  priority: ticketPrioritySchema.optional(),
  assetId: optionalId,
  location: coordinateSchema.optional(),
  buildingBlockNo: requiredTrimmedString("Building block number", 120),
  roomNumber: requiredTrimmedString("Room number", 120),
  attachments: z.array(attachmentSchema).max(10, "A ticket can include up to 10 attachments.").optional(),
  templateKey: optionalTrimmedString,
});

export const updateTicketSchema = z.object({
  status: ticketStatusSchema.optional(),
  assignedTo: optionalNullableId,
  priority: ticketPrioritySchema.optional(),
});

export const assignTicketSchema = z.object({
  assignedTo: optionalNullableId,
});

export const staffReviewSchema = z.object({
  approved: z.boolean({ error: "Approval must be true or false." }),
});

export const appealSchema = z.object({
  reason: requiredTrimmedString("Appeal reason", 2_000),
});

export const feedbackSchema = z.object({
  rating: z.coerce.number({ error: "Rating is required." }).int("Rating must be a whole number.").min(1, "Rating must be at least 1.").max(5, "Rating cannot be greater than 5."),
  comment: optionalNullableString(2_000),
});

export const assetTypeSchema = z.object({
  name: requiredTrimmedString("Name", 120),
});

export const assetSchema = z.object({
  name: requiredTrimmedString("Asset name", 255),
  brand: optionalNullableString(120),
  type: optionalTrimmedString,
  typeId: optionalNullableId,
  serialNo: optionalNullableString(120),
  quantity: positiveInteger("Quantity").optional().default(1),
  status: assetStatusSchema.optional().default("active"),
  minStockLevel: nonNegativeInteger("Minimum stock level").optional().default(0),
  isConsumable: z.boolean({ error: "Inventory kind is required." }).optional().default(false),
  assignedUserId: optionalNullableId,
  assignedDepartment: optionalNullableString(120),
});

export const updateAssetSchema = assetSchema.extend({
  quantity: nonNegativeInteger("Quantity").optional(),
  isConsumable: z.boolean({ error: "Inventory kind must be true or false." }).optional(),
  status: assetStatusSchema,
});

export const quantitySchema = z.object({
  quantity: positiveInteger("Quantity").optional().default(1),
});

export const assetMaintenanceSchema = z.object({
  type: requiredTrimmedString("Maintenance type", 120),
  scheduledDate: dateString("Scheduled date"),
  endDate: dateString("End date").optional(),
  description: requiredTrimmedString("Description", 2_000),
}).refine((value) => isFutureOrCurrentDate(value.scheduledDate), {
  message: "Scheduled date cannot be in the past.",
  path: ["scheduledDate"],
}).refine((value) => !value.endDate || new Date(value.endDate).getTime() > new Date(value.scheduledDate).getTime(), {
  message: "End date must be after the scheduled date.",
  path: ["endDate"],
});

export const updateMaintenanceStatusSchema = z.object({
  status: maintenanceStatusSchema,
});

export const delaySchema = z.object({
  delayReason: requiredTrimmedString("Delay reason", 2_000),
});

export const slaPauseSchema = z.object({
  blockingReason: optionalTrimmedString,
  delayReason: optionalTrimmedString,
}).refine((value) => Boolean(value.blockingReason || value.delayReason), {
  message: "A blocking reason is required to pause the SLA.",
});

export const maintenanceSchema = z.object({
  title: requiredTrimmedString("Title", 255),
  description: requiredTrimmedString("Description", 2_000),
  startTime: dateString("Start time"),
  endTime: dateString("End time"),
  type: requiredTrimmedString("Maintenance type", 120),
  technicianId: optionalNullableId,
  assetId: optionalNullableId,
}).refine((value) => isFutureOrCurrentDate(value.startTime), {
  message: "Start time cannot be in the past.",
  path: ["startTime"],
}).refine((value) => new Date(value.endTime).getTime() > new Date(value.startTime).getTime(), {
  message: "End time must be after start time.",
  path: ["endTime"],
});

export const maintenanceAssignSchema = z.object({
  technicianId: optionalNullableId,
});

export const maintenancePartSchema = z.object({
  assetId: z.uuid("Asset ID is invalid."),
  quantity: positiveInteger("Quantity").optional().default(1),
  notes: optionalNullableString(2_000),
});

export const approvalRequestSchema = z.object({
  type: requiredTrimmedString("Approval type", 120),
  reason: optionalNullableString(2_000),
  ticketId: optionalNullableId,
  assetId: optionalNullableId,
  maintenanceId: optionalNullableId,
}).refine((value) => Boolean(value.ticketId || value.assetId || value.maintenanceId), {
  message: "Approval request must reference a ticket, asset, or maintenance record.",
});

export const approvalResponseSchema = z.object({
  status: approvalResponseStatusSchema,
});

export const createUserSchema = z.object({
  name: requiredTrimmedString("Name", 120),
  email: z.email("A valid email address is required."),
  password: passwordSchema,
  role: roleSchema.optional().default("staff"),
  department: optionalNullableString(120),
});

export const updateUserSchema = z.object({
  name: requiredTrimmedString("Name", 120),
  email: z.email("A valid email address is required."),
  role: roleSchema.optional(),
  department: optionalNullableString(120),
});

export const updateUserRoleSchema = z.object({
  role: roleSchema,
});

export const updateUserPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateUserStatusSchema = z.object({
  status: userStatusSchema,
});

export const updateManagerUserPermissionSchema = z.object({
  canInviteStaff: z.boolean({ error: "Permission must be true or false." }),
});

export const commentSchema = z.object({
  message: requiredTrimmedString("Comment", 2_000),
  attachments: z.array(attachmentSchema).max(10, "A comment can include up to 10 attachments.").optional(),
  isInternal: z.boolean().optional().default(false),
});
