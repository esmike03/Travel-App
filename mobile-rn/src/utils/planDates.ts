// Plan date maths. A plan is a scope plus an explicit [start, end] date range,
// stored on every stop it contains — plans have no table of their own, they are
// derived by grouping stops, so the range cannot be recomputed from a single
// date. Day and month ranges are implied by their scope; a week plan's range is
// whatever the user picked, defaulting to the Mon–Sun week around a date.
export type PlanScope = 'day' | 'week' | 'month';

export interface PlanRange {
  start: string; // ISO yyyy-mm-dd, inclusive
  end: string; // ISO yyyy-mm-dd, inclusive
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function isoToDate(iso: string): Date {
  if (typeof iso !== 'string' || !iso.includes('-')) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoParts(iso: string): { y: number; m: number; d: number } {
  if (typeof iso !== 'string' || !iso.includes('-')) {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function addDaysIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

// Monday-based start of the week containing `iso`.
export function weekStartIso(iso: string): string {
  const d = isoToDate(iso);
  const offset = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - offset);
  return toIso(d);
}

export function monthStartIso(iso: string): string {
  const { y, m } = isoParts(iso);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

export function monthEndIso(iso: string): string {
  const { y, m } = isoParts(iso);
  return toIso(new Date(y, m, 0)); // day 0 of next month = last day of this one
}

// The range a plan covers when the user hasn't chosen one explicitly. Also used
// to backfill stops saved before ranges existed, so it must match the old rules.
export function defaultRange(scope: PlanScope, date: string): PlanRange {
  if (scope === 'week') {
    const start = weekStartIso(date);
    return { start, end: addDaysIso(start, 6) };
  }
  if (scope === 'month') return { start: monthStartIso(date), end: monthEndIso(date) };
  return { start: date, end: date };
}

// ISO dates are lexicographically ordered, so plain string compares are safe.
export function clampIso(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

export function daysInRange(range: PlanRange): number {
  const a = isoToDate(range.start).getTime();
  const b = isoToDate(range.end).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

// Identifies the plan a stop belongs to. Includes the range so that two week
// plans starting the same day but ending differently stay separate plans.
export function planKeyOf(scope: PlanScope, range: PlanRange): string {
  return `${scope}|${range.start}|${range.end}`;
}

export function planLabelOf(scope: PlanScope, range: PlanRange): string {
  if (scope === 'day') return formatDate(range.start);
  if (scope === 'month') {
    const { m, y } = isoParts(range.start);
    // A month plan trimmed to part of the month is clearer shown as a range.
    const whole = range.start === monthStartIso(range.start) && range.end === monthEndIso(range.start);
    if (whole) return `${MONTHS_LONG[m - 1]} ${y}`;
  }
  if (range.start === range.end) return formatDate(range.start);
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
}

export function rangeIncludesToday(range: PlanRange): boolean {
  const today = todayIso();
  return today >= range.start && today <= range.end;
}

export function rangeIsPast(range: PlanRange): boolean {
  return range.end < todayIso();
}

/* ---------------- display formatting (mirrors DateTimeFormatter patterns) ---------------- */

// "EEE, MMM d"
export function formatDate(iso: string): string {
  const d = isoToDate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// "h:mm a"
export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:${String(minute).padStart(2, '0')} ${period}`;
}
