export interface AvailabilitySlot {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface AvailabilitySchedule {
  timezone: string;
  slots: AvailabilitySlot[];
}

export interface BusyEvent {
  startTime: string;
  endTime: string;
}

export interface AvailabilityBlock {
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate: Date;
}

export const DEFAULT_AVAILABILITY_SCHEDULE: AvailabilitySchedule = {
  timezone: 'UTC',
  slots: [
    { weekday: 0, startMinutes: 0, endMinutes: 24 * 60 },
    { weekday: 1, startMinutes: 0, endMinutes: 24 * 60 },
    { weekday: 2, startMinutes: 0, endMinutes: 24 * 60 },
    { weekday: 3, startMinutes: 0, endMinutes: 24 * 60 },
    { weekday: 4, startMinutes: 0, endMinutes: 24 * 60 },
    { weekday: 5, startMinutes: 0, endMinutes: 24 * 60 },
    { weekday: 6, startMinutes: 0, endMinutes: 24 * 60 },
  ],
};

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => index * 30);

export const parseDateString = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const weekdayForDate = (dateString: string) => parseDateString(dateString).getDay();

export const minutesToTimeString = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const minutesToLabel = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
};

export const timeStringToMinutes = (timeString: string) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const buildDateFromMinutes = (dateString: string, minutes: number) => {
  const date = parseDateString(dateString);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  date.setHours(hours, mins, 0, 0);
  return date;
};

const mergeBusyIntervals = (events: BusyEvent[], dayStart: Date, dayEnd: Date) => {
  const relevant = events
    .map((event) => ({
      start: new Date(event.startTime),
      end: new Date(event.endTime),
    }))
    .filter(({ start, end }) => start < dayEnd && end > dayStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Array<{ start: Date; end: Date }> = [];

  for (const interval of relevant) {
    const start = interval.start < dayStart ? new Date(dayStart) : interval.start;
    const end = interval.end > dayEnd ? new Date(dayEnd) : interval.end;
    const previous = merged[merged.length - 1];

    if (!previous || start > previous.end) {
      merged.push({ start, end });
      continue;
    }

    if (end > previous.end) {
      previous.end = end;
    }
  }

  return merged;
};

export const getAvailabilityBlocksForDate = (
  dateString: string,
  schedule: AvailabilitySchedule | null | undefined,
  busyEvents: BusyEvent[]
) => {
  const fallbackSchedule = schedule || DEFAULT_AVAILABILITY_SCHEDULE;
  const weekday = weekdayForDate(dateString);
  const daySlots = fallbackSchedule.slots
    .filter((slot) => slot.weekday === weekday)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  if (daySlots.length === 0) {
    return [] as AvailabilityBlock[];
  }

  const dayStart = buildDateFromMinutes(dateString, 0);
  const dayEnd = buildDateFromMinutes(dateString, 24 * 60);
  const busyIntervals = mergeBusyIntervals(busyEvents, dayStart, dayEnd);
  const freeBlocks: AvailabilityBlock[] = [];

  for (const slot of daySlots) {
    let cursor = buildDateFromMinutes(dateString, slot.startMinutes);
    const slotEnd = buildDateFromMinutes(dateString, slot.endMinutes);

    for (const busy of busyIntervals) {
      if (busy.end <= cursor || busy.start >= slotEnd) {
        continue;
      }

      if (busy.start > cursor) {
        const startMinutes = cursor.getHours() * 60 + cursor.getMinutes();
        const endMinutes = busy.start.getHours() * 60 + busy.start.getMinutes();
        freeBlocks.push({
          startMinutes,
          endMinutes,
          startTime: minutesToTimeString(startMinutes),
          endTime: minutesToTimeString(endMinutes),
          startDate: new Date(cursor),
          endDate: new Date(busy.start),
        });
      }

      if (busy.end > cursor) {
        cursor = new Date(busy.end);
      }
    }

    if (cursor < slotEnd) {
      const startMinutes = cursor.getHours() * 60 + cursor.getMinutes();
      const endMinutes = slot.endMinutes;
      freeBlocks.push({
        startMinutes,
        endMinutes,
        startTime: minutesToTimeString(startMinutes),
        endTime: minutesToTimeString(endMinutes),
        startDate: new Date(cursor),
        endDate: new Date(slotEnd),
      });
    }
  }

  return freeBlocks.filter((block) => block.endMinutes > block.startMinutes);
};

export const isRangeWithinBlocks = (
  blocks: AvailabilityBlock[],
  startMinutes: number,
  endMinutes: number
) => blocks.some((block) => block.startMinutes <= startMinutes && block.endMinutes >= endMinutes);
