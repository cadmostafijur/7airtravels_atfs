-- Make joining date optional and add NID fields
ALTER TABLE "Employee" ALTER COLUMN "joinedAt" DROP NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "joinedAt" DROP DEFAULT;
ALTER TABLE "Employee" ADD COLUMN "nidNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN "nidDocumentUrl" TEXT;
