import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppStackParamList } from '.';

import { getPlacesByQuery } from '~/helpers/common';
import { formatPrice } from '~/helpers/hooks';
import { http, mapApiKey } from '~/helpers/http';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import { AvailabilitySchedule, CalendarBusyEvent, isSlotBlocked } from '~/helpers/calendarAvailability';
import { SearchIcon, UpcomingIcon, LocationIcon, ChevronIcon, CheckIcon, CrossIcon, EditIcon } from '~/lib/images';
import { useDeviceContactAvatarMap } from '~/helpers/contactAvatars';
import { ContactAvatar } from '~/components/ContactAvatar';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_SendCatchScreen'>;
type FlowMode = 'one' | 'group';
type Step = 'contacts' | 'hooks' | 'schedule';
type Sheet = null | 'price' | 'name' | 'duration' | 'location' | 'invitees';
type DurationOption = '15' | '30' | '45' | '60' | 'custom';

interface HookOption {
  id: string;
  name: string;
  status: 'Open' | 'Shared';
  duration: number;
  location: string;
  isPaid: boolean;
  priceCents?: number | null;
  billingType?: 'fixed' | 'hourly' | null;
  description?: string | null;
  capacity?: number | null;
  availabilitySlots: { weekday: number; startMinutes: number; endMinutes: number; isAvailable: boolean; isPaused: boolean }[];
}

interface Contact {
  id: string;
  displayName: string;
  contactPhone?: string;
  avatar?: string;
  contactUser?: {
    id: string;
    name: string;
    avatar?: string;
    phoneNumber?: string;
  };
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
}

const COLORS = {
  background: '#F3F6FA',
  ink: '#171927',
  muted: '#6F7780',
  pale: '#AEB9C4',
  line: '#E8EDF2',
  green: '#9AC51F',
  lightGreen: '#EAF4CE',
  white: '#FFFFFF',
};

const h = (size: number) => horizontalScale(size);
const v = (size: number) => verticalScale(size);
const ms = (size: number) => moderateScale(size, 0.2);

function parseDateString(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDayOffset(dateString: string) {
  const target = parseDateString(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

// Wide, fixed window for the one-time busy-events fetch (matches this
// screen's practical "book sometime soon" usage) so day-rail navigation
// doesn't need to keep refetching — same pattern as the Calendar screen's
// broad upfront fetch.
function busyEventsFetchRange() {
  const start = new Date();
  start.setDate(start.getDate() - 3);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 30);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getVisibleDays(selectedOffset: number) {
  const startOffset = selectedOffset - 2;
  return Array.from({ length: 7 }, (_, index) => {
    const offset = startOffset + index;
    const date = new Date();
    date.setDate(date.getDate() + offset);
    date.setHours(0, 0, 0, 0);
    return {
      offset,
      date,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateString: date.toISOString(),
    };
  });
}

const pad2 = (value: number) => String(value).padStart(2, '0');

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  return `${pad2(Math.floor(safeMinutes / 60))}:${pad2(safeMinutes % 60)}`;
}

function formatTimeString(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}

const BackGlyph = ({ size = 30, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 7 11 16l9 9"
      stroke={color}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const MiniIcon = ({
  type,
}: {
  type: 'clock' | 'pin' | 'calendar' | 'people' | 'globe' | 'money';
}) => (
  <Svg width={h(24)} height={h(24)} viewBox="0 0 24 24" fill="none">
    {type === 'clock' && (
      <>
        <Circle cx="12" cy="12" r="9" stroke={COLORS.pale} strokeWidth="2.2" />
        <Path
          d="M12 7v5l3.5 2"
          stroke={COLORS.pale}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
    {type === 'pin' && (
      <>
        <Path
          d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11Z"
          stroke={COLORS.pale}
          strokeWidth="2.2"
        />
        <Circle cx="12" cy="10" r="2.2" stroke={COLORS.pale} strokeWidth="2.2" />
      </>
    )}
    {type === 'calendar' && (
      <>
        <Path
          d="M5 6h14v14H5zM8 3v4M16 3v4M5 10h14"
          stroke={COLORS.pale}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    )}
    {type === 'people' && (
      <Path
        d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0 0-6M2 21v-2a6 6 0 0 1 12 0v2m2-8a5 5 0 0 1 5 5v1"
        stroke={COLORS.pale}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    )}
    {type === 'globe' && (
      <>
        <Circle cx="12" cy="12" r="9" stroke={COLORS.pale} strokeWidth="2.2" />
        <Path
          d="M3 12h18M12 3c2.3 2.7 3.4 5.6 3.4 9S14.3 18.3 12 21M12 3c-2.3 2.7-3.4 5.6-3.4 9S9.7 18.3 12 21"
          stroke={COLORS.pale}
          strokeWidth="1.9"
        />
      </>
    )}
    {type === 'money' && (
      <Path
        d="M12 3v18M17 7.5c-1-1-2.7-1.7-4.6-1.3-2.4.5-3.1 3.4-.8 4.4l3.5 1.5c2.5 1.1 1.6 4.6-1 5-2 .4-4-.4-5.2-1.5"
        stroke={COLORS.pale}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    )}
  </Svg>
);

const AppStack_SendCatchScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const mode: FlowMode = route.params?.mode || 'one';
  const initialContact = route.params?.initialContact;
  const [step, setStep] = useState<Step>(
    mode === 'one' && initialContact?.contactUser?.id
      ? 'hooks'
      : mode === 'one'
        ? 'contacts'
        : 'hooks'
  );
  const [hooks, setHooks] = useState<HookOption[]>([]);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const { avatarMap } = useDeviceContactAvatarMap();
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>(
    initialContact?.contactUser?.id ? [initialContact] : []
  );
  const [contactSearch, setContactSearch] = useState('');
  const [hookSearch, setHookSearch] = useState('');
  const [selectedHook, setSelectedHook] = useState<HookOption | null>(null);
  const [expandedHookId, setExpandedHookId] = useState<string | null>(null);
  // Defaults to today (offset 0) so the "soonest available slot from now"
  // logic below actually applies the moment the screen opens, instead of
  // requiring the user to manually navigate back to today first.
  const [selectedDayIndex, setSelectedDayIndex] = useState(() =>
    route.params?.initialDate ? getDayOffset(route.params.initialDate) : 0
  );
  // No hardcoded default time — a fixed "09:00" fallback could easily fall
  // outside the participants' actual overlapping availability. Starts empty
  // (unless a specific time was explicitly passed in) and gets populated
  // once `availableTimes` is computed below, from a slot that's actually free.
  const [selectedTime, setSelectedTime] = useState<string | null>(route.params?.initialTime || null);
  const [format, setFormat] = useState<'remote' | 'onsite'>('onsite');
  const [pricing, setPricing] = useState<'free' | 'paid'>('free');
  const [price, setPrice] = useState('');
  const [eventName, setEventName] = useState('');
  const [duration, setDuration] = useState(30);
  const [durationOption, setDurationOption] = useState<DurationOption>('30');
  const [location, setLocation] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draftValue, setDraftValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removeContact, setRemoveContact] = useState<Contact | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [userAvailability, setUserAvailability] = useState<AvailabilitySchedule | null>(null);
  // Starts true and flips false once the fetch below settles — used to stop
  // the default-time/day logic from acting on the temporary 9am-5pm fallback
  // window before the sender's real availability has actually loaded.
  const [loadingUserAvailability, setLoadingUserAvailability] = useState(true);
  const [recipientAvailabilities, setRecipientAvailabilities] = useState<Record<string, AvailabilitySchedule>>({});
  const [loadingRecipientAvailability, setLoadingRecipientAvailability] = useState(false);
  // Actual busy time (existing approved meetings + connected calendar
  // events) — the recurring weekly `AvailabilitySchedule` above only says
  // "generally free on Tuesdays 9-5", it says nothing about a specific
  // Tuesday already being booked. Without this, the slot picker could
  // offer a time that looks open but the backend then rejects on submit.
  const [senderBusyEvents, setSenderBusyEvents] = useState<CalendarBusyEvent[]>([]);
  const [loadingSenderBusy, setLoadingSenderBusy] = useState(true);
  const [recipientBusyEvents, setRecipientBusyEvents] = useState<Record<string, CalendarBusyEvent[]>>({});
  const [loadingRecipientBusy, setLoadingRecipientBusy] = useState(false);
  const visibleDays = useMemo(() => getVisibleDays(selectedDayIndex), [selectedDayIndex]);
  const selectedStartLabel = selectedTime ? formatTimeString(selectedTime) : '';
  const selectedEndLabel = selectedTime
    ? formatTimeString(minutesToTime(timeToMinutes(selectedTime) + duration))
    : '';
  const selectedDayDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + selectedDayIndex);
    return d;
  }, [selectedDayIndex]);

  // Pulled out of the memo below so the "today's slots ran out -> jump to
  // tomorrow" effect can synchronously compute tomorrow's list too, instead
  // of bumping the day and waiting for a follow-up render to pick a time
  // (which left the day switched but no time slot highlighted for a frame).
  const computeAvailableTimesForDay = useCallback(
    (dayDate: Date) => {
      const weekday = dayDate.getDay();

      // Collect slots per participant for this weekday
      const allSlotSets: { startMinutes: number; endMinutes: number }[][] = [];

      // Sender — the hook picker (loadHooks) only ever lists the current
      // user's OWN hooks, so when one is selected its availabilitySlots are
      // the sender's own, more specific declaration for this particular
      // meeting type (e.g. "my Yoga Class hook runs Mon/Wed/Fri 9-10am"),
      // taking priority over their general recurring schedule.
      const hookSlotsForDay = (selectedHook?.availabilitySlots ?? []).filter(
        (s) => s.weekday === weekday && s.isAvailable && !s.isPaused
      );
      const senderSlots =
        hookSlotsForDay.length > 0
          ? hookSlotsForDay.map((s) => ({ startMinutes: s.startMinutes, endMinutes: s.endMinutes }))
          : (userAvailability?.slots ?? [])
              .filter((s) => s.weekday === weekday)
              .map((s) => ({ startMinutes: s.startMinutes, endMinutes: s.endMinutes }));
      allSlotSets.push(senderSlots.length > 0 ? senderSlots : [{ startMinutes: 9 * 60, endMinutes: 17 * 60 }]);

      // Recipients
      for (const contact of selectedContacts) {
        const uid = contact.contactUser?.id;
        if (uid && recipientAvailabilities[uid]) {
          const rSlots = recipientAvailabilities[uid].slots
            .filter((s) => s.weekday === weekday)
            .map((s) => ({ startMinutes: s.startMinutes, endMinutes: s.endMinutes }));
          if (rSlots.length > 0) allSlotSets.push(rSlots);
        }
      }

      // Intersect all slot sets
      let intersection = allSlotSets[0];
      for (let i = 1; i < allSlotSets.length; i++) {
        const other = allSlotSets[i];
        const next: { startMinutes: number; endMinutes: number }[] = [];
        for (const a of intersection) {
          for (const b of other) {
            const start = Math.max(a.startMinutes, b.startMinutes);
            const end = Math.min(a.endMinutes, b.endMinutes);
            if (start < end) next.push({ startMinutes: start, endMinutes: end });
          }
        }
        intersection = next.sort((a, b) => a.startMinutes - b.startMinutes);
      }

      // Generate 15-min start times where the full meeting fits inside a
      // window AND doesn't collide with anyone's actual busy time — the
      // recurring AvailabilitySchedule above only says "generally free
      // Tuesdays 9-5", not whether *this* Tuesday is already booked, which
      // is what was letting the picker offer times the backend then
      // rejected on submit. Overlapping availability windows (e.g. two
      // unmerged slots for the same person that share some minutes) can
      // otherwise produce the same start time more than once, hence the
      // Set at the end.
      const receiverBusyLists = selectedContacts
        .map((c) => (c.contactUser?.id ? recipientBusyEvents[c.contactUser.id] : undefined))
        .filter((events): events is CalendarBusyEvent[] => !!events);

      const slots: string[] = [];
      for (const window of intersection) {
        for (let minute = window.startMinutes; minute + duration <= window.endMinutes; minute += 15) {
          const slotEnd = minute + duration;

          const senderBlocked = isSlotBlocked(minute, slotEnd, dayDate, senderBusyEvents, {
            hookId: selectedHook?.id,
            capacity: selectedHook?.capacity,
          });
          if (senderBlocked) continue;

          const receiverBlocked = receiverBusyLists.some((events) => isSlotBlocked(minute, slotEnd, dayDate, events));
          if (receiverBlocked) continue;

          slots.push(minutesToTime(minute));
        }
      }
      return Array.from(new Set(slots));
    },
    [duration, userAvailability, recipientAvailabilities, selectedContacts, selectedHook, senderBusyEvents, recipientBusyEvents]
  );

  const availableTimes = useMemo(
    () => computeAvailableTimesForDay(selectedDayDate),
    [computeAvailableTimesForDay, selectedDayDate]
  );

  const loadHooks = useCallback(async () => {
    try {
      setHooksLoading(true);
      const res = await http.get('/hooks');
      const fetched: HookOption[] = (res.data.hooks || []).map((h: any) => ({
        id: h.id,
        name: h.title,
        status: h.accessLevel === 'open' ? 'Open' : 'Shared',
        duration: h.durationMinutes,
        location: h.locationType === 'in_person' ? (h.locationLabel || 'In-person') : 'Remote',
        isPaid: !!h.isPaid,
        priceCents: h.priceCents ?? null,
        billingType: h.billingType ?? null,
        description: h.description ?? null,
        capacity: h.capacity ?? null,
        availabilitySlots: h.availabilitySlots || [],
      }));
      setHooks(fetched);
      setSelectedHook((prev) => prev ?? (fetched[0] || null));
    } catch (err) {
      console.error('Error loading hooks:', err);
    } finally {
      setHooksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
    loadHooks();
    http
      .get('/users/availability')
      .then((res) => setUserAvailability(res.data))
      .catch(() => {/* keep fallback */})
      .finally(() => setLoadingUserAvailability(false));

    const { start, end } = busyEventsFetchRange();
    http
      .get('/users/calendar-events', { params: { start, end } })
      .then((res) => setSenderBusyEvents(res.data.events || []))
      .catch(() => {/* keep empty — treated as "no known conflicts" */})
      .finally(() => setLoadingSenderBusy(false));
  }, []);

  useFocusEffect(useCallback(() => {
    loadHooks();
  }, [loadHooks]));

  // Fetch each recipient's availability + actual busy events whenever the
  // contact selection changes. Availability alone only says "generally
  // free Tuesdays 9-5" — busy events are what catch a specific Tuesday
  // already being booked, which is what was actually causing slots to look
  // open in this picker yet get rejected by the backend on submit.
  useEffect(() => {
    const ids = selectedContacts
      .map((c) => c.contactUser?.id)
      .filter((id): id is string => !!id);

    if (ids.length === 0) {
      setRecipientAvailabilities({});
      setRecipientBusyEvents({});
      return;
    }

    let cancelled = false;
    setLoadingRecipientAvailability(true);
    setLoadingRecipientBusy(true);
    const { start, end } = busyEventsFetchRange();

    Promise.all(
      ids.map((id) =>
        http
          .get(`/users/${id}/availability`)
          .then((res) => ({ id, schedule: res.data as AvailabilitySchedule }))
          .catch(() => ({ id, schedule: null })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, AvailabilitySchedule> = {};
      for (const { id, schedule } of results) {
        if (schedule) map[id] = schedule;
      }
      setRecipientAvailabilities(map);
    }).finally(() => {
      if (!cancelled) setLoadingRecipientAvailability(false);
    });

    Promise.all(
      ids.map((id) =>
        http
          .get(`/users/${id}/calendar-events`, { params: { start, end } })
          .then((res) => ({ id, events: (res.data.events || []) as CalendarBusyEvent[] }))
          .catch(() => ({ id, events: [] as CalendarBusyEvent[] })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, CalendarBusyEvent[]> = {};
      for (const { id, events } of results) {
        map[id] = events;
      }
      setRecipientBusyEvents(map);
    }).finally(() => {
      if (!cancelled) setLoadingRecipientBusy(false);
    });

    return () => { cancelled = true; };
  }, [selectedContacts]);

  // Picks the initial default time exactly ONCE, as soon as real availability
  // has loaded — never again after that. This is the only automatic pick
  // that happens: it prefers the soonest free slot at or after the current
  // time when today has one (e.g. 5:05pm now -> 5:15pm), or tomorrow's first
  // free slot if today's availability is entirely in the past. After this
  // single pick, simply viewing a different date in the day rail must NOT
  // change `selectedTime` or the button text again — only the user's own tap
  // on a pill is allowed to change it from here on.
  const didPickInitialTimeRef = useRef(false);
  // Scrolls the time list to the soonest/selected slot once, right when it's
  // first picked — otherwise the list always opens at its very start (e.g.
  // 9am), and the actual soonest-available pill (e.g. 5:15pm) could be far
  // down, out of view, on first render.
  const timeGridScrollRef = useRef<ScrollView>(null);
  const didScrollToSelectedTimeRef = useRef(false);
  useEffect(() => {
    if (didPickInitialTimeRef.current) return;
    // Don't decide anything yet while the sender's or recipients' real
    // availability/busy-events are still loading — until then `availableTimes`
    // is built from the temporary 9am-5pm fallback window, which could easily
    // (and wrongly) look "exhausted" and jump straight to tomorrow before the
    // real, possibly-later-running availability ever gets a chance to load.
    if (loadingUserAvailability || loadingRecipientAvailability || loadingSenderBusy || loadingRecipientBusy) return;
    didPickInitialTimeRef.current = true;

    if (selectedDayIndex === 0) {
      const nowMinutes = timeToMinutes(
        `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`
      );
      const upcomingToday = availableTimes.find((time) => timeToMinutes(time) >= nowMinutes);
      if (upcomingToday) {
        setSelectedTime(upcomingToday);
        return;
      }
      // No slot left today at or after now (either none free at all, or
      // every free slot already passed) — jump to tomorrow and pick its
      // first slot in the same pass (computed directly here, rather than
      // just bumping the day and letting a later render pick a time), so
      // the day and the highlighted slot change together in one update.
      const tomorrow = new Date(selectedDayDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowTimes = computeAvailableTimesForDay(tomorrow);
      setSelectedDayIndex(1);
      setSelectedTime(tomorrowTimes[0] ?? null);
      return;
    }
    setSelectedTime(availableTimes[0] ?? null);
  }, [
    availableTimes,
    selectedDayIndex,
    selectedDayDate,
    computeAvailableTimesForDay,
    loadingUserAvailability,
    loadingRecipientAvailability,
    loadingSenderBusy,
    loadingRecipientBusy,
  ]);

  useEffect(() => {
    if (!selectedHook) return;
    setEventName(selectedHook.name);
    setDuration(selectedHook.duration);
    setDurationOption(String(selectedHook.duration) as DurationOption);
    setLocation(selectedHook.location);
    setLocationAddress('');
    setSelectedPlace(null);
    setPlaceResults([]);
    setFormat(selectedHook.location === 'Remote' ? 'remote' : 'onsite');
  }, [selectedHook]);

  useEffect(() => {
    if (sheet !== 'location') return;
    if (!mapApiKey || draftValue.trim().length < 2) {
      setPlaceResults([]);
      setPlacesLoading(false);
      return;
    }

    let isActive = true;
    setPlacesLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await getPlacesByQuery(draftValue.trim(), mapApiKey);
        if (isActive) setPlaceResults((results || []).slice(0, 5));
      } catch (error) {
        console.error('Error searching places:', error);
        if (isActive) setPlaceResults([]);
      } finally {
        if (isActive) setPlacesLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [draftValue, sheet]);

  const loadContacts = async () => {
    try {
      setContactsLoading(true);
      const response = await http.get('/users/contacts/registered');
      const loaded = Array.isArray(response.data.contacts) ? response.data.contacts : [];
      setContacts(loaded);
    } catch (error) {
      console.error('Error loading contacts:', error);
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const displayContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    return contacts.filter((contact) =>
      contact.displayName.toLowerCase().includes(contactSearch.toLowerCase())
    );
  }, [contacts, contactSearch]);

  const displayHooks = hooks.filter((hook) =>
    hook.name.toLowerCase().includes(hookSearch.toLowerCase())
  );

  const toggleContact = (contact: Contact) => {
    if (!contact.contactUser?.id) return;
    if (mode === 'one') {
      setSelectedContacts([contact]);
      return;
    }

    setSelectedContacts((prev) => {
      const exists = prev.some((item) => item.id === contact.id);
      return exists ? prev.filter((item) => item.id !== contact.id) : [...prev, contact];
    });
  };

  const continueFromContacts = () => {
    if (mode === 'one' && selectedContacts.length !== 1) {
      Alert.alert('Select a contact', 'Choose one participant to continue.');
      return;
    }
    setStep('hooks');
  };

  const continueFromHooks = () => {
    setStep('schedule');
  };

  const openSheet = (nextSheet: Sheet) => {
    if (nextSheet === 'location') {
      setPlaceResults([]);
      setPlacesLoading(false);
    }
    setDraftValue(
      nextSheet === 'price'
        ? price
        : nextSheet === 'name'
          ? eventName
          : nextSheet === 'location'
            ? location
            : ''
    );
    setSheet(nextSheet);
  };

  const saveSheet = () => {
    if (sheet === 'price') {
      setPrice(draftValue.replace(/[^\d.]/g, ''));
      setPricing('paid');
    }
    if (sheet === 'name' && draftValue.trim()) setEventName(draftValue.trim());
    if (sheet === 'location') {
      setLocation(selectedPlace?.name || draftValue.trim());
      setLocationAddress(selectedPlace?.formatted_address || '');
      if (!draftValue.trim()) {
        setSelectedPlace(null);
        setPlaceResults([]);
      }
    }
    setSheet(null);
  };

  const selectPlace = (place: PlaceResult) => {
    setSelectedPlace(place);
    setLocation(place.name);
    setLocationAddress(place.formatted_address || '');
    setDraftValue(place.name);
    setPlaceResults([]);
  };

  const setMeetingFormat = (nextFormat: 'remote' | 'onsite') => {
    setFormat(nextFormat);
    if (nextFormat === 'remote') {
      setLocation('Remote');
      setLocationAddress('');
      setSelectedPlace(null);
      setPlaceResults([]);
      return;
    }

    if (location.trim().toLowerCase() === 'remote') {
      setLocation('');
      setLocationAddress('');
      setSelectedPlace(null);
      setPlaceResults([]);
    }
  };

  const selectDurationPreset = (value: number) => {
    setDuration(value);
    setDurationOption(String(value) as DurationOption);
  };

  const adjustCustomDuration = (part: 'hours' | 'minutes', delta: number) => {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const nextHours = part === 'hours' ? Math.max(0, Math.min(12, hours + delta)) : hours;
    const nextMinutes = part === 'minutes' ? Math.max(0, Math.min(59, minutes + delta)) : minutes;
    setDurationOption('custom');
    setDuration(Math.max(1, nextHours * 60 + nextMinutes));
  };

  const updateCustomDuration = (part: 'hours' | 'minutes', nextValue: string) => {
    const safeNumber = Number(nextValue.replace(/\D/g, '')) || 0;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const nextHours = part === 'hours' ? Math.min(safeNumber, 12) : hours;
    const nextMinutes = part === 'minutes' ? Math.min(safeNumber, 59) : minutes;
    setDurationOption('custom');
    setDuration(Math.max(1, nextHours * 60 + nextMinutes));
  };

  const submitCatch = async () => {
    const receiverIds = selectedContacts
      .map((contact) => contact.contactUser?.id)
      .filter(Boolean) as string[];
    if (!receiverIds.length) {
      Alert.alert('Add invitees', 'Add at least one invitee before sending.');
      return;
    }
    if (!selectedTime || !availableTimes.includes(selectedTime)) {
      Alert.alert('Pick a time', 'Select a time that works for all participants before sending.');
      return;
    }

    try {
      setSubmitting(true);
      const start = buildStartDate();
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const resolvedEventName = eventName.trim() || selectedHook?.name || 'Meeting';
      const title = `${resolvedEventName}: # catch ${selectedContacts.map((contact) => contact.displayName).join(', ')}`;
      const description = pricing === 'paid' && price ? `$${price}` : resolvedEventName;

      if (receiverIds.length === 1) {
        await http.post('/users/moment-requests', {
          receiverId: receiverIds[0],
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          title,
          description,
          hookId: selectedHook?.id ?? null,
          meetingType: pricing === 'paid' ? 'paid session' : 'meet',
          locationType: format === 'onsite' ? 'onsite' : 'remote',
          locationLabel: format === 'onsite' ? location : 'Remote meeting',
          locationAddress: format === 'onsite' ? locationAddress || null : null,
          locationLatitude:
            format === 'onsite' ? (selectedPlace?.geometry?.location?.lat ?? null) : null,
          locationLongitude:
            format === 'onsite' ? (selectedPlace?.geometry?.location?.lng ?? null) : null,
        });
      } else {
        await http.post('/users/moment-requests/multiple', {
          receiverIds,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          title,
          description,
          hookId: selectedHook?.id ?? null,
          locationType: format === 'onsite' ? 'onsite' : 'remote',
          locationLabel: format === 'onsite' ? location : 'Remote meeting',
          locationAddress: format === 'onsite' ? locationAddress || null : null,
          locationLatitude:
            format === 'onsite' ? (selectedPlace?.geometry?.location?.lat ?? null) : null,
          locationLongitude:
            format === 'onsite' ? (selectedPlace?.geometry?.location?.lng ?? null) : null,
        });
      }

      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, '0');
      const d = String(start.getDate()).padStart(2, '0');
      navigation.navigate('AppStack_HomePageScreen', {
        toast: {
          title: 'Meeting scheduled successfully',
          subtitle: `${formatDayLabel()}, ${formatTime(start)} • ${format === 'onsite' ? location : 'Remote'}`,
          calendarDate: `${y}-${m}-${d}`,
        },
      });
    } catch (error: any) {
      console.error('Error sending catch:', error);
      Alert.alert('Unable to send catch', error.response?.data?.error || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const buildStartDate = () => {
    const base = new Date();
    base.setDate(base.getDate() + selectedDayIndex);
    const [hours, minutes] = (selectedTime || '00:00').split(':').map(Number);
    base.setHours(hours, minutes, 0, 0);
    return base;
  };

  const formatTime = (date: Date) =>
    date
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase();

  const formatDayLabel = () => {
    const start = buildStartDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(start);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderHeader = (title: string, subtitle?: string, right?: React.ReactNode) => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top + v(24), v(54)) }]}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() =>
          step === 'contacts' || (mode === 'group' && step === 'hooks')
            ? navigation.goBack()
            : setStep(step === 'schedule' ? 'hooks' : 'contacts')
        }>
        <BackGlyph />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );

  if (step === 'contacts') {
    return (
      <View style={styles.screen}>
        {renderHeader(
          'Select a contact',
          'You can select only one participant',
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AppStack_ContactScreen')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.addPerson}>+</Text>
          </TouchableOpacity>
        )}
        <ScrollView contentContainerStyle={styles.contactList} showsVerticalScrollIndicator={false}>
          {contactsLoading ? (
            <Text style={styles.emptyText}>Loading contacts...</Text>
          ) : displayContacts.length === 0 ? (
            <Text style={styles.emptyText}>No contacts found.</Text>
          ) : null}
          {displayContacts.map((contact) => {
            const isRegistered = !!contact.contactUser?.id;
            const selected = isRegistered && selectedContacts.some((item) => item.id === contact.id);
            return (
              <TouchableOpacity
                key={contact.id}
                activeOpacity={isRegistered ? 0.8 : 1}
                style={[
                  styles.contactCard,
                  !isRegistered && { backgroundColor: '#F8F9FB', borderColor: '#EEF0F3' },
                ]}
                onPress={() => toggleContact(contact)}>
                <View style={styles.contactAvatarWrap}>
                  <ContactAvatar
                    avatarMap={avatarMap}
                    hashedPhoneNumber={contact.contactUser?.phoneNumber}
                    profileAvatarUrl={contact.contactUser?.avatar}
                    style={[styles.contactAvatar, !isRegistered && { opacity: 0.4 }]}
                  />
                  {isRegistered && (
                    <View style={styles.checkBadge}>
                      <Image source={CheckIcon} style={{ width: ms(10), height: ms(10) }} tintColor="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.contactName, !isRegistered && { color: COLORS.pale }]}>
                  {contact.displayName}
                </Text>
                {isRegistered ? (
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                ) : (
                  <View style={{ borderWidth: 1, borderColor: COLORS.line, borderRadius: h(12), paddingHorizontal: h(10), paddingVertical: v(4) }}>
                    <Text style={{ color: COLORS.pale, fontFamily: 'AssociateSansRegular', fontSize: ms(11) }}>Invite</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={styles.fixedButton}
          activeOpacity={0.85}
          onPress={continueFromContacts}>
          <Text style={styles.fixedButtonText}>Select</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'hooks') {
    const titleName =
      mode === 'one'
        ? `${selectedContacts[0]?.displayName?.split(' ')[0] || 'Selected contact'}’s hooks`
        : 'Your hooks';
    return (
      <View style={styles.screen}>
        {renderHeader(
          'Select a hook',
          undefined,
          mode === 'group' ? (
            <TouchableOpacity onPress={continueFromHooks}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : null
        )}
        <View style={styles.hookSearch}>
          <TextInput
            style={styles.hookSearchInput}
            placeholder="Search hooks"
            placeholderTextColor="#A8B3BF"
            value={hookSearch}
            onChangeText={setHookSearch}
          />
          <Image source={SearchIcon} style={styles.searchIcon} resizeMode="contain" />
        </View>
        <Text style={styles.hooksTitle}>{titleName}</Text>
        <ScrollView
          contentContainerStyle={{ paddingBottom: v(128) }}
          showsVerticalScrollIndicator={false}>
          {hooksLoading ? (
            <ActivityIndicator size="large" color={COLORS.green} style={{ marginTop: v(40) }} />
          ) : null}
          {displayHooks.map((hook) => {
            const selected = selectedHook?.id === hook.id;
            const expanded = expandedHookId === hook.id;
            const toggleExpand = () => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpandedHookId(expanded ? null : hook.id);
            };
            return (
              <TouchableOpacity
                key={hook.id}
                style={[styles.hookCard, selected && styles.hookCardSelected]}
                activeOpacity={0.85}
                onPress={() => setSelectedHook(hook)}>
                <View style={styles.hookTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: h(5), flex: 1 }}>
                    <Text style={styles.hookName}>{hook.name}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('AppStack_HookEditorScreen', { hookId: hook.id, source: 'sendCatch' })}>
                      <Image source={EditIcon} style={{ width: h(12), height: h(12) }} tintColor="#6F7780" resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.hookBadges}>
                    <Text style={styles.openBadge}>{hook.status}</Text>
                    <Text style={styles.freeBadge}>
                      {hook.isPaid
                        ? `${formatPrice(hook.priceCents)}${hook.billingType === 'hourly' ? '/hr' : ''}`
                        : 'Free'}
                    </Text>
                  </View>
                </View>
                <View style={styles.hookDetails}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Image source={UpcomingIcon} style={{ width: 11, height: 11 }} tintColor="#6F7780" />
                    <Text style={styles.hookDetailText}>{hook.duration} min</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Image source={LocationIcon} style={{ width: 11, height: 11 }} tintColor="#6F7780" />
                    <Text style={styles.hookDetailText}>{hook.location}</Text>
                  </View>
                </View>
                {expanded && (
                  <View style={styles.hookExpandedDetails}>
                    {!!hook.description && (
                      <Text style={styles.hookExpandedDescription}>{hook.description}</Text>
                    )}
                    {hook.capacity != null && (
                      <View style={styles.hookExpandedRow}>
                        <Text style={styles.hookExpandedLabel}>Capacity</Text>
                        <Text style={styles.hookExpandedValue}>{hook.capacity} people</Text>
                      </View>
                    )}
                    <View style={styles.hookExpandedRow}>
                      <Text style={styles.hookExpandedLabel}>Pricing</Text>
                      <Text style={styles.hookExpandedValue}>
                        {hook.isPaid
                          ? `${formatPrice(hook.priceCents)} · ${hook.billingType === 'hourly' ? 'Hourly' : 'Fixed'}`
                          : 'Free'}
                      </Text>
                    </View>
                    <View style={styles.hookExpandedRow}>
                      <Text style={styles.hookExpandedLabel}>Access</Text>
                      <Text style={styles.hookExpandedValue}>{hook.status}</Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.moreDetails}
                  activeOpacity={0.7}
                  onPress={toggleExpand}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.moreDetailsText}>{expanded ? 'Less details' : 'More details'}</Text>
                    <Image
                      source={ChevronIcon}
                      style={{ width: 11, height: 11, transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
                      tintColor="#6F7780"
                    />
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          {!hooksLoading && displayHooks.length === 0 ? (
            <Text style={styles.emptyText}>
              No hooks found. Create a hook first before sending a catch.
            </Text>
          ) : null}
        </ScrollView>
        <TouchableOpacity
          style={styles.fixedButton}
          activeOpacity={0.85}
          onPress={continueFromHooks}>
          <Text style={styles.fixedButtonText}>Select</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const monthLabel = selectedDayDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Navigating to a different date never auto-changes `selectedTime` (see the
  // one-time init effect above) \u2014 so if the previously picked time doesn't
  // apply to whichever day is currently being viewed, the button honestly
  // prompts for a fresh pick instead of showing a stale, no-longer-valid time.
  const sendButtonLabel = selectedTime && availableTimes.includes(selectedTime)
    ? `Send Catch \u00B7 ${formatDayLabel()}, ${selectedStartLabel}`
    : 'Select an available time';

  return (
    <View style={styles.screen}>
      {renderHeader('When do you want to meet?')}
      <Text style={styles.monthLabel}>{monthLabel}</Text>
      <View style={styles.dayRail}>
        {visibleDays.map((day) => (
          <TouchableOpacity
            key={day.dateString}
            style={styles.dayItem}
            onPress={() => setSelectedDayIndex(day.offset)}>
            <Text style={styles.dayLabel}>{day.label}</Text>
            <View
              style={[
                styles.dayNumberWrap,
                selectedDayIndex === day.offset && styles.dayNumberSelected,
              ]}>
              <Text
                style={[
                  styles.dayNumber,
                  selectedDayIndex === day.offset && styles.dayNumberTextSelected,
                ]}>
                {day.date.getDate()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        ref={timeGridScrollRef}
        contentContainerStyle={{
          paddingHorizontal: h(16),
          paddingBottom: v(180),
        }}>
        {loadingUserAvailability || loadingRecipientAvailability || loadingSenderBusy || loadingRecipientBusy ? (
          <ActivityIndicator size="large" color={COLORS.green} style={{ marginTop: v(40) }} />
        ) : (
          <>
            <View style={styles.timeGrid}>
              {availableTimes.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.timeGridPill, isSelected && styles.timeGridPillSelected]}
                    onPress={() => setSelectedTime(time)}
                    onLayout={(e) => {
                      if (!isSelected || didScrollToSelectedTimeRef.current) return;
                      didScrollToSelectedTimeRef.current = true;
                      const y = e.nativeEvent.layout.y;
                      timeGridScrollRef.current?.scrollTo({ y: Math.max(0, y - v(80)), animated: false });
                    }}>
                    <Text
                      style={[
                        styles.timeGridPillText,
                        isSelected && styles.timeGridPillTextSelected,
                      ]}>
                      {formatTimeString(time)}
                    </Text>
                    {isSelected ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: v(1) }}>
                        <Image source={ChevronIcon} style={{ width: h(11), height: h(11), marginRight: h(3) }} tintColor="rgba(255,255,255,0.8)" />
                        <Text style={styles.timeGridEndLabel}>{selectedEndLabel}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {availableTimes.length === 0 ? (
              <Text style={styles.emptyText}>
                {selectedContacts.length > 0
                  ? 'No overlapping availability between all participants for this day and duration.'
                  : 'Not available on this day. Update your availability in settings.'}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.summaryBar}
          activeOpacity={0.75}
          onPress={() => setShowCustomizeModal(true)}>
          <Text style={styles.summaryText}>
            {duration} min · {format === 'remote' ? 'Remote' : location || 'In-person'}
            {pricing === 'paid' && price ? ` · $${price}` : ''}
          </Text>
          <Text style={styles.summaryEdit}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={submitCatch}
          activeOpacity={0.85}
          disabled={
            submitting ||
            !selectedTime ||
            !availableTimes.includes(selectedTime) ||
            loadingUserAvailability ||
            loadingRecipientAvailability
          }>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.fixedButtonText}>{sendButtonLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
      {renderCustomizeSheetModal()}
    </View>
  );

  // The "Customize event" sheet, its per-field editor (name/duration/
  // location/invitees/price), and the "remove invitee" confirmation used to
  // each be their own separate <Modal>. Tapping a field (which sets `sheet`)
  // left the "Customize event" Modal mounted (driven by `showCustomizeModal`)
  // while a SECOND Modal also mounted on top of it — two simultaneously
  // visible native Modals, which iOS's presentation stack does not handle
  // cleanly (that's exactly why tapping a field did nothing, and closing
  // afterward could leave the whole screen touch-unresponsive; Android
  // tolerates this, which is why it only showed up on iOS). All three are
  // now content switches inside ONE persistent <Modal>, keyed off
  // `showCustomizeModal`/`sheet`/`removeContact`, so only one native Modal
  // is ever presented at a time.
  function renderCustomizeSheetModal() {
    if (!showCustomizeModal) return null;
    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() => (sheet ? setSheet(null) : setShowCustomizeModal(false))}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BlurView intensity={10} tint="dark" style={styles.modalBackdrop}>
            <View style={styles.dim} />
          </BlurView>
          <View
            style={[
              styles.editSheet,
              { paddingBottom: Math.max(insets.bottom + v(16), v(24)) },
            ]}>
            {sheet ? renderFieldEditorContent() : renderCustomizeFieldsContent()}
          </View>
          {removeContact && renderRemoveContactOverlay()}
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderCustomizeFieldsContent() {
    return (
      <>
        <View style={styles.sheetHandle} />
        <View style={styles.editHeader}>
          <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
            <BackGlyph size={24} />
          </TouchableOpacity>
          <Text style={styles.editTitle}>Customize event</Text>
          <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
            <Text style={styles.saveText}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <CustomizeRow
            icon="globe"
            label="Format"
            value=""
            control={
              <Segment
                value={format}
                left="Remote"
                right="In-person"
                activeRight={format === 'onsite'}
                onLeft={() => setMeetingFormat('remote')}
                onRight={() => setMeetingFormat('onsite')}
              />
            }
          />
          <CustomizeRow
            icon="money"
            label="Pricing"
            value={pricing === 'paid' && price ? `$${price}` : 'Free'}
            control={
              <Segment
                value={pricing}
                left="Paid"
                right="Free"
                activeRight={pricing === 'free'}
                onLeft={() => openSheet('price')}
                onRight={() => setPricing('free')}
              />
            }
          />
          <CustomizeRow
            icon="calendar"
            label="Event name"
            value={eventName || 'Enter name'}
            onPress={() => openSheet('name')}
          />
          <CustomizeRow
            icon="clock"
            label="Duration"
            value={duration ? `${duration} minutes` : 'Select duration'}
            onPress={() => openSheet('duration')}
          />
          <CustomizeRow
            icon="pin"
            label="Location"
            value={format === 'remote' ? 'Remote' : location || 'Select location'}
            disabled={format === 'remote'}
            onPress={() => openSheet('location')}
          />
          <CustomizeRow
            icon="people"
            label="Invitees"
            value=""
            onPress={() => openSheet('invitees')}
            avatars={selectedContacts}
          />
        </ScrollView>
      </>
    );
  }

  function renderFieldEditorContent() {
    if (!sheet) return null;
    const title =
      sheet === 'price'
        ? 'Price'
        : sheet === 'name'
          ? 'Event name'
          : sheet === 'duration'
            ? 'Duration'
            : sheet === 'location'
              ? 'Location'
              : 'Location';
    return (
      <>
        <View style={styles.sheetHandle} />
        <View style={styles.editHeader}>
          <TouchableOpacity onPress={() => setSheet(null)}>
            <BackGlyph size={24} />
          </TouchableOpacity>
          <Text style={styles.editTitle}>{title}</Text>
          <TouchableOpacity onPress={saveSheet}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
        {sheet === 'duration' ? (
          renderDurationEditor()
        ) : sheet === 'invitees' ? (
          renderInviteesEditor()
        ) : sheet === 'location' ? (
          renderLocationEditor()
        ) : (
          <TextInput
            style={styles.editInput}
            placeholder={sheet === 'price' ? 'Enter amount $' : 'Enter name'}
            placeholderTextColor="#A8B3BF"
            value={draftValue}
            onChangeText={setDraftValue}
            keyboardType={sheet === 'price' ? 'number-pad' : 'default'}
            autoFocus
          />
        )}
      </>
    );
  }

  function renderDurationEditor() {
    const customHours = Math.floor(duration / 60);
    const customMinutes = duration % 60;

    return (
      <View>
        {[15, 30, 45, 60].map((value) => (
          <TouchableOpacity
            key={value}
            style={styles.optionRow}
            onPress={() => selectDurationPreset(value)}>
            <Text style={styles.optionText}>{value === 60 ? '1 hour' : `${value} minutes`}</Text>
            <View style={[styles.radio, durationOption === String(value) && styles.radioSelected]}>
              {durationOption === String(value) && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            setDurationOption('custom');
            if (!duration) setDuration(30);
          }}>
          <Text style={styles.optionText}>Custom</Text>
          <View style={[styles.radio, durationOption === 'custom' && styles.radioSelected]}>
            {durationOption === 'custom' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
        {durationOption === 'custom' ? (
          <View style={styles.customDuration}>
            <Text style={styles.durationLabel}>Hours</Text>
            <View style={styles.durationControlRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => adjustCustomDuration('hours', -1)}>
                <Text style={styles.stepperText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.durationInput}
                value={String(customHours)}
                onChangeText={(value) => updateCustomDuration('hours', value)}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => adjustCustomDuration('hours', 1)}>
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.durationUnit}>hours</Text>
            </View>
            <Text style={styles.durationLabel}>Minutes</Text>
            <View style={styles.durationControlRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => adjustCustomDuration('minutes', -5)}>
                <Text style={styles.stepperText}>-</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.durationInput}
                value={String(customMinutes)}
                onChangeText={(value) => updateCustomDuration('minutes', value)}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => adjustCustomDuration('minutes', 5)}>
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
              <Text style={styles.durationUnit}>min</Text>
            </View>
            <Text style={styles.durationSummary}>
              Duration: {customHours > 0 ? `${customHours}h ` : ''}
              {customMinutes}m
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  function renderLocationEditor() {
    const selectedCoordinates = selectedPlace?.geometry?.location;

    return (
      <View>
        <TextInput
          style={styles.editInput}
          placeholder={mapApiKey ? 'Search location' : 'Enter location'}
          placeholderTextColor="#A8B3BF"
          value={draftValue}
          onChangeText={(value) => {
            setDraftValue(value);
            setSelectedPlace(null);
            setLocationAddress('');
          }}
          autoFocus
        />
        {!mapApiKey ? (
          <Text style={styles.locationHint}>
            Google Places is not configured. This location will be saved as entered.
          </Text>
        ) : null}
        {placesLoading ? (
          <ActivityIndicator color={COLORS.green} style={styles.placesLoader} />
        ) : null}
        {selectedPlace ? (
          <>
            {selectedCoordinates ? (
              <View style={styles.placeMap}>
                <MapView
                  style={styles.placeMapView}
                  pointerEvents="none"
                  initialRegion={{
                    latitude: selectedCoordinates.lat,
                    longitude: selectedCoordinates.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}>
                  <Marker
                    coordinate={{
                      latitude: selectedCoordinates.lat,
                      longitude: selectedCoordinates.lng,
                    }}
                    pinColor={COLORS.green}
                  />
                </MapView>
              </View>
            ) : null}
            <View style={styles.selectedPlaceCard}>
              <Text style={styles.placeTitle}>{selectedPlace.name}</Text>
              {selectedPlace.formatted_address ? (
                <Text style={styles.placeSubtitle}>{selectedPlace.formatted_address}</Text>
              ) : null}
            </View>
          </>
        ) : null}
        {placeResults.length > 0 ? (
          <View style={styles.placeResults}>
            {placeResults.map((place) => (
              <TouchableOpacity
                key={place.place_id}
                style={styles.placeResultRow}
                onPress={() => selectPlace(place)}>
                <View style={styles.placeIcon}>
                  <MiniIcon type="pin" />
                </View>
                <View style={styles.placeResultText}>
                  <Text style={styles.placeTitle}>{place.name}</Text>
                  {place.formatted_address ? (
                    <Text style={styles.placeSubtitle}>{place.formatted_address}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {mapApiKey &&
        draftValue.trim().length >= 2 &&
        !placesLoading &&
        !selectedPlace &&
        placeResults.length === 0 ? (
          <Text style={styles.locationHint}>No matching locations found yet.</Text>
        ) : null}
      </View>
    );
  }

  function renderInviteesEditor() {
    return (
      <View>
        <Text style={styles.inputLabel}>Invitee name</Text>
        <TextInput
          style={styles.editInput}
          placeholder="Enter invitee name"
          value={contactSearch}
          onChangeText={setContactSearch}
          autoFocus
        />
        <Text style={styles.inputLabel}>Your contacts</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: h(16) }}>
          {contactsLoading ? <Text style={styles.emptyText}>Loading contacts...</Text> : null}
          {!contactsLoading && displayContacts.length === 0 ? (
            <Text style={styles.emptyText}>No contacts found.</Text>
          ) : null}
          {displayContacts.slice(0, 8).map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.inviteeContact}
              onPress={() => toggleContact(contact)}>
              <ContactAvatar
                avatarMap={avatarMap}
                hashedPhoneNumber={contact.contactUser?.phoneNumber}
                profileAvatarUrl={contact.contactUser?.avatar}
                style={styles.inviteeAvatar}
              />
              <View style={styles.plusBadge}>
                <Text style={styles.plusBadgeText}>+</Text>
              </View>
              <Text style={styles.inviteeName}>{contact.displayName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.inputLabel}>Added invitees</Text>
        <View style={styles.chipWrap}>
          {selectedContacts.map((contact) => (
            <InviteeChip
              key={contact.id}
              contact={contact}
              onRemove={() => setRemoveContact(contact)}
            />
          ))}
        </View>
      </View>
    );
  }

  function renderRemoveContactOverlay() {
    if (!removeContact) return null;
    return (
        <View style={[styles.confirmOverlay, StyleSheet.absoluteFillObject]}>
          <BlurView intensity={10} tint="dark" style={styles.modalBackdrop}>
            <View style={styles.dim} />
          </BlurView>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remove {removeContact.displayName}?</Text>
            <Text style={styles.confirmText}>
              This person will be removed from the meeting and will no longer receive updates about
              it.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setRemoveContact(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  setSelectedContacts((prev) =>
                    prev.filter((item) => item.id !== removeContact.id)
                  );
                  setRemoveContact(null);
                }}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    );
  }
};

const Segment = ({
  left,
  right,
  activeRight,
  onLeft,
  onRight,
  value,
}: {
  left: string;
  right: string;
  activeRight: boolean;
  onLeft: () => void;
  onRight: () => void;
  value: string;
}) => (
  <View style={styles.segment}>
    <TouchableOpacity
      style={[styles.segmentItem, !activeRight && styles.segmentActive]}
      onPress={onLeft}>
      <Text style={[styles.segmentText, !activeRight && styles.segmentTextActive]}>{left}</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.segmentItem, activeRight && styles.segmentActive]}
      onPress={onRight}>
      <Text style={[styles.segmentText, activeRight && styles.segmentTextActive]}>{right}</Text>
    </TouchableOpacity>
  </View>
);

const CustomizeRow = ({
  icon,
  label,
  value,
  control,
  onPress,
  disabled,
  avatars,
}: {
  icon: 'clock' | 'pin' | 'calendar' | 'people' | 'globe' | 'money';
  label: string;
  value: string;
  control?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  avatars?: Contact[];
}) => {
  const { avatarMap } = useDeviceContactAvatarMap();
  return (
  <TouchableOpacity
    style={[styles.customRow, disabled && styles.disabledRow]}
    onPress={onPress}
    activeOpacity={onPress ? 0.8 : 1}
    disabled={disabled || !onPress}>
    <MiniIcon type={icon} />
    <Text style={styles.customLabel}>{label}: </Text>
    {avatars ? (
      <View style={styles.rowAvatars}>
        {avatars.slice(0, 4).map((contact, index) => (
          <ContactAvatar
            key={contact.id}
            avatarMap={avatarMap}
            hashedPhoneNumber={contact.contactUser?.phoneNumber}
            profileAvatarUrl={contact.contactUser?.avatar}
            style={[styles.rowAvatar, { marginLeft: index === 0 ? 0 : -h(10) }]}
          />
        ))}
      </View>
    ) : (
      <Text style={styles.customValue}>{value}</Text>
    )}
    <View style={styles.customSpacer} />
    {control || <Image source={ChevronIcon} style={{ width: h(16), height: h(16) }} tintColor={COLORS.muted} />}
  </TouchableOpacity>
  );
};

const InviteeChip = ({ contact, onRemove }: { contact: Contact; onRemove: () => void }) => {
  const { avatarMap } = useDeviceContactAvatarMap();
  return (
  <TouchableOpacity style={styles.inviteeChip} onPress={onRemove}>
    <ContactAvatar
      avatarMap={avatarMap}
      hashedPhoneNumber={contact.contactUser?.phoneNumber}
      profileAvatarUrl={contact.contactUser?.avatar}
      style={styles.chipAvatar}
    />
    <Text style={styles.chipText}>{contact.displayName}</Text>
    <Image source={CrossIcon} style={{ width: h(14), height: h(14), marginLeft: h(8) }} tintColor={COLORS.muted} />
  </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(16),
    marginBottom: v(22),
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(22),
    lineHeight: ms(28),
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(17),
    marginTop: v(2),
  },
  headerRight: { width: h(34), alignItems: 'flex-end' },
  addPerson: { color: COLORS.ink, fontFamily: 'AssociateSansBold', fontSize: ms(31) },
  skipText: { color: COLORS.green, fontFamily: 'AssociateSansRegular', fontSize: ms(18) },
  contactList: { paddingHorizontal: h(16), paddingBottom: v(116), gap: v(10) },
  emptyText: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(17),
    paddingVertical: v(24),
    textAlign: 'center',
  },
  contactCard: {
    height: v(74),
    borderRadius: h(15),
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(14),
  },
  contactAvatarWrap: { width: h(48), height: h(48), marginRight: h(14) },
  contactAvatar: { width: h(48), height: h(48), borderRadius: h(24) },
  checkBadge: {
    position: 'absolute',
    right: -h(2),
    bottom: 0,
    width: h(17),
    height: h(17),
    borderRadius: h(9),
    backgroundColor: '#7EA9DB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  checkBadgeText: { color: COLORS.white, fontSize: ms(10), fontFamily: 'AssociateSansBold' },
  contactName: { flex: 1, color: COLORS.ink, fontFamily: 'AssociateSansRegular', fontSize: ms(14) },
  radio: {
    width: h(26),
    height: h(26),
    borderRadius: h(13),
    borderWidth: 2,
    borderColor: '#CDD4DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: COLORS.green },
  radioInner: { width: h(17), height: h(17), borderRadius: h(9), backgroundColor: COLORS.green },
  fixedButton: {
    position: 'absolute',
    left: h(16),
    right: h(16),
    bottom: v(38),
    height: v(58),
    borderRadius: h(29),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedButtonText: { color: COLORS.white, fontFamily: 'AssociateSansBold', fontSize: ms(20) },
  hookSearch: {
    marginHorizontal: h(16),
    height: v(48),
    borderRadius: h(24),
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(16),
  },
  hookSearchInput: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(14),
    padding: 0,
  },
  searchIcon: { width: h(20), height: h(20), tintColor: '#9EACBA' },
  hooksTitle: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(19),
    marginHorizontal: h(16),
    marginTop: v(22),
    marginBottom: v(10),
  },
  hookCard: {
    marginHorizontal: h(16),
    marginBottom: v(10),
    padding: h(15),
    borderRadius: h(14),
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.white,
  },
  hookCardSelected: { borderColor: '#CBE985', borderWidth: 2 },
  hookTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hookName: { color: COLORS.ink, fontFamily: 'AssociateSansRegular', fontSize: ms(14) },
  hookBadges: { flexDirection: 'row', gap: h(6) },
  openBadge: {
    overflow: 'hidden',
    color: '#125BE8',
    backgroundColor: '#EAF2FF',
    borderRadius: h(11),
    paddingHorizontal: h(8),
    paddingVertical: v(3),
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(12),
  },
  freeBadge: {
    overflow: 'hidden',
    color: '#65840E',
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(11),
    paddingHorizontal: h(9),
    paddingVertical: v(3),
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(12),
  },
  hookDetails: {
    marginTop: v(12),
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: h(10),
    padding: h(10),
    gap: v(6),
  },
  hookDetailText: { color: COLORS.muted, fontFamily: 'AssociateSansRegular', fontSize: ms(13) },
  hookExpandedDetails: {
    marginTop: v(10),
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: v(10),
    gap: v(8),
  },
  hookExpandedDescription: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(12),
    lineHeight: ms(17),
    marginBottom: v(3),
  },
  hookExpandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hookExpandedLabel: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(12),
  },
  hookExpandedValue: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(12),
  },
  moreDetails: {
    marginTop: v(12),
    height: v(36),
    borderRadius: h(18),
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreDetailsText: { color: COLORS.muted, fontFamily: 'AssociateSansBold', fontSize: ms(12) },
  dayRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: h(16),
    marginBottom: v(24),
  },
  dayItem: { alignItems: 'center', width: h(48) },
  dayLabel: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(13),
    marginBottom: v(10),
  },
  dayNumberWrap: {
    width: h(45),
    height: h(45),
    borderRadius: h(23),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberSelected: {
    backgroundColor: COLORS.ink,
    width: h(58),
    height: h(58),
    borderRadius: h(29),
  },
  dayNumber: { color: COLORS.ink, fontFamily: 'AssociateSansBold', fontSize: ms(16) },
  dayNumberTextSelected: { color: COLORS.white },
  monthLabel: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(16),
    textAlign: 'center',
    marginBottom: v(14),
  },
  timeGrid: {
    flexDirection: 'column',
    gap: h(8),
  },
  timeGridPill: {
    width: '100%',
    minHeight: v(42),
    borderRadius: h(13),
    borderWidth: 1,
    borderColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: v(6),
  },
  timeGridPillSelected: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  timeGridPillText: {
    color: COLORS.green,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(14),
  },
  timeGridPillTextSelected: { color: COLORS.white },
  timeGridEndLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(11),
    marginTop: v(1),
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(20),
    borderTopRightRadius: h(20),
    paddingHorizontal: h(16),
    paddingTop: v(12),
    paddingBottom: v(38),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: v(10),
    marginBottom: v(10),
  },
  summaryText: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(14),
    flex: 1,
  },
  summaryEdit: {
    color: COLORS.green,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(14),
    marginLeft: h(12),
  },
  sendButton: {
    height: v(56),
    borderRadius: h(28),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: h(64),
    height: v(4),
    borderRadius: h(2),
    backgroundColor: '#D8DEE4',
    marginBottom: v(18),
  },
  customRow: {
    minHeight: v(58),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledRow: { opacity: 0.38 },
  customLabel: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(15),
    marginLeft: h(11),
  },
  customValue: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(15),
    flexShrink: 1,
  },
  customSpacer: { flex: 1 },
  chevron: { color: COLORS.muted, fontFamily: 'AssociateSansRegular', fontSize: ms(31) },
  segment: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: h(25), padding: 0 },
  segmentItem: {
    paddingHorizontal: h(15),
    height: v(42),
    borderRadius: h(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: COLORS.green },
  segmentText: { color: '#8E98A2', fontFamily: 'AssociateSansRegular', fontSize: ms(17) },
  segmentTextActive: { color: COLORS.white },
  rowAvatars: { flexDirection: 'row', alignItems: 'center' },
  rowAvatar: {
    width: h(36),
    height: h(36),
    borderRadius: h(18),
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  dim: { flex: 1, backgroundColor: '#000', opacity: 0.2 },
  editSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(26),
    borderTopRightRadius: h(26),
    paddingHorizontal: h(16),
    paddingTop: v(16),
    minHeight: v(300),
  },
  editHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: v(23) },
  editTitle: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(22),
    marginLeft: h(10),
  },
  saveText: { color: COLORS.green, fontFamily: 'AssociateSansRegular', fontSize: ms(18) },
  editInput: {
    height: v(50),
    borderRadius: h(25),
    borderWidth: 1,
    borderColor: '#CBE985',
    color: COLORS.ink,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(16),
    paddingHorizontal: h(20),
    marginBottom: v(22),
  },
  optionRow: {
    minHeight: v(64),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: { color: COLORS.ink, fontFamily: 'AssociateSansRegular', fontSize: ms(16) },
  customDuration: { paddingTop: v(12), paddingBottom: v(8), gap: v(12) },
  durationLabel: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(15),
  },
  durationControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: h(12),
    marginBottom: v(10),
  },
  stepperButton: {
    width: h(52),
    height: h(52),
    borderRadius: h(26),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    color: COLORS.white,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(28),
    marginTop: -v(2),
  },
  durationUnit: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(16),
    width: h(50),
  },
  durationSummary: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(16),
    marginTop: v(4),
  },
  sliderKnob: {
    width: h(54),
    height: h(54),
    borderRadius: h(27),
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderKnobText: {
    color: COLORS.green,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(20),
  },
  sliderTrack: {
    flex: 1,
    height: v(14),
    borderRadius: h(7),
    backgroundColor: '#E9EEF3',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.green,
  },
  sliderDot: {
    alignSelf: 'center',
    width: h(10),
    height: h(10),
    borderRadius: h(5),
    backgroundColor: COLORS.white,
  },
  durationInput: {
    width: h(88),
    height: v(50),
    borderRadius: h(25),
    borderWidth: 1,
    borderColor: COLORS.line,
    color: COLORS.ink,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(16),
    textAlign: 'center',
  },
  locationHint: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(14),
    lineHeight: ms(20),
    marginBottom: v(12),
  },
  placesLoader: { marginVertical: v(12) },
  placeMap: {
    height: v(325),
    borderRadius: h(24),
    overflow: 'hidden',
    marginBottom: v(16),
    backgroundColor: '#EEF2F5',
  },
  placeMapView: { flex: 1 },
  mapLabel: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -h(54) }, { translateY: -v(38) }],
    minWidth: h(108),
    minHeight: v(40),
    borderRadius: h(12),
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: h(12),
  },
  mapLabelText: {
    color: COLORS.green,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(16),
  },
  selectedPlaceCard: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: h(18),
    paddingHorizontal: h(16),
    paddingVertical: v(14),
    marginBottom: v(12),
  },
  placeResults: {
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    marginTop: v(6),
  },
  placeResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: v(14),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  placeIcon: {
    width: h(42),
    height: h(42),
    borderRadius: h(21),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F6F8',
    marginRight: h(12),
  },
  placeResultText: { flex: 1 },
  placeTitle: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(18),
    marginBottom: v(6),
  },
  placeSubtitle: { color: COLORS.muted, fontFamily: 'AssociateSansRegular', fontSize: ms(14) },
  inputLabel: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(18),
    marginBottom: v(10),
  },
  inviteeContact: { width: h(78), alignItems: 'center', marginBottom: v(25) },
  inviteeAvatar: { width: h(64), height: h(64), borderRadius: h(32) },
  plusBadge: {
    position: 'absolute',
    right: h(2),
    top: 0,
    backgroundColor: COLORS.green,
    width: h(22),
    height: h(22),
    borderRadius: h(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadgeText: { color: COLORS.white, fontFamily: 'AssociateSansBold', fontSize: ms(17) },
  inviteeName: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(14),
    textAlign: 'center',
    marginTop: v(8),
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: h(10) },
  inviteeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: h(20),
    paddingVertical: v(6),
    paddingLeft: h(6),
    paddingRight: h(12),
  },
  chipAvatar: { width: h(28), height: h(28), borderRadius: h(14), marginRight: h(7) },
  chipText: { color: COLORS.ink, fontFamily: 'AssociateSansRegular', fontSize: ms(15) },
  chipRemove: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(22),
    marginLeft: h(8),
  },
  confirmOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  confirmCard: {
    width: '91%',
    borderRadius: h(22),
    backgroundColor: COLORS.white,
    padding: h(24),
    alignItems: 'center',
  },
  confirmTitle: {
    color: COLORS.ink,
    fontFamily: 'AssociateSansBold',
    fontSize: ms(22),
    textAlign: 'center',
    marginBottom: v(12),
  },
  confirmText: {
    color: COLORS.muted,
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(18),
    lineHeight: ms(24),
    textAlign: 'center',
    marginBottom: v(26),
  },
  confirmActions: { flexDirection: 'row', gap: h(8) },
  cancelButton: {
    flex: 1,
    height: v(52),
    borderRadius: h(26),
    borderWidth: 1,
    borderColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    flex: 1,
    height: v(52),
    borderRadius: h(26),
    backgroundColor: '#9AA3AC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: COLORS.green, fontFamily: 'AssociateSansBold', fontSize: ms(17) },
  removeText: { color: COLORS.white, fontFamily: 'AssociateSansBold', fontSize: ms(17) },
});

export default AppStack_SendCatchScreen;
