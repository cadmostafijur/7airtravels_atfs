import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@7airtravels.local").toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "ChangeMe_Admin1!";
  const name = process.env.ADMIN_BOOTSTRAP_NAME ?? "System Administrator";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    update: { name, status: "ACTIVE" },
    create: {
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  const operations = await prisma.department.upsert({
    where: { code: "OPS" },
    update: {},
    create: { name: "Operations", code: "OPS" },
  });
  await prisma.department.upsert({
    where: { code: "ACC" },
    update: {},
    create: { name: "Accounts", code: "ACC" },
  });
  await prisma.department.upsert({
    where: { code: "SAL" },
    update: {},
    create: { name: "Sales", code: "SAL" },
  });

  await prisma.shift.upsert({
    where: { name: "General Office" },
    update: {
      isDefault: true,
      officeStart: "09:00",
      lateThreshold: "10:10",
      officeEnd: "18:00",
    },
    create: {
      name: "General Office",
      isDefault: true,
      officeStart: "09:00",
      lateThreshold: "10:10",
      officeEnd: "18:00",
      halfDayAfter: "13:00",
      overtimeAfter: "18:30",
      weekendDays: [5, 6],
      timezone: process.env.APP_TIMEZONE ?? "Asia/Dhaka",
    },
  });

  const adapterType = process.env.DEVICE_ADAPTER === "k50a" ? "k50a" : "mock";
  const existingDevice = await prisma.device.findFirst({ where: { name: "K50A-001" } });
  if (!existingDevice) {
    await prisma.device.create({
      data: {
        name: "K50A-001",
        model: adapterType === "mock" ? "K50A-MOCK" : "K50A",
        adapterType,
        ipAddress: process.env.K50A_IP ?? "192.168.1.201",
        port: Number(process.env.K50A_PORT ?? 4370),
        location: process.env.K50A_LOCATION ?? "Main Office",
        timeoutMs: Number(process.env.K50A_TIMEOUT_MS ?? 10000),
        commKey: Number(process.env.K50A_COMM_KEY ?? 0),
      },
    });
  }

  await prisma.employee.upsert({
    where: { employeeCode: "EMP001" },
    update: {},
    create: {
      employeeCode: "EMP001",
      name: "Test Employee",
      phone: "01700000001",
      departmentId: operations.id,
      designation: "Acceptance Test",
      deviceUserId: "1001",
    },
  });
  await prisma.employee.upsert({
    where: { employeeCode: "EMP002" },
    update: {},
    create: {
      employeeCode: "EMP002",
      name: "Rahim Ahmed",
      phone: "01700000002",
      departmentId: operations.id,
      designation: "Ticketing Officer",
      deviceUserId: "1002",
    },
  });
  await prisma.employee.upsert({
    where: { employeeCode: "EMP003" },
    update: {},
    create: {
      employeeCode: "EMP003",
      name: "Karim Hasan",
      phone: "01700000003",
      departmentId: operations.id,
      designation: "Operations Executive",
      deviceUserId: "1003",
    },
  });

  await prisma.smsSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      enabled: false,
      adminPhone1: process.env.ADMIN_SMS_1 || null,
      adminPhone2: process.env.ADMIN_SMS_2 || null,
      adminPhone3: process.env.ADMIN_SMS_3 || null,
      notifyOnAttendance: true,
      notifyOnLate: true,
    },
  });

  console.log("Seed complete.");
  console.log(`Admin: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
