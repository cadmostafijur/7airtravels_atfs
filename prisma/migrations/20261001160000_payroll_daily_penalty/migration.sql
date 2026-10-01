-- Late time is stored in minutes. Daily absent penalty is salary / working days.
ALTER TABLE "PayrollRecord" ADD COLUMN "lateMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PayrollRecord" ADD COLUMN "dailyPenalty" INTEGER NOT NULL DEFAULT 0;
