/** Every `groupSize` raw absent days count as one absent day in the fine. */
export function countedAbsentDays(rawAbsentDays: number, groupSize: number) {
  const raw = Math.max(0, Math.floor(rawAbsentDays));
  const size = Math.max(1, Math.floor(groupSize));
  return Math.floor(raw / size);
}

/** (monthly salary / working days) × counted absent days, rounded to the nearest taka. */
export function absentFineAmount(monthlySalary: number, workingDays: number, countedDays: number) {
  const salary = Math.max(0, monthlySalary);
  const days = Math.max(0, workingDays);
  const counted = Math.max(0, countedDays);
  if (salary === 0 || days === 0 || counted === 0) return 0;
  return Math.round((salary / days) * counted);
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
