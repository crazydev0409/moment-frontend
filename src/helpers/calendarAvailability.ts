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
