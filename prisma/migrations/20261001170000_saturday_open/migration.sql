-- Friday is the only weekly closed day. Saturday is a working day.
ALTER TABLE "Shift" ALTER COLUMN "weekendDays" SET DEFAULT ARRAY[5]::INTEGER[];
UPDATE "Shift" SET "weekendDays" = ARRAY[5]::INTEGER[] WHERE "isDefault" = true;
