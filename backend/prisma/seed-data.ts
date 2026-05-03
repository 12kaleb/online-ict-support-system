export type SeedUser = {
  name: string;
  email: string;
  role: "staff" | "technician" | "manager" | "admin";
  department?: string;
  passwordEnv: string;
};

export const seedUsers: SeedUser[] = [
  {
    name: "Admin User",
    email: "kalebteshome94@gmail.com",
    role: "admin",
    department: "ICT",
    passwordEnv: "SEED_ADMIN_PASSWORD",
  },
  {
    name: "Manager User",
    email: "manager@example.com",
    role: "manager",
    department: "ICT",
    passwordEnv: "SEED_MANAGER_PASSWORD",
  },
  {
    name: "Technician User",
    email: "tech@example.com",
    role: "technician",
    department: "ICT",
    passwordEnv: "SEED_TECHNICIAN_PASSWORD",
  },
  {
    name: "Staff User",
    email: "staff@example.com",
    role: "staff",
    department: "Operations",
    passwordEnv: "SEED_STAFF_PASSWORD",
  },
];

export function getSeedPassword(envName: string) {
  const password = process.env[envName] || process.env.SEED_DEFAULT_PASSWORD;
  if (!password) {
    throw new Error(
      `Missing ${envName}. Set it in .env or provide SEED_DEFAULT_PASSWORD before running the seed scripts.`,
    );
  }

  return password;
}
