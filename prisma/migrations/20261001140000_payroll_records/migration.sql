-- AlterTable
ALTER TABLE "PayrollSetting" ADD COLUMN "absentGroupSize" INTEGER NOT NULL DEFAULT 3;

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PAID');

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "monthlySalary" INTEGER NOT NULL,
    "salaryOverridden" BOOLEAN NOT NULL DEFAULT false,
    "workingDays" INTEGER NOT NULL,
    "presentDays" INTEGER NOT NULL,
    "lateDays" INTEGER NOT NULL,
    "absentDays" INTEGER NOT NULL,
    "countedAbsentDays" INTEGER NOT NULL,
    "calculatedFine" INTEGER NOT NULL,
    "absentFine" INTEGER NOT NULL,
    "fineOverridden" BOOLEAN NOT NULL DEFAULT false,
    "adjustedSalary" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_month_key" ON "PayrollRecord"("employeeId", "month");
CREATE INDEX "PayrollRecord_month_status_idx" ON "PayrollRecord"("month", "status");
CREATE INDEX "PayrollRecord_status_paidAt_idx" ON "PayrollRecord"("status", "paidAt");

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check-in after 10:10 counts as late on the default office shift.
UPDATE "Shift" SET "lateThreshold" = '10:10' WHERE "isDefault" = true;
