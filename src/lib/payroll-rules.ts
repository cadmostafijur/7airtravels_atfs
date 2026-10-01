/** Taka per absent day: monthly salary / working days, rounded to the nearest taka. */
export function dailyAbsentPenalty(monthlySalary: number, workingDays: number) {
  const salary = Math.max(0, Math.round(monthlySalary));
  const days = Math.max(0, Math.floor(workingDays));
  if (salary === 0 || days === 0) return 0;
  return Math.round(salary / days);
}

/** Every 3 late days count as 1 absence. */
export function absencesFromLateDays(lateDays: number) {
  return Math.floor(Math.max(0, Math.floor(lateDays)) / 3);
}

/** Fine = daily penalty × (absent days + one absence for every 3 late days). */
export function absentFineAmount(monthlySalary: number, workingDays: number, absentDays: number, lateDays = 0) {
  const days = Math.max(0, Math.floor(absentDays)) + absencesFromLateDays(lateDays);
  if (days === 0) return 0;
  return dailyAbsentPenalty(monthlySalary, workingDays) * days;
}

export function adjustedSalaryAmount(monthlySalary: number, fine: number) {
  return Math.max(0, Math.round(monthlySalary) - Math.max(0, Math.round(fine)));
}

export function monthDateKeys(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const keys: string[] = [];
  for (let day = 1; day <= count; day += 1) {
    keys.push(`${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`);
  }
  return keys;
}

/** Sunday = 0 … Friday = 5, Saturday = 6. Uses the calendar date, not a timezone shift. */
export function weekdayOfDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function workingDayKeys(month: string, weekendDays: number[], holidayKeys: string[]) {
  const holidays = new Set(holidayKeys);
  const weekends = new Set(weekendDays);
  return monthDateKeys(month).filter((key) => !weekends.has(weekdayOfDateKey(key)) && !holidays.has(key));
}
