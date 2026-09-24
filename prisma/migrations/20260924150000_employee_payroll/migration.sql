-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "monthlySalary" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN "latePenalty" INTEGER;
ALTER TABLE "Employee" ADD COLUMN "absentPenalty" INTEGER;

-- CreateTable
CREATE TABLE "PayrollSetting" (
    "id" TEXT NOT NULL,
    "latePenalty" INTEGER NOT NULL DEFAULT 200,
    "absentPenalty" INTEGER NOT NULL DEFAULT 500,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PayrollSetting" ("id", "latePenalty", "absentPenalty", "currency", "createdAt", "updatedAt")
VALUES ('default', 200, 500, 'BDT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
