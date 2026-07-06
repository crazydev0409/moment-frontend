export interface TimedItem {
  startTime: string;
  endTime: string;
}

export type LaidOutEvent<T> = T & { column: number; totalColumns: number };

/**
 * Returns a local `YYYY-MM-DD` bucket key for a date — used to group events
 * by calendar day (not by 24h-elapsed, so timezone-local midnight boundaries
 * are respected).
 */
export const dayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Google Calendar-style side-by-side layout for events that overlap in time.
 * Input should already be scoped to a single calendar day (or a single day's
 * slice of a multi-day event) — this only reasons about start/end minutes,
 * not dates.
 *
 * Greedy interval-graph column packing: sort by start time, place each event
 * in the first column whose most-recent event has already ended, otherwise
 * open a new column. Afterward, events are grouped into overlap clusters (a
 * cluster is a maximal run of mutually-touching intervals) so `totalColumns`
 * reflects that cluster's own width, not the day's global max column count —
 * two separate non-overlapping pairs of events elsewhere in the same day
 * shouldn't visually shrink because of an unrelated 4-way overlap.
 *
 * Does not implement Google's "expand into free trailing columns" polish
 * (where a lone event widens to fill columns that are empty for its time
 * range) — all columns in a cluster render equal-width.
 */
export function layoutEventsForDay<T extends TimedItem>(events: T[]): LaidOutEvent<T>[] {
  if (events.length === 0) return [];

  const sorted = [...events]
    .map((event) => ({
      event,
      start: new Date(event.startTime).getTime(),
      end: new Date(event.endTime).getTime(),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const columnEnds: number[] = []; // columnEnds[i] = end time of the last event placed in column i
  const placed = sorted.map(({ event, start, end }) => {
    let column = columnEnds.findIndex((endTime) => endTime <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    return { event, start, end, column };
  });

  // Group into overlap clusters so totalColumns is local to each cluster.
  const result: LaidOutEvent<T>[] = [];
  let clusterEnd = -Infinity;
  let clusterIndices: number[] = [];

  const flushCluster = () => {
    if (clusterIndices.length === 0) return;
    const totalColumns = Math.max(...clusterIndices.map((i) => placed[i].column)) + 1;
    for (const i of clusterIndices) {
      result.push({ ...placed[i].event, column: placed[i].column, totalColumns });
    }
    clusterIndices = [];
  };

  placed.forEach((item, index) => {
    if (clusterIndices.length > 0 && item.start >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    clusterEnd = Math.max(clusterEnd, item.end);
    clusterIndices.push(index);
  });
  flushCluster();

  return result;
}

export interface MonthEventInput {
  id: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
}

export type MonthEventSpan<T> = {
  event: T;
  lane: number;
  /** Day column within the row, 0 (Monday) - 6 (Sunday), clipped to the row. */
  startCol: number;
  endCol: number;
  /** Whether the event's real range extends before/after this row's 7 days. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDayMs = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Google Calendar month-view style layout: given a week's worth of events
 * (already known to intersect this row), assigns each a horizontal "lane"
 * so multi-day events render as one continuous bar spanning their columns
 * without overlapping other events' bars.
 *
 * `laneHints` carries lane assignments for events that continued in from the
 * previous row (see `continuesAfter` on that row's output) — honoring the
 * hint when possible keeps a multi-week event visually in the same lane as
 * it crosses row boundaries, matching Google's behavior, instead of jumping
 * lanes at every week boundary.
 */
export function layoutEventsForMonthRow<T extends MonthEventInput>(
  events: T[],
  rowStart: Date,
  laneHints: Map<string, number>
): MonthEventSpan<T>[] {
  const rowStartMs = startOfDayMs(rowStart);
  const rowEndMs = rowStartMs + 6 * DAY_MS;

  const spans = events
    .map((event) => {
      const startDayMs = startOfDayMs(new Date(event.startTime));
      let endDayMs = startOfDayMs(new Date(event.endTime));
      // Multi-day all-day events use an exclusive end date (Google Calendar
      // convention) — e.g. a 2-day event spanning Mon-Tue has an end date of
      // Wed. Pull it back a day so the span reflects the actual last day.
      if (event.allDay && endDayMs > startDayMs) {
        endDayMs -= DAY_MS;
      }
      if (endDayMs < startDayMs) endDayMs = startDayMs;
      return { event, startDayMs, endDayMs };
    })
    .filter(({ startDayMs, endDayMs }) => endDayMs >= rowStartMs && startDayMs <= rowEndMs)
    .map(({ event, startDayMs, endDayMs }) => ({
      event,
      startCol: Math.max(0, Math.round((startDayMs - rowStartMs) / DAY_MS)),
      endCol: Math.min(6, Math.round((endDayMs - rowStartMs) / DAY_MS)),
      continuesBefore: startDayMs < rowStartMs,
      continuesAfter: endDayMs > rowEndMs,
    }));

  const sorted = [...spans].sort((a, b) => {
    const hintA = laneHints.get(a.event.id);
    const hintB = laneHints.get(b.event.id);
    if (hintA !== undefined && hintB === undefined) return -1;
    if (hintB !== undefined && hintA === undefined) return 1;
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    const lenA = a.endCol - a.startCol;
    const lenB = b.endCol - b.startCol;
    if (lenA !== lenB) return lenB - lenA;
    return new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime();
  });

  const laneEnds: number[] = []; // laneEnds[lane] = last occupied column in this row
  const results: MonthEventSpan<T>[] = [];
  for (const span of sorted) {
    const hint = laneHints.get(span.event.id);
    let lane: number;
    if (hint !== undefined && (laneEnds[hint] === undefined || laneEnds[hint] < span.startCol)) {
      lane = hint;
    } else {
      lane = laneEnds.findIndex((endCol) => endCol < span.startCol);
      if (lane === -1) lane = laneEnds.length;
    }
    laneEnds[lane] = span.endCol;
    results.push({ ...span, lane });
  }

  return results;
}
