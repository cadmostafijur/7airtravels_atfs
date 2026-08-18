import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@7airtravels.local").toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "ChangeMe_Admin1!";
  const name = process.env.ADMIN_BOOTSTRAP_NAME ?? "System Administrator";
  const resetPassword = process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD !== "false";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      name,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      ...(resetPassword ? { passwordHash } : {}),
    },
    create: {
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Admin account ready.");
  console.log(`Email:    ${admin.email}`);
  console.log(`Name:     ${admin.name}`);
  console.log(`Role:     ${admin.role}`);
  if (resetPassword) {
    console.log("Password: updated from ADMIN_BOOTSTRAP_PASSWORD in .env");
  } else {
    console.log("Password: unchanged (set ADMIN_BOOTSTRAP_RESET_PASSWORD=false to keep existing password)");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
