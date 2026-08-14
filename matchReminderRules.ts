export type ReminderFixtureStatus = "scheduled" | "live" | "completed" | "abandoned" | "cancelled";
export type MatchReminderOffset = 1440 | 30;

export const MATCH_REMINDER_OFFSETS: MatchReminderOffset[] = [1440, 30];
export const MATCH_REMINDER_GRACE_MINUTES = 20;

export const matchReminderTarget = (scheduledStart: string | number | Date, offsetMinutes: MatchReminderOffset) =>
  new Date(scheduledStart).getTime() - offsetMinutes * 60_000;

export function isMatchReminderDue({
  scheduledStart,
  offsetMinutes,
  now,
  status,
  graceMinutes = MATCH_REMINDER_GRACE_MINUTES,
}: {
  scheduledStart: string | number | Date;
  offsetMinutes: MatchReminderOffset;
  now: number;
  status: ReminderFixtureStatus;
  graceMinutes?: number;
}) {
  const start = new Date(scheduledStart).getTime();
  const target = matchReminderTarget(scheduledStart, offsetMinutes);
  if (!Number.isFinite(start) || status !== "scheduled" || start <= now) return false;
  return target <= now && target > now - graceMinutes * 60_000;
}
