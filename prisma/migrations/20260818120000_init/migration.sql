-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeviceAdapterType" AS ENUM ('k50a', 'mock');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_IN', 'BREAK_OUT', 'OVERTIME_IN', 'OVERTIME_OUT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('FINGERPRINT', 'PASSWORD', 'CARD', 'FACE', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('DEVICE', 'MANUAL', 'SIMULATION');

-- CreateEnum
CREATE TYPE "DailyStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EARLY_LEAVE', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND', 'OVERTIME');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "departmentId" TEXT,
    "designation" TEXT,
    "deviceUserId" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'K50A',
    "adapterType" "DeviceAdapterType" NOT NULL DEFAULT 'k50a',
    "serialNumber" TEXT,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "location" TEXT,
    "commKey" INTEGER NOT NULL DEFAULT 0,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastConnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "totalSynced" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "deviceId" TEXT NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "deviceTransactionId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "attendanceType" "AttendanceType" NOT NULL DEFAULT 'UNKNOWN',
    "verificationMethod" "VerificationMethod" NOT NULL DEFAULT 'FINGERPRINT',
    "source" "AttendanceSource" NOT NULL DEFAULT 'DEVICE',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendanceSummary" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "workDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "status" "DailyStatus" NOT NULL,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAttendanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "officeStart" TEXT NOT NULL,
    "lateThreshold" TEXT NOT NULL,
    "officeEnd" TEXT NOT NULL,
    "halfDayAfter" TEXT NOT NULL DEFAULT '13:00',
    "overtimeAfter" TEXT NOT NULL DEFAULT '18:30',
    "weekendDays" INTEGER[] DEFAULT ARRAY[5, 6]::INTEGER[],
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "adminPhone1" TEXT,
    "adminPhone2" TEXT,
    "adminPhone3" TEXT,
    "notifyOnAttendance" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerResponse" TEXT,
    "attendanceId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCommLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE INDEX "Admin_role_status_idx" ON "Admin"("role", "status");
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
CREATE INDEX "Employee_deviceUserId_idx" ON "Employee"("deviceUserId");
CREATE INDEX "Employee_departmentId_status_idx" ON "Employee"("departmentId", "status");
CREATE INDEX "Employee_name_idx" ON "Employee"("name");
CREATE INDEX "Device_status_idx" ON "Device"("status");
CREATE INDEX "Device_ipAddress_port_idx" ON "Device"("ipAddress", "port");
CREATE INDEX "Attendance_employeeId_timestamp_idx" ON "Attendance"("employeeId", "timestamp");
CREATE INDEX "Attendance_deviceId_timestamp_idx" ON "Attendance"("deviceId", "timestamp");
CREATE INDEX "Attendance_deviceTransactionId_idx" ON "Attendance"("deviceTransactionId");
CREATE INDEX "Attendance_timestamp_idx" ON "Attendance"("timestamp");
CREATE INDEX "Attendance_source_idx" ON "Attendance"("source");
CREATE UNIQUE INDEX "Attendance_deviceId_deviceUserId_timestamp_key" ON "Attendance"("deviceId", "deviceUserId", "timestamp");
CREATE INDEX "DailyAttendanceSummary_workDate_status_idx" ON "DailyAttendanceSummary"("workDate", "status");
CREATE INDEX "DailyAttendanceSummary_departmentId_workDate_idx" ON "DailyAttendanceSummary"("departmentId", "workDate");
CREATE UNIQUE INDEX "DailyAttendanceSummary_employeeId_workDate_key" ON "DailyAttendanceSummary"("employeeId", "workDate");
CREATE UNIQUE INDEX "Shift_name_key" ON "Shift"("name");
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Leave_employeeId_startDate_endDate_idx" ON "Leave"("employeeId", "startDate", "endDate");
CREATE INDEX "Leave_status_idx" ON "Leave"("status");
CREATE UNIQUE INDEX "SmsLog_notificationKey_key" ON "SmsLog"("notificationKey");
CREATE INDEX "SmsLog_status_createdAt_idx" ON "SmsLog"("status", "createdAt");
CREATE INDEX "SmsLog_attendanceId_idx" ON "SmsLog"("attendanceId");
CREATE INDEX "SmsLog_recipient_idx" ON "SmsLog"("recipient");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "SyncLog_deviceId_startedAt_idx" ON "SyncLog"("deviceId", "startedAt");
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");
CREATE INDEX "DeviceCommLog_deviceId_createdAt_idx" ON "DeviceCommLog"("deviceId", "createdAt");
CREATE INDEX "DeviceCommLog_action_createdAt_idx" ON "DeviceCommLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyAttendanceSummary" ADD CONSTRAINT "DailyAttendanceSummary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyAttendanceSummary" ADD CONSTRAINT "DailyAttendanceSummary_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyAttendanceSummary" ADD CONSTRAINT "DailyAttendanceSummary_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceCommLog" ADD CONSTRAINT "DeviceCommLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
