// Shared types + presentation metadata for Hooks (the universal scheduling
// primitive). Backend contract lives in moment-backend hookController.ts.
import { accessBadge } from '~/lib/theme';

export type HookAccessLevel = 'personal' | 'open' | 'shared' | 'private';
export type HookState = 'active' | 'paused';
export type HookLocationType = 'remote' | 'in_person';

export interface HookParticipant {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  contactPhone?: string | null;
  status: 'invited' | 'accepted' | 'declined';
  user?: { id: string; name?: string | null; avatar?: string | null; phoneNumber?: string | null } | null;
}

export interface HookAvailabilitySlot {
  id?: string;
  weekday: number; // 0=Sun..6=Sat
  startMinutes: number;
  endMinutes: number;
  isAvailable: boolean;
  isPaused: boolean;
}

export interface Hook {
  id: string;
  ownerId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  meetingType?: string | null;
  category?: string | null;
  accessLevel: HookAccessLevel;
  state: HookState;
  locationType: HookLocationType;
  locationLabel?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  durationMinutes: number;
  capacity?: number | null;
  isPaid: boolean;
  priceCents?: number | null;
  currency: string;
  publishedToMesh: boolean;
  createdAt: string;
  updatedAt: string;
  participants: HookParticipant[];
  availabilitySlots?: HookAvailabilitySlot[];
  owner?: { id: string; name?: string | null; avatar?: string | null; accountType?: string; phoneNumber?: string | null };
  isOwner?: boolean;
  group?: string;
  participantCount?: number;
  priceDisplay?: string | null;
}

// Access level definitions. Copy matches the design's "Access" descriptions.
export const ACCESS_LEVEL_META: Record<
  HookAccessLevel,
  { label: string; color: string; bg: string; description: string; hasInvitees: boolean }
> = {
  personal: {
    label: 'Personal',
    color: accessBadge.personal.fg,
    bg: accessBadge.personal.bg,
    description: 'Only visible to you for your own planning.',
    hasInvitees: false,
  },
  shared: {
    label: 'Shared',
    color: accessBadge.shared.fg,
    bg: accessBadge.shared.bg,
    description: 'Visible only to the people you choose.',
    hasInvitees: true,
  },
  private: {
    label: 'Private',
    color: accessBadge.private.fg,
    bg: accessBadge.private.bg,
    description: 'One-time use. Creates a single catch, then disappears.',
    hasInvitees: false,
  },
  open: {
    label: 'Open',
    color: accessBadge.open.fg,
    bg: accessBadge.open.bg,
    description: 'Visible to anyone who can access your hooks.',
    hasInvitees: false,
  },
};

// Editor segmented order (matches design: Personal / Shared / Private / Open).
export const ACCESS_LEVEL_ORDER: HookAccessLevel[] = ['personal', 'shared', 'private', 'open'];

// My Hooks filter chips (matches design: All / Private / Personal / Shared).
export const HOOK_FILTERS: { key: 'all' | HookAccessLevel; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'private', label: 'Private' },
  { key: 'personal', label: 'Personal' },
  { key: 'shared', label: 'Shared' },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatPrice(cents?: number | null, currency = 'USD'): string {
  if (cents == null) return '';
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function minutesToLabel(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Summarise a weekly availability schedule into a one-line label, e.g.
// "Mon–Fri 9:00 AM – 6:30 PM" or "3 days/week".
export function summarizeAvailability(slots?: HookAvailabilitySlot[]): string {
  if (!slots || slots.length === 0) return 'Not set';
  const active = slots
    .filter((s) => s.isAvailable && !s.isPaused)
    .sort((a, b) => a.weekday - b.weekday);
  if (active.length === 0) return 'Paused';

  // Contiguous weekday range with identical hours → "Mon–Fri 9:00 AM – 6:30 PM".
  const days = active.map((s) => s.weekday);
  const sameHours = active.every(
    (s) => s.startMinutes === active[0].startMinutes && s.endMinutes === active[0].endMinutes
  );
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const hours = `${minutesToLabel(active[0].startMinutes)} – ${minutesToLabel(active[0].endMinutes)}`;
  if (sameHours && contiguous && active.length > 1) {
    return `${WEEKDAYS[days[0]]}–${WEEKDAYS[days[days.length - 1]]} ${hours}`;
  }
  if (active.length === 1) return `${WEEKDAYS[days[0]]} ${hours}`;
  return `${active.length} days/week`;
}

// Default weekly schedule for a new hook (Mon–Fri 9:00–18:00 available).
export function defaultAvailability(): HookAvailabilitySlot[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    startMinutes: 540,
    endMinutes: 1080,
    isAvailable: weekday >= 1 && weekday <= 5,
    isPaused: false,
  }));
}
