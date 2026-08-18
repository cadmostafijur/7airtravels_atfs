export type LiveAttendanceEvent = {
  id: string;
  employee: string;
  employeeCode: string | null;
  deviceUserId: string;
  timestamp: string;
  status: string;
  device: string;
  verificationMethod: string;
};
