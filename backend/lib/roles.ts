export const isAdminRole = (role?: string) => role === "admin";
export const isManagerRole = (role?: string) => role === "manager" || role === "admin";
export const isTechnicianRole = (role?: string) => role === "technician" || isManagerRole(role);
export const isStaffRole = (role?: string) => role === "staff" || isTechnicianRole(role);
export const isInventoryRole = (role?: string) => isTechnicianRole(role);
export const isActiveStatus = (status?: string) => status === "active";
