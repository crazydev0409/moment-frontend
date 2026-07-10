export interface AvailabilitySlot {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface AvailabilitySchedule {
  timezone: string;
  slots: AvailabilitySlot[];
}

export const minutesToLabel = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
};

// A busy calendar event as returned by GET /users/calendar-events or
// GET /users/:userId/calendar-events.
export interface CalendarBusyEvent {
  startTime: string;
  endTime: string;
  status?: string;
  hookId?: string | null;
  sourceType: 'internal' | 'external';
}

export interface HookCapacityContext {
  hookId?: string | null;
  capacity?: number | null;
}

// Clips an event's [startTime, endTime) down to the portion that falls
// within `dayDate` (expressed as minutes-since-midnight on that day).
// Returns null if the event doesn't touch that day at all.
export function clipToDayMinutes(
  event: CalendarBusyEvent,
  dayDate: Date
): { startMinutes: number; endMinutes: number } | null {
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const eventStart = new Date(event.startTime).getTime();
  const eventEnd = new Date(event.endTime).getTime();
  const clippedStart = Math.max(eventStart, dayStart.getTime());
  const clippedEnd = Math.min(eventEnd, dayEnd.getTime());
  if (clippedStart >= clippedEnd) return null;

  return {
    startMinutes: (clippedStart - dayStart.getTime()) / 60000,
    endMinutes: (clippedEnd - dayStart.getTime()) / 60000,
  };
}

/**
 * Whether [slotStartMinutes, slotEndMinutes) on `dayDate` is actually
 * booked out by any of `events`.
 *
 * Only `approved` internal events (and all external ones — those have no
 * pending/approved concept, they're just busy) count as a real conflict,
 * matching the backend's own validateMeetingSchedule rule: a `pending`
 * request is just an ask, not a commitment, so it never blocks a slot from
 * being offered.
 *
 * When `capacity.hookId` is given and that hook's `capacity` is > 1, an
 * approved event tied to *that same hook* only counts toward its own
 * capacity instead of blocking outright — mirroring the backend's
 * capacity-aware conflict check, so the picker only offers slots the
 * backend will actually accept.
 */
export function isSlotBlocked(
  slotStartMinutes: number,
  slotEndMinutes: number,
  dayDate: Date,
  events: CalendarBusyEvent[],
  capacity?: HookCapacityContext
): boolean {
  let sameHookOverlapCount = 0;

  for (const event of events) {
    if (event.sourceType === 'internal' && event.status !== 'approved') continue;

    const clipped = clipToDayMinutes(event, dayDate);
    if (!clipped) continue;
    if (clipped.startMinutes >= slotEndMinutes || clipped.endMinutes <= slotStartMinutes) continue;

    const sameHook =
      !!capacity?.hookId && event.sourceType === 'internal' && event.hookId === capacity.hookId;
    if (sameHook && capacity?.capacity && capacity.capacity > 1) {
      sameHookOverlapCount += 1;
      continue;
    }
    return true;
  }

  if (capacity?.capacity && capacity.capacity > 1 && sameHookOverlapCount >= capacity.capacity) {
    return true;
  }
  return false;
}

export interface MinuteRange {
  start: number;
  end: number;
}

/** Sorts and merges overlapping/touching ranges into their union. */
export function mergeMinuteRanges(ranges: MinuteRange[]): MinuteRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: MinuteRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

/** Removes `subtract` ranges from `base`, splitting a base range in two if a cut falls in its middle. */
export function subtractMinuteRanges(base: MinuteRange[], subtract: MinuteRange[]): MinuteRange[] {
  let result = base.map((r) => ({ ...r }));
  for (const cut of subtract) {
    const next: MinuteRange[] = [];
    for (const r of result) {
      if (cut.end <= r.start || cut.start >= r.end) {
        next.push(r);
        continue;
      }
      if (cut.start > r.start) next.push({ start: r.start, end: cut.start });
      if (cut.end < r.end) next.push({ start: cut.end, end: r.end });
    }
    result = next;
  }
  return result;
}
