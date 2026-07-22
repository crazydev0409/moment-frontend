import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as ExpoLocation from 'expo-location';
import * as Notifications from 'expo-notifications';
import MapView, { Marker } from 'react-native-maps';
import { useAtom } from 'jotai';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppStackParamList } from '.';

import { http } from '~/helpers/http';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import { AvailabilitySchedule } from '~/helpers/calendarAvailability';
import { layoutEventsForDay, layoutEventsForMonthRow, dayKey } from '~/helpers/calendarLayout';
import { NotificationsIcon, GoogleCalendarIcon, OutlookIcon, HookIcon, CheckIcon } from '~/lib/images';
import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';
import { userAtom } from '~/store';
import { useDeviceContactAvatarMap } from '~/helpers/contactAvatars';
import { ContactAvatar } from '~/components/ContactAvatar';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_CalendarScreen'>;

interface BookableUserResponse {
  id: string;
  displayName: string;
  avatar?: string | null;
}
type CalendarProvider = 'google' | 'microsoft' | 'icloud';
type ViewMode = 'day' | 'week' | 'month' | 'year';
type Sheet = null | 'details' | 'edit' | 'time' | 'location' | 'invitees';

type CalendarIntegration = {
  provider: CalendarProvider;
  connected: boolean;
  status?: string;
};

type Person = {
  id: string;
  name?: string;
  avatar?: string;
  phoneNumber?: string;
};

type Contact = {
  id: string;
  displayName: string;
  avatar?: string;
  contactUser?: Person;
};

type CalendarItem = {
  id: string;
  source: 'catch' | CalendarProvider;
  sourceType: 'internal' | 'external';
  title: string;
  startTime: string;
  endTime: string;
  status?: string;
  priceLabel?: string;
  locationLabel?: string | null;
  locationAddress?: string | null;
  senderId?: string;
  receiverId?: string;
  sender?: Person;
  receiver?: Person;
  allDay?: boolean;
};

const COLORS = {
  bg: '#F3F6FA',
  ink: '#171927',
  muted: '#6F7780',
  pale: '#AEB9C4',
  line: '#D8DEE4',
  softLine: '#E8EDF2',
  white: '#FFFFFF',
  green: '#9AC51F',
  lightGreen: '#F8FDEB',
  greyButton: '#9AA3AC',
  // Declined/rejected internal events — kept distinct from pending's green
  // outline so the two can never be mistaken for each other. Matches Google
  // Calendar: declining never removes the event, it just marks it declined
  // (muted, this style) for both sender and receiver — only an explicit
  // delete removes it from the calendar.
  declinedText: '#9AA3AC',
};

const h = (size: number) => horizontalScale(size);
const v = (size: number) => verticalScale(size);
const ms = (size: number) => moderateScale(size, 0.2);

// The single dial controlling how much of the day is visible at once, in Day
// and Week views alike. Was v(80) previously (only ~6.5hrs visible without
// scrolling); v(48) shows ~10-11hrs — enough to see a full workday without scrolling.
// Every timeline position/height calculation derives from this constant so
// it stays the one place to retune density.
const HOUR_HEIGHT = v(48);
// Pixel budgets (not hardcoded minute cutoffs) for the event-card text tiers,
// so they scale automatically if HOUR_HEIGHT ever changes again.
const TINY_EVENT_PX = v(20);
const COMPACT_EVENT_PX = v(32);
const minutesForPx = (px: number) => (px / HOUR_HEIGHT) * 60;
// Small visual breathing room between back-to-back events (Google Calendar
// always leaves a sliver of a gap even when one event's end time exactly
// matches the next one's start time, rather than letting the blocks touch).
const EVENT_GAP_PX = v(3);
// A line of text occupies more vertical space than its raw font size (line
// height, ascenders/descenders) — used to work backward from an event
// block's actual pixel height to a font size guaranteed to fit inside it,
// so short-duration events never get their title clipped at the bottom.
const EVENT_LINE_HEIGHT_RATIO = 1.15;
const MIN_EVENT_FONT_PX = ms(9);
function fitEventFontSize(availableHeightPx: number, lines: number, maxFontPx: number) {
  const perLine = availableHeightPx / lines;
  const fitted = perLine / EVENT_LINE_HEIGHT_RATIO;
  // Never exceeds the tier's normal/default size — only shrinks when the
  // block is genuinely too short for it.
  return Math.max(MIN_EVENT_FONT_PX, Math.min(maxFontPx, fitted));
}
// Short events borrow space from the block's own inline padding before the
// font is allowed to shrink — a squeezed meeting reads better with slightly
// tighter padding and a normal-sized title than with generous padding and a
// tiny, hard-to-read one. Padding still never drops below `minPadding`.
function fitEventPadding(boxHeightPx: number, comfortablePadding: number, minPadding: number) {
  return Math.max(minPadding, Math.min(comfortablePadding, boxHeightPx * 0.12));
}
// Month view: at most this many event bars stack in a single day cell before
// the rest collapse into a "•••" overflow indicator (matches the reference
// design, and keeps every week row a predictable fixed height regardless of
// how many events a given day has).
const MAX_MONTH_LANES = 3;
const MONTH_BAR_HEIGHT = v(15);
const MONTH_BAR_GAP = v(2);
const BackGlyph = ({ size = 32, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 7 11 16l9 9"
      stroke={color}
      strokeWidth="3.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ProviderIcon = ({ provider, size = 24 }: { provider: 'catch' | CalendarProvider; size?: number }) => {
  const s = h(size);

  if (provider === 'catch') {
    return (
      <Image
        source={HookIcon}
        tintColor="#97B92A"
        style={{ width: s, height: s }}
        resizeMode="contain"
      />
    );
  }

  if (provider === 'google') {
    return (
      <Image
        source={GoogleCalendarIcon}
        style={{ width: s, height: s }}
        resizeMode="contain"
      />
    );
  }

  if (provider === 'icloud') {
    const today = new Date().getDate().toString();
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Rect x="1" y="1" width="22" height="22" rx="3.5" fill="white" stroke="#E0E0E0" strokeWidth="0.7" />
        <Rect x="1" y="1" width="22" height="7.5" rx="3.5" fill="#FF3B30" />
        <Rect x="1" y="5" width="22" height="3.5" fill="#FF3B30" />
        <SvgText x="12" y="19" textAnchor="middle" fill="#1C1D26" fontSize="8" fontWeight="700">
          {today}
        </SvgText>
      </Svg>
    );
  }

  // Microsoft Outlook
  return (
    <Image
      source={OutlookIcon}
      style={{ width: s, height: s }}
      resizeMode="contain"
    />
  );
};

const MiniIcon = ({
  type,
  color = COLORS.pale,
  size = 24,
}: {
  type: 'clock' | 'pin' | 'host' | 'edit' | 'search' | 'trash' | 'food';
  color?: string;
  size?: number;
}) => (
  <Svg width={h(size)} height={h(size)} viewBox="0 0 24 24" fill="none">
    {type === 'clock' && (
      <>
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.1" />
        <Path
          d="M12 7v5l3 2"
          stroke={color}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
    {type === 'pin' && (
      <>
        <Path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z" stroke={color} strokeWidth="2.1" />
        <Circle cx="12" cy="10" r="2.2" stroke={color} strokeWidth="2.1" />
      </>
    )}
    {type === 'host' && (
      <Path
        d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z"
        stroke={color}
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
    )}
    {type === 'edit' && (
      <Path
        d="M5 19h4l10-10a2.8 2.8 0 0 0-4-4L5 15v4ZM13 7l4 4"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {type === 'search' && (
      <>
        <Circle cx="10.8" cy="10.8" r="6.8" stroke={color} strokeWidth="2.2" />
        <Path d="m16 16 5 5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      </>
    )}
    {type === 'trash' && (
      <Path
        d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
    {type === 'food' && (
      <Path
        d="M5 16h14M7 16a7 7 0 0 1 14 0M3 21h18M8 10l7-5M16 5l2 3"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </Svg>
);

/** Returns absolutely-positioned band specs for all unavailable periods in a day. */
function getUnavailableBands(
  availability: AvailabilitySchedule | null,
  weekday: number,
): { top: number; height: number }[] {
  if (!availability) return [];
  const daySlots = availability.slots
    .filter((s) => s.weekday === weekday)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const unavailable: { startMinutes: number; endMinutes: number }[] = [];
  let cursor = 0;
  for (const slot of daySlots) {
    if (slot.startMinutes > cursor) {
      unavailable.push({ startMinutes: cursor, endMinutes: slot.startMinutes });
    }
    cursor = Math.max(cursor, slot.endMinutes);
  }
  if (cursor < 24 * 60) {
    unavailable.push({ startMinutes: cursor, endMinutes: 24 * 60 });
  }

  return unavailable.map(({ startMinutes, endMinutes }) => {
    // Align with the same coordinate system as events: top = v(10) + (min/60)*HOUR_HEIGHT
    // For the very first band (midnight), extend to the top of the container.
    const top = startMinutes === 0 ? 0 : v(10) + (startMinutes / 60) * HOUR_HEIGHT;
    const bottom = v(10) + (endMinutes / 60) * HOUR_HEIGHT;
    return { top, height: bottom - top };
  });
}

const AppStack_CalendarScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [user] = useAtom(userAtom);
  const { avatarMap } = useDeviceContactAvatarMap();

  const routeDate = route.params?.date;
  const routeContact = route.params?.contact;
  const routeMomentRequestId = route.params?.momentRequestId;
  const routeBookingUserId = route.params?.bookingUserId;

  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => {
    if (routeDate) {
      const [year, month, day] = routeDate.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  });
  const [selectedEvent, setSelectedEvent] = useState<CalendarItem | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPricing, setEditPricing] = useState<'paid' | 'free'>('free');
  const [invitees, setInvitees] = useState<Person[]>([]);
  const [inviteeSearch, setInviteeSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [removeInvitee, setRemoveInvitee] = useState<Person | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<Date | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [successToast, setSuccessToast] = useState<{ title: string; subtitle: string } | null>(
    null
  );
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [myAvailability, setMyAvailability] = useState<AvailabilitySchedule | null>(null);

  const handledMomentRequestIdRef = useRef<string | null>(null);
  const timelineScrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const navigateDayRef = useRef<(dir: number) => void>(() => {});
  // Separate from navigateDayRef since months step by a fixed count (2, to
  // match the existing 2-months-at-once display) via calendar-month
  // arithmetic on monthOffset, not day arithmetic on selectedDate — but
  // reuses the same `slideAnim` for the slide transition since only one view
  // renders at a time, so there's no conflict.
  const navigateMonthRef = useRef<(dir: number) => void>(() => {});
  // Frozen at mount so the agenda's first paint already lands on "now" —
  // passed as the ScrollView's `contentOffset`, which (unlike scrollTo) applies
  // before the first frame is shown, so there's no visible jump from the top
  // of the day down to the current time.
  const initialTimelineScrollY = useRef(
    Math.max(0, v(10) + ((new Date().getHours() * 60 + new Date().getMinutes()) / 60) * HOUR_HEIGHT - v(160))
  ).current;

  // Keep navigateDayRef current every render so the PanResponder closure always
  // sees fresh state. `direction` is always ±1 from the swipe gesture; the
  // actual date step (1 day in Day view, 7 in Week view) is resolved here from
  // the current viewMode so both views can share one pager/PanResponder.
  navigateDayRef.current = (direction: number) => {
    const stepDays = viewMode === 'week' ? 7 : 1;
    const w = Dimensions.get('window').width;
    Animated.timing(slideAnim, {
      toValue: -direction * w,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + direction * stepDays);
        return next;
      });
      slideAnim.setValue(direction * w);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
  };

  // Months page vertically (swipe up = next month, down = previous — same
  // sense as scrolling a list forward/back reveals later/earlier content),
  // one month at a time, driven by the same slideAnim value Day/Week use for
  // translateX — reused here as translateY since only one view is ever
  // mounted at once, so there's no conflict.
  navigateMonthRef.current = (direction: number) => {
    const hgt = Dimensions.get('window').height;
    Animated.timing(slideAnim, {
      toValue: -direction * hgt,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setMonthOffset((prev) => prev + direction);
      slideAnim.setValue(direction * hgt);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    });
  };

  const agendaPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_, gs) => {
        slideAnim.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        const w = Dimensions.get('window').width;
        if (gs.dx < -(w * 0.2) || gs.vx < -0.4) {
          navigateDayRef.current(1);
        } else if (gs.dx > w * 0.2 || gs.vx > 0.4) {
          navigateDayRef.current(-1);
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        slideAnim.setValue(0);
      },
    })
  ).current;

  const geocodeLocation = useCallback(async (locationName: string) => {
    if (!locationName.trim()) { setMapCoords(null); return; }
    try {
      setGeocoding(true);
      const results = await ExpoLocation.geocodeAsync(locationName);
      if (results.length > 0) {
        setMapCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
      }
    } catch {
      // geocode failed silently
    } finally {
      setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (loading || (viewMode !== 'day' && viewMode !== 'week')) return;
    if (routeMomentRequestId) return; // meeting deep-link — let that effect scroll instead
    if (!isSameDay(selectedDate, new Date())) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = v(10) + (minutes / 60) * HOUR_HEIGHT;
    const scrollY = Math.max(0, top - v(160));
    // The initial mount already lands here via the ScrollView's `contentOffset`
    // (see initialTimelineScrollY) — this only needs to react to genuine
    // changes afterward (e.g. swiping back to today), so a single animation
    // frame is enough for the new layout to be ready, no arbitrary wait.
    const frame = requestAnimationFrame(() => {
      timelineScrollRef.current?.scrollTo({ y: scrollY, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedDate, loading, viewMode, routeMomentRequestId]);

  const monthViewBase = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  // Mirrors agendaPanResponder's shape (live drag-follow + threshold-based
  // release + spring-back) so swiping Month view feels the same as Day/Week.
  const monthPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Vertical instead of Day/Week's horizontal — otherwise identical
      // shape (live drag-follow, threshold-based release, spring-back).
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 12 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => {
        slideAnim.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        const hgt = Dimensions.get('window').height;
        if (gs.dy < -(hgt * 0.2) || gs.vy < -0.4) {
          navigateMonthRef.current(1);
        } else if (gs.dy > hgt * 0.2 || gs.vy > 0.4) {
          navigateMonthRef.current(-1);
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        slideAnim.setValue(0);
      },
    })
  ).current;

  // showSpinner=false is for socket-driven background refreshes (a new/
  // updated meeting arrived) — the data still gets refetched fully, it just
  // doesn't flip the full-screen loading state, so the event list updates
  // in place once the fetch resolves instead of flashing a spinner over
  // whatever the user is currently looking at.
  const loadCalendarData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const [integrationsResponse, receivedResponse, sentResponse, contactsResponse, availabilityResponse] =
        await Promise.all([
          http.get('/users/calendar-integrations'),
          http.get('/users/moment-requests/received'),
          http.get('/users/moment-requests/sent'),
          http.get('/users/contacts'),
          http.get('/users/availability'),
        ]);

      if (availabilityResponse.data) {
        setMyAvailability(availabilityResponse.data);
      }

      const loadedIntegrations = integrationsResponse.data.integrations || [];
      const received = Array.isArray(receivedResponse.data.requests)
        ? receivedResponse.data.requests
        : [];
      const sent = Array.isArray(sentResponse.data.requests) ? sentResponse.data.requests : [];
      const loadedContacts = Array.isArray(contactsResponse.data.contacts)
        ? contactsResponse.data.contacts
        : [];

      setIntegrations(loadedIntegrations);
      setContacts(loadedContacts);

      // Fetch a broad range so date changes don't trigger reloads
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setMonth(end.getMonth() + 3);

      let externalEvents: CalendarItem[] = [];
      if (loadedIntegrations.some((integration: CalendarIntegration) => integration.connected)) {
        try {
          const externalResponse = await http.get('/users/calendar-events', {
            params: { start: start.toISOString(), end: end.toISOString() },
          });
          externalEvents = (externalResponse.data.events || []).map((event: CalendarItem) => ({
            ...event,
            sourceType: event.sourceType || 'external',
          }));
        } catch (error) {
          console.error('Error loading external calendar events:', error);
        }
      }

      const seen = new Set<string>();
      const internalEvents: CalendarItem[] = [...received, ...sent]
        .filter((request) => {
          if (seen.has(request.id)) return false;
          seen.add(request.id);
          // Matches Google Calendar convention: declining never removes the
          // event, it just marks it declined (muted/grey-bordered) for
          // everyone involved — sender included. Only an explicit
          // delete/cancel removes it from the calendar entirely.
          return request.status === 'approved' || request.status === 'pending' || request.status === 'rejected';
        })
        .map((request) => ({
          ...request,
          source: 'catch' as const,
          sourceType: 'internal' as const,
          title: cleanTitle(request.title),
          priceLabel: getPriceLabel(request),
        }));

      const allEvents = [...internalEvents, ...externalEvents];
      const dedupedEvents = allEvents.filter((e, idx) => allEvents.findIndex(x => x.id === e.id) === idx);
      setEvents(dedupedEvents);
    } catch (error) {
      console.error('Error loading calendar data:', error);
      setIntegrations([]);
      setEvents([]);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  useEffect(() => {
    if (routeDate) {
      const [year, month, day] = routeDate.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);
      if (newDate.getTime() !== selectedDate.getTime()) {
        setSelectedDate(newDate);
      }
    }
  }, [routeDate]);

  useEffect(() => {
    if (sheet === 'location' && editLocation) {
      geocodeLocation(editLocation);
    }
  }, [sheet]);

  useEffect(() => {
    if (routeContact) {
      const contactEvent = events.find(
        (e) =>
          e.sourceType === 'internal' &&
          (e.senderId === routeContact.contactUser?.id ||
            e.receiverId === routeContact.contactUser?.id)
      );
      if (contactEvent) {
        setSelectedEvent(contactEvent);
        setSheet('details');
      }
    }
  }, [routeContact, events]);

  useEffect(() => {
    const fetchBookableUser = async () => {
      if (!routeBookingUserId || routeContact) return;
      try {
        const response = await http.get(`/users/bookable/${routeBookingUserId}`);
        const bookableUser: BookableUserResponse = response.data.user;
        const pseudoContact: Contact = {
          id: `bookable-${bookableUser.id}`,
          displayName: bookableUser.displayName,
          avatar: bookableUser.avatar || undefined,
          contactUser: {
            id: bookableUser.id,
            name: bookableUser.displayName,
            avatar: bookableUser.avatar || undefined,
          },
        };
        setContacts((prev) => {
          if (prev.some((c) => c.id === pseudoContact.id)) return prev;
          return [pseudoContact, ...prev];
        });
      } catch (error: any) {
        console.error('Error loading bookable user:', error);
        Alert.alert('Error', error.response?.data?.error || 'Unable to open this booking profile.');
      }
    };
    fetchBookableUser();
  }, [routeBookingUserId, routeContact]);

  useEffect(() => {
    if (
      routeMomentRequestId &&
      events.length > 0 &&
      handledMomentRequestIdRef.current !== routeMomentRequestId
    ) {
      const matchingEvent = events.find((e) => e.id === routeMomentRequestId);
      if (matchingEvent) {
        handledMomentRequestIdRef.current = routeMomentRequestId;
        const eventDate = new Date(matchingEvent.startTime);
        setSelectedDate(eventDate);
        setSelectedEvent(matchingEvent);
        setSheet('details');
        const eventMinutes = eventDate.getHours() * 60 + eventDate.getMinutes();
        const scrollY = Math.max(0, v(10) + (eventMinutes / 60) * HOUR_HEIGHT - v(160));
        // setSelectedDate above triggers a re-render of the agenda for the
        // event's day; wait two frames so that's committed and laid out
        // before scrolling, instead of a guessed fixed delay.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            timelineScrollRef.current?.scrollTo({ y: scrollY, animated: false });
          });
        });
      }
    }
  }, [routeMomentRequestId, events]);

  // Silent — the user is coming back to a screen that already has (maybe
  // slightly stale) data; this just seamlessly syncs it rather than
  // flashing a spinner every time they switch tabs back to Calendar.
  useFocusEffect(
    useCallback(() => {
      loadCalendarData(false);
      http.get('/users/notifications').then((res) => {
        const notifs = res.data.notifications || [];
        setUnreadNotifCount(notifs.filter((n: any) => !n.isRead).length);
      }).catch(() => {});
    }, [loadCalendarData])
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      const eventType = data.eventType || data.type;
      if (
        eventType === 'moment.request.approved' ||
        eventType === 'moment.request.rejected' ||
        eventType === 'moment.request.created' ||
        eventType === 'moment.request.canceled'
      ) {
        setTimeout(() => loadCalendarData(false), 1000);
      }
    });
    return () => subscription.remove();
  }, [loadCalendarData]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let isMounted = true;

    const setupSocketListeners = async () => {
      if (!isMounted) return;
      let socket = getSocket();
      if (!socket) {
        socket = await initializeSocket();
        if (!socket || !isMounted) return;
      }

      const setupOnConnect = () => {
        if (!isMounted) return;
        const currentSocket = getSocket();
        if (!currentSocket?.connected) return;
        if (cleanup) cleanup();

        // Background refresh, not a full reload with a spinner — a new/
        // updated meeting should just appear once the refetch resolves,
        // the same way Google Calendar's live sync never interrupts
        // whatever the user is currently looking at. Deferred past any
        // in-progress navigation/transition for the same reason as
        // HomePageScreen's socket handlers (auto-confirm can make an
        // "approved" event arrive essentially instantly, sometimes right
        // as this screen is still transitioning in) — a plain setTimeout(0)
        // is what actually avoids react-native-screens' "useInsertionEffect
        // must not schedule updates" warning here, not InteractionManager
        // (which only tracks JS-driven interactions, not native transitions).
        cleanup = setupSocketEventListeners({
          onMomentRequest: () => {
            setTimeout(() => loadCalendarData(false), 0);
          },
          onMomentResponse: () => {
            setTimeout(() => loadCalendarData(false), 1000);
          },
          onMomentCanceled: () => {
            setTimeout(() => loadCalendarData(false), 1000);
          },
        });
      };

      if (socket.connected) {
        setupOnConnect();
      } else {
        socket.once('connect', setupOnConnect);
      }
      socket.on('reconnect', setupOnConnect);
    };

    setupSocketListeners();

    return () => {
      isMounted = false;
      if (cleanup) cleanup();
    };
  }, [loadCalendarData]);

  const selectedDayEvents = useMemo(() => {
    const seen = new Set<string>();
    return events
      .filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return isSameDay(new Date(event.startTime), selectedDate);
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, selectedDate]);

  const weekDays = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const weekEventsByDay = useMemo(() => {
    const seen = new Set<string>();
    const map = new Map<string, CalendarItem[]>();
    for (const day of weekDays) map.set(dayKey(day), []);
    for (const event of events) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      const key = dayKey(new Date(event.startTime));
      map.get(key)?.push(event);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [events, weekDays]);

  const openEventDetails = (event: CalendarItem) => {
    setSelectedEvent(event);
    setEditName(cleanTitle(event.title));
    setEditLocation(event.locationLabel || event.locationAddress || '');
    setEditPricing(event.priceLabel && event.priceLabel !== 'Free' ? 'paid' : 'free');
    setInvitees(getEventPeople(event));
    setSheet('details');
  };

  const saveEdit = () => {
    if (!selectedEvent) return;
    const nextPriceLabel =
      editPricing === 'free'
        ? 'Free'
        : selectedEvent.priceLabel && selectedEvent.priceLabel !== 'Free'
          ? selectedEvent.priceLabel
          : 'Paid';
    setEvents((prev) =>
      prev.map((event) =>
        event.id === selectedEvent.id
          ? {
              ...event,
              title: editName,
              locationLabel: editLocation,
              priceLabel: nextPriceLabel,
            }
          : event
      )
    );
    setSelectedEvent((prev) =>
      prev
        ? {
            ...prev,
            title: editName,
            locationLabel: editLocation,
            priceLabel: nextPriceLabel,
          }
        : prev
    );
    setSheet('details');
  };

  const openTimeSheet = () => {
    setRescheduleTime(null);
    setSheet('time');
  };

  const showSuccessToast = (title: string, subtitle: string) => {
    setSuccessToast({ title, subtitle });
    setTimeout(() => setSuccessToast(null), 2600);
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;
    try {
      if (selectedEvent.sourceType === 'internal') {
        await http.delete(`/users/moment-requests/${selectedEvent.id}`);
      }
      setEvents((prev) => prev.filter((event) => event.id !== selectedEvent.id));
      setDeleteConfirm(false);
      setSheet(null);
      setSelectedEvent(null);
    } catch (error: any) {
      console.error('Error deleting event:', error);
      Alert.alert('Delete failed', error.response?.data?.error || 'Failed to delete event.');
    }
  };

  const [respondingToEvent, setRespondingToEvent] = useState(false);

  const respondToRequest = async (approved: boolean) => {
    if (!selectedEvent) return;
    try {
      setRespondingToEvent(true);
      await http.post(`/users/moment-requests/${selectedEvent.id}/respond`, { approved });
      setSheet(null);
      setSelectedEvent(null);
      // Silent — the Confirm/Decline button already shows its own inline
      // spinner via respondingToEvent, no need to also flash the full-screen
      // loading state on top of that.
      await loadCalendarData(false);
      showSuccessToast(
        approved ? 'Meeting confirmed' : 'Meeting declined',
        approved
          ? `${formatToastDate(new Date(selectedEvent.startTime))}, ${formatTime(new Date(selectedEvent.startTime))}`
          : cleanTitle(selectedEvent.title)
      );
    } catch (error: any) {
      console.error('Error responding to moment request:', error);
      Alert.alert(
        'Something went wrong',
        error.response?.data?.error || 'Could not respond to this meeting request.'
      );
    } finally {
      setRespondingToEvent(false);
    }
  };

  const rescheduleEvent = async () => {
    if (!selectedEvent || !rescheduleTime) return;

    if (selectedEvent.sourceType === 'internal' && selectedEvent.senderId !== user.id) {
      Alert.alert(
        'Cannot reschedule',
        'Only the person who sent this meeting request can propose a new time. Contact the organizer to reschedule.'
      );
      return;
    }

    const end = new Date(rescheduleTime.getTime() + getDurationMinutes(selectedEvent) * 60 * 1000);
    const updatedEvent = {
      ...selectedEvent,
      startTime: rescheduleTime.toISOString(),
      endTime: end.toISOString(),
    };
    try {
      if (selectedEvent.sourceType === 'internal' && selectedEvent.status === 'pending') {
        await http.post(`/users/moment-requests/${selectedEvent.id}/reschedule`, {
          startTime: rescheduleTime.toISOString(),
          endTime: end.toISOString(),
          note: selectedEvent.title,
        });
        await loadCalendarData();
      } else {
        setEvents((prev) =>
          prev.map((event) => (event.id === selectedEvent.id ? updatedEvent : event))
        );
      }
      setSelectedEvent(updatedEvent);
      setSheet(null);
      showSuccessToast(
        'Meeting rescheduled successfully',
        `${formatToastDate(rescheduleTime)}, ${formatTime(rescheduleTime)} • ${getLocationText(updatedEvent)}`
      );
    } catch (error: any) {
      console.error('Error rescheduling event:', error);
      const status = error.response?.status;
      let message = 'Something went wrong. Please try again.';
      if (status === 403 || status === 401) {
        message = 'Only the meeting organizer can reschedule this meeting.';
      } else if (status === 404) {
        message = 'This meeting could not be found. It may have already been cancelled.';
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      Alert.alert('Could not reschedule', message);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Header
          title="Calendar"
          onBell={() => navigation.navigate('AppStack_NotificationScreen')}
          insetsTop={insets.top}
          badgeCount={unreadNotifCount}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.green} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.calendarHeader, { paddingTop: Math.max(insets.top + v(28), v(58)) }]}>
        <View style={styles.monthTitleWrap}>
          <Text style={styles.monthTitle}>
            {viewMode === 'day'
              ? formatDayTitle(selectedDate)
              : viewMode === 'week'
                ? formatWeekRangeTitle(weekDays)
                : viewMode === 'year'
                  ? String(selectedDate.getFullYear())
                  : formatSingleMonth(monthViewBase)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('AppStack_NotificationScreen')}
          style={{ position: 'relative' }}>
          <View
            style={{
              width: h(40),
              height: h(40),
              borderRadius: h(20),
              backgroundColor: COLORS.white,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Image source={NotificationsIcon} style={styles.notificationIcon} />
          </View>
          {unreadNotifCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: h(18),
                height: h(18),
                borderRadius: h(9),
                backgroundColor: COLORS.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: COLORS.white, fontSize: ms(10), fontFamily: 'AssociateSansBold' }}>
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.viewSwitcherRow}>
        <ViewSwitcher active={viewMode} onChange={setViewMode} />
      </View>

      {viewMode === 'day'
        ? renderAgendaView()
        : viewMode === 'week'
          ? renderWeekView()
          : viewMode === 'month'
            ? renderMonthView()
            : renderYearView()}
      {renderSheetModal()}
      {renderSuccessToast()}
    </View>
  );

  function renderSuccessToast() {
    if (!successToast) return null;
    return (
      <View style={[styles.successToast, { bottom: Math.max(insets.bottom + v(16), v(24)) }]}>
        <View style={styles.successIcon}>
          <Image source={CheckIcon} style={{ width: v(22), height: v(22) }} tintColor={COLORS.white} />
        </View>
        <View style={styles.successTextWrap}>
          <Text style={styles.successTitle}>{successToast.title}</Text>
          <Text style={styles.successSubtitle}>{successToast.subtitle}</Text>
        </View>
      </View>
    );
  }

  function renderAgendaView() {
    const isToday = isSameDay(selectedDate, new Date());
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const nowTop = v(10) + (nowMinutes / 60) * HOUR_HEIGHT;
    const unavailBands = getUnavailableBands(myAvailability, selectedDate.getDay());

    return (
      <View style={styles.content} {...agendaPanResponder.panHandlers}>
        <WeekRail selectedDate={selectedDate} onSelect={setSelectedDate} />
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          ref={timelineScrollRef}
          contentContainerStyle={{ paddingBottom: v(140) }}
          contentOffset={{ x: 0, y: initialTimelineScrollY }}>
        <View style={styles.timeline}>
          {/* Unavailable bands — rendered first so they sit behind everything */}
          {unavailBands.map((band, idx) => (
            <View
              key={`unavail-${idx}`}
              pointerEvents="none"
              style={[styles.unavailBand, { top: band.top, height: band.height }]}
            />
          ))}
          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
            <View key={hour} style={styles.timelineRow}>
              <Text style={styles.hourText}>{formatHour(hour)}</Text>
              <View style={styles.hourLine} />
            </View>
          ))}
          {isToday && (
            <View pointerEvents="none" style={[styles.currentTimeLine, { top: nowTop }]}>
              <View style={styles.currentTimeDot} />
              <View style={styles.currentTimeBar} />
            </View>
          )}
          {layoutEventsForDay(selectedDayEvents).map((event) => {
            const durationMins = getDurationMinutes(event);
            // Tiers are pixel budgets (TINY_EVENT_PX/COMPACT_EVENT_PX), converted
            // to minutes at the current HOUR_HEIGHT — so they stay correctly
            // proportioned if the density constant ever changes again.
            const isTiny = durationMins < minutesForPx(TINY_EVENT_PX);
            const isCompact = !isTiny && durationMins < minutesForPx(COMPACT_EVENT_PX);
            const priceLabel = getPriceLabel(event);
            const providerKey =
              event.source === 'catch' ? 'catch'
              : event.source === 'microsoft' ? 'microsoft'
              : event.source === 'icloud' ? 'icloud'
              : 'google';
            const pos = getEventPosition(event);
            const widthPct = 100 / event.totalColumns;
            const leftPct = event.column * widthPct;
            const hasOverlap = event.totalColumns > 1;
            // Padding shrinks first (down to a minimum), then font size, so a
            // squeezed meeting reads as "normal text, tighter padding" rather
            // than "tiny unreadable text in a roomy box." Font never exceeds
            // the tier's normal/default size.
            const tinyPadding = fitEventPadding(pos.height, v(3), v(1));
            const tinyFont = fitEventFontSize(pos.height - tinyPadding * 2, 1, ms(10));

            const compactPadding = fitEventPadding(pos.height, v(4), v(1.5));
            const compactAvailable = pos.height - compactPadding * 2;
            // If two stacked lines (title + price) genuinely can't fit even
            // at the minimum legible size, fall back to the single-row
            // layout instead of forcing an under-sized, still-clipped block.
            const compactTwoLineRawFont = compactAvailable / 2 / EVENT_LINE_HEIGHT_RATIO;
            const compactFitsTwoLines = compactTwoLineRawFont >= MIN_EVENT_FONT_PX;
            const compactTitleFont = fitEventFontSize(compactAvailable, 2, ms(12));
            const compactPriceFont = fitEventFontSize(compactAvailable, 2, ms(11));
            const compactSingleFont = fitEventFontSize(pos.height - tinyPadding * 2, 1, ms(11));

            const fullPadding = fitEventPadding(pos.height, h(10), h(4));
            const fullAvailable = pos.height - fullPadding * 2;
            const fullTitleFont = fitEventFontSize(fullAvailable, 2, ms(14));
            const fullTimeFont = fitEventFontSize(fullAvailable, 2, ms(12));

            const showSingleRow = isTiny || hasOverlap || (isCompact && !compactFitsTwoLines);
            const singleRowFont = isCompact ? compactSingleFont : tinyFont;
            // Only internal (Catch-created) events have a real pending/confirmed
            // lifecycle — external calendar events are already-confirmed by
            // definition on whatever calendar they came from.
            const isPending = event.sourceType === 'internal' && event.status === 'pending';
            const isDeclined = event.sourceType === 'internal' && event.status === 'rejected';
            const textColor = isPending ? COLORS.green : isDeclined ? COLORS.declinedText : '#759719';
            return (
              // Outer wrapper reserves the same top/height/gutter eventBlock
              // always used; the inner block is percentage-positioned within
              // it so overlapping events split side-by-side instead of
              // stacking directly on top of each other.
              <View
                key={event.id}
                pointerEvents="box-none"
                style={[styles.eventBlockPosition, { top: pos.top, height: pos.height }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.eventBlockVisual,
                    {
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${leftPct}%` as const,
                      width: `${widthPct}%` as const,
                    },
                    hasOverlap && { marginHorizontal: h(1.5) },
                    event.sourceType === 'external' && styles.externalEventBlock,
                    isPending && styles.pendingEventBlock,
                    isDeclined && styles.declinedEventBlock,
                    isTiny && styles.eventBlockTiny,
                    isCompact && styles.eventBlockCompact,
                    isTiny && { paddingVertical: tinyPadding },
                    isCompact && { paddingVertical: showSingleRow ? tinyPadding : compactPadding },
                    !isTiny && !isCompact && { paddingTop: fullPadding, paddingBottom: fullPadding },
                  ]}
                  onPress={() => openEventDetails(event)}>
                  {showSingleRow ? (
                    // Single horizontal row: agenda · cost (also used for any
                    // overlapping event, or a compact-tier event too short
                    // for its normal 2-line layout — there isn't enough
                    // height/width to show more than one line legibly).
                    <View style={styles.eventTinyRow}>
                      <Text
                        style={[styles.eventTinyTitle, { fontSize: singleRowFont, color: textColor }]}
                        numberOfLines={1}>
                        {cleanTitle(event.title)}
                      </Text>
                      {!hasOverlap && (
                        <Text style={[styles.eventTinyPrice, { fontSize: singleRowFont, color: textColor }]}>
                          {priceLabel}
                        </Text>
                      )}
                    </View>
                  ) : isCompact ? (
                    // Two compact rows: title then price
                    <>
                      <Text
                        style={[styles.eventCompactTitle, { fontSize: compactTitleFont, color: textColor }]}
                        numberOfLines={1}>
                        {cleanTitle(event.title)}
                      </Text>
                      <Text style={[styles.eventCompactPrice, { fontSize: compactPriceFont, color: textColor }]}>
                        {priceLabel}
                      </Text>
                    </>
                  ) : (
                    // Full layout
                    <>
                      <Text
                        style={[styles.eventTitle, { fontSize: fullTitleFont, color: textColor }]}
                        numberOfLines={1}>
                        {cleanTitle(event.title)}
                      </Text>
                      <Text style={[styles.eventTime, { fontSize: fullTimeFont, color: textColor }]} numberOfLines={1}>
                        {formatTime(new Date(event.startTime))} - {formatTime(new Date(event.endTime))}
                      </Text>
                      <Text style={[styles.eventPrice, { color: textColor }]}>{priceLabel}</Text>
                      <View style={styles.eventProvider}>
                        <ProviderIcon provider={providerKey} size={20} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
        </ScrollView>
        </Animated.View>
      </View>
    );
  }

  function renderWeekView() {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowTop = v(10) + (nowMinutes / 60) * HOUR_HEIGHT;
    const hasAnyAllDay = weekDays.some((day) =>
      (weekEventsByDay.get(dayKey(day)) || []).some((e) => e.allDay)
    );

    return (
      <View style={styles.content} {...agendaPanResponder.panHandlers}>
        <View style={styles.weekGridHeaderRow}>
          <View style={{ width: h(36) }} />
          {weekDays.map((day) => {
            const active = isSameDay(day, selectedDate);
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={styles.weekGridHeaderCell}
                onPress={() => setSelectedDate(day)}>
                <Text style={styles.weekGridDayName}>{formatDayName(day)}</Text>
                <View style={[styles.weekGridDayNumber, active && styles.weekGridDayNumberActive]}>
                  <Text style={[styles.weekGridDayText, active && styles.weekGridDayTextActive]}>
                    {day.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {hasAnyAllDay && (
          <View style={styles.weekAllDayRow}>
            <View style={{ width: h(36) }} />
            {weekDays.map((day) => {
              const allDayEvents = (weekEventsByDay.get(dayKey(day)) || []).filter((e) => e.allDay);
              const visible = allDayEvents.slice(0, 2);
              const overflow = allDayEvents.length - visible.length;
              return (
                <View key={day.toISOString()} style={styles.weekAllDayCell}>
                  {visible.map((event) => (
                    <View key={event.id} style={styles.weekAllDayChip}>
                      <Text style={styles.weekAllDayChipText} numberOfLines={1}>
                        {cleanTitle(event.title)}
                      </Text>
                    </View>
                  ))}
                  {overflow > 0 && <Text style={styles.weekAllDayMore}>+{overflow}</Text>}
                </View>
              );
            })}
          </View>
        )}

        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          <ScrollView
            ref={timelineScrollRef}
            contentContainerStyle={{ paddingBottom: v(140) }}
            contentOffset={{ x: 0, y: initialTimelineScrollY }}>
            <View style={styles.weekTimeline}>
              {/* Hour grid background — labels + horizontal lines, spans the full width */}
              {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                <View key={hour} style={styles.weekHourRow}>
                  <Text style={styles.weekHourText}>{formatHourShort(hour)}</Text>
                  <View style={styles.weekHourLine} />
                </View>
              ))}

              {/* Day columns — laid on top of the grid, in normal flow so each
                  column's own width is available for percentage-positioned
                  events (avoids needing manual pixel/Dimensions math). */}
              <View style={styles.weekColumnsRow} pointerEvents="box-none">
                <View style={{ width: h(36) }} />
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = (weekEventsByDay.get(dayKey(day)) || []).filter((e) => !e.allDay);
                  const laidOut = layoutEventsForDay(dayEvents);
                  const isTodayColumn = isSameDay(day, new Date());
                  return (
                    <View
                      key={day.toISOString()}
                      style={[styles.weekDayColumn, dayIndex > 0 && styles.weekDayColumnBorder]}
                      pointerEvents="box-none">
                      {isTodayColumn && (
                        <View pointerEvents="none" style={[styles.weekNowLine, { top: nowTop }]}>
                          <View style={styles.weekNowDot} />
                          <View style={styles.weekNowBar} />
                        </View>
                      )}
                      {laidOut.map((event) => {
                        const pos = getEventPosition(event);
                        const widthPct = 100 / event.totalColumns;
                        const leftPct = event.column * widthPct;
                        const titleFont = fitEventFontSize(pos.height - v(1) * 2, 1, ms(11));
                        const isPending = event.sourceType === 'internal' && event.status === 'pending';
                        const isDeclined = event.sourceType === 'internal' && event.status === 'rejected';
                        return (
                          <TouchableOpacity
                            key={event.id}
                            activeOpacity={0.85}
                            style={[
                              styles.weekEventBlock,
                              event.sourceType === 'external' && styles.externalEventBlock,
                              isPending && styles.weekEventBlockPending,
                              isDeclined && styles.weekEventBlockDeclined,
                              {
                                top: pos.top,
                                height: pos.height,
                                left: `${leftPct}%` as const,
                                width: `${widthPct}%` as const,
                              },
                            ]}
                            onPress={() => openEventDetails(event)}>
                            <Text
                              style={[
                                styles.weekEventTitle,
                                event.sourceType === 'external' && styles.weekEventTitleExternal,
                                isPending && styles.weekEventTitlePending,
                                isDeclined && styles.weekEventTitleDeclined,
                                { fontSize: titleFont },
                              ]}
                              numberOfLines={1}>
                              {cleanTitle(event.title)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    );
  }

  function renderMonthView() {
    return (
      <View style={styles.monthViewContainer} {...monthPanResponder.panHandlers}>
        {/* Drag/swipe up or down anywhere to move to the next/previous month
            — no chevron buttons; vertical drag is the only navigation here
            (distinct from Day/Week's horizontal paging), so one month is
            shown at a time rather than two, which also means it always fits
            on screen without needing its own scroll view. */}
        <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }}>
          <MonthAgendaGrid
            monthDate={monthViewBase}
            events={events}
            selectedDate={selectedDate}
            onSelectDay={(day) => {
              setSelectedDate(day);
              setViewMode('day');
            }}
            onSelectEvent={openEventDetails}
          />
        </Animated.View>
      </View>
    );
  }

  // Placeholder for Phase 1: a plain scrollable 12-month grid (no event
  // dots/indicators yet — that needs the fetch window widened and a
  // FlatList-virtualized layout, both deferred to a later phase). Still
  // fully functional: tapping a day jumps to Day view, matching the same
  // "tap to drill in" precedent Month view already uses.
  function renderYearView() {
    const year = selectedDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.yearGrid}>
        <View style={styles.yearNavRow}>
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setSelectedDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1))}>
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setSelectedDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1))}>
            <Text style={styles.monthNavText}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.yearMonthsWrap}>
          {months.map((monthDate) => (
            // Just the grid itself (no outer touchable wrapper) — MonthGrid's
            // own day cells are already tappable, and wrapping the whole thing
            // in another TouchableOpacity would compete with those taps for
            // "jump to month view" vs. "jump to day view" on the same tap.
            <View key={monthDate.toISOString()} style={styles.yearMonthCell}>
              <MonthGrid
                monthDate={monthDate}
                selectedDate={selectedDate}
                onSelect={(day) => {
                  setSelectedDate(day);
                  setViewMode('day');
                }}
                compact
              />
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // All event-related sheets (details/edit/time/location/invitees) plus the
  // delete/remove-invitee confirmation dialogs share a SINGLE <Modal> here,
  // switching only the JSX content based on `sheet`. Previously each had its
  // own <Modal>, so transitioning between them (e.g. tapping "Meeting time"
  // inside the edit sheet) meant one native Modal unmounting at the exact
  // moment another mounted — iOS's modal presentation stack doesn't handle
  // that overlap cleanly and could leave the whole screen touch-unresponsive
  // after dismissing (Android tolerates it, which is why this only showed up
  // on iOS). Keeping one persistent Modal instance and only swapping its
  // children avoids that native transition entirely.
  function renderSheetModal() {
    if (!sheet) return null;
    const onRequestClose = () => {
      if (sheet === 'details') setSheet(null);
      else if (sheet === 'edit') setSheet('details');
      else setSheet('edit'); // time | location | invitees
    };
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onRequestClose}>
        <View style={{ flex: 1 }}>
          {sheet === 'details' && renderDetailsContent()}
          {sheet === 'edit' && renderEditContent()}
          {sheet === 'time' && renderTimeContent()}
          {sheet === 'location' && renderLocationContent()}
          {sheet === 'invitees' && renderInviteesContent()}
          {deleteConfirm && renderDeleteDialogOverlay()}
          {removeInvitee && renderRemoveInviteeDialogOverlay()}
        </View>
      </Modal>
    );
  }

  function renderDetailsContent() {
    if (!selectedEvent) return null;
    const people = invitees.length ? invitees : getEventPeople(selectedEvent);
    return (
      <View style={styles.modalRoot}>
        <BlurView intensity={10} tint="dark" style={styles.backdrop}>
          <View style={styles.dim} />
        </BlurView>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet(null)} />
        <View
          style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom + v(20), v(30)) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Meeting details</Text>
            <TouchableOpacity onPress={() => setSheet('edit')}>
              <MiniIcon type="edit" color={COLORS.muted} size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.detailTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: h(8) }}>
              <ProviderIcon
                provider={
                  selectedEvent.source === 'catch'
                    ? 'catch'
                    : selectedEvent.source === 'microsoft'
                      ? 'microsoft'
                      : selectedEvent.source === 'icloud'
                        ? 'icloud'
                        : 'google'
                }
                size={18}
              />
              <Text style={[styles.detailEventName, { marginLeft: h(7), flex: 1 }]} numberOfLines={2}>
                {cleanTitle(selectedEvent.title)}
              </Text>
            </View>
            <View style={styles.badges}>
              <Text style={[
                styles.confirmBadge,
                selectedEvent.status === 'pending' && { backgroundColor: '#FFF3CD', color: '#856404' },
                selectedEvent.status === 'rejected' && { backgroundColor: COLORS.softLine, color: COLORS.declinedText },
              ]}>
                {selectedEvent.status === 'approved'
                  ? 'Confirmed'
                  : selectedEvent.status === 'pending'
                    ? 'Pending'
                    : selectedEvent.status === 'rejected'
                      ? 'Declined'
                      : 'External'}
              </Text>
              <Text style={styles.freeBadge}>{getPriceLabel(selectedEvent)}</Text>
            </View>
          </View>
          <DetailRow
            icon="clock"
            label="Meeting time:"
            value={`${formatDisplayDate(new Date(selectedEvent.startTime))} - ${formatTime(new Date(selectedEvent.endTime))}`}
          />
          <DetailRow
            icon="pin"
            label="Location:"
            value={selectedEvent.locationLabel || 'Remote'}
          />
          <DetailRow
            icon="host"
            label="Host"
            value={
              selectedEvent.senderId === user.id ? 'You' : selectedEvent.sender?.name || 'Host'
            }
          />
          {selectedEvent.sourceType === 'internal' &&
            selectedEvent.status === 'pending' &&
            selectedEvent.receiverId === user.id && (
              <View style={styles.respondRow}>
                <TouchableOpacity
                  style={styles.declineButton}
                  disabled={respondingToEvent}
                  onPress={() => respondToRequest(false)}>
                  <Text style={styles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButton}
                  disabled={respondingToEvent}
                  onPress={() => respondToRequest(true)}>
                  {respondingToEvent ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          <Text style={styles.inviteesTitle}>Invitees</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.peopleRail}>
            {people.map((person) => (
              <PersonBubble key={person.id} person={person} selectable />
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.foodCard}>
            <View style={styles.foodIcon}>
              <MiniIcon type="food" color={COLORS.muted} size={20} />
            </View>
            <View style={styles.foodTextWrap}>
              <Text style={styles.foodTitle}>Need a Bite?</Text>
              <Text style={styles.foodText}>Get your favorite meal delivered in minutes.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderEditContent() {
    if (!selectedEvent) return null;
    return (
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BlurView intensity={10} tint="dark" style={styles.backdrop}>
          <View style={styles.dim} />
        </BlurView>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet('details')} />
        {/* maxHeight lives on this plain View (not the ScrollView itself) —
            a ScrollView styled directly with a percentage maxHeight tends to
            claim that full height even when its content is much shorter,
            which is what left "Delete Event" stranded with a large empty
            gap below it. A View reliably shrink-wraps to its content (this
            is exactly how the sibling "Meeting details" sheet, which uses a
            plain View, already sizes correctly), so nesting the ScrollView
            inside one fixes the sizing without changing the field order. */}
        <View style={styles.editSheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + v(22), v(34)) }}>
            <View style={styles.sheetHandle} />
            <SheetTop
              title="Customize event"
              onBack={() => setSheet('details')}
              onSave={saveEdit}
            />
            <InputGroup
              label="Name"
              value={editName}
              onChangeText={setEditName}
              autoFocus={false}
            />
            <FieldButton
              label="Meeting time"
              value={`${formatDisplayDate(new Date(selectedEvent.startTime))} - ${formatTime(new Date(selectedEvent.endTime))}`}
              onPress={openTimeSheet}
              icon="clock"
            />
            <FieldButton
              label="Location"
              value={editLocation}
              onPress={() => setSheet('location')}
              icon="pin"
            />
            <Text style={styles.fieldLabel}>Invitees</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.peopleRail}>
              <TouchableOpacity
                style={styles.addInviteeBubble}
                onPress={() => setSheet('invitees')}>
                <Text style={styles.addInviteePlus}>+</Text>
                <Text style={styles.addInviteeText}>Add</Text>
              </TouchableOpacity>
              {invitees.map((person) => (
                <PersonBubble
                  key={person.id}
                  person={person}
                  removable
                  onRemove={() => setRemoveInvitee(person)}
                />
              ))}
            </ScrollView>
            <View style={styles.pricingRow}>
              <Text style={styles.fieldLabel}>Pricing</Text>
              <Segment active={editPricing} onChange={setEditPricing} />
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => setDeleteConfirm(true)}>
              <MiniIcon type="trash" color={COLORS.white} size={19} />
              <Text style={styles.deleteButtonText}>Delete Event</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  function renderTimeContent() {
    if (!selectedEvent) return null;
    const duration = getDurationMinutes(selectedEvent);

    const pickSlot = (slotMinutes: number) => {
      const d = new Date(selectedDate);
      d.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
      setRescheduleTime(d);
    };

    return (
        <View style={styles.fullSheet}>
          <View style={styles.sheetHandle} />
          <SheetTop title="Edit meeting time" onBack={() => setSheet('edit')} />
          <WeekRail selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setRescheduleTime(null); }} compact />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: v(220) }}>
          <View style={styles.timeline}>
            {/* Unavailable bands */}
            {getUnavailableBands(myAvailability, selectedDate.getDay()).map((band, idx) => (
              <View
                key={`unavail-${idx}`}
                pointerEvents="none"
                style={[styles.unavailBand, { top: band.top, height: band.height }]}
              />
            ))}
            {/* Hour row lines */}
            {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
              <View key={hour} style={styles.timelineRow}>
                <Text style={styles.hourText}>{formatHour(hour)}</Text>
                <View style={styles.hourLine} />
              </View>
            ))}

            {/* Tappable 15-min slots — behind event blocks */}
            {Array.from({ length: 96 }, (_, i) => {
              const slotMinutes = i * 15;
              const top = v(10) + (slotMinutes / 60) * HOUR_HEIGHT;
              return (
                <TouchableOpacity
                  key={`slot-${i}`}
                  activeOpacity={0.15}
                  style={{ position: 'absolute', left: h(65), right: 0, top, height: v(20) }}
                  onPress={() => pickSlot(slotMinutes)}
                />
              );
            })}

            {/* Existing events */}
            {selectedDayEvents
              .filter((e) => isSameDay(new Date(e.startTime), selectedDate))
              .map((event) => {
                const evDuration = getDurationMinutes(event);
                const evIsTiny = evDuration < minutesForPx(TINY_EVENT_PX);
                const evIsCompact = !evIsTiny && evDuration < minutesForPx(COMPACT_EVENT_PX);
                const priceLabel = getPriceLabel(event);
                const evPos = getEventPosition(event);
                const evTinyPadding = fitEventPadding(evPos.height, v(3), v(1));
                const evTinyFont = fitEventFontSize(evPos.height - evTinyPadding * 2, 1, ms(10));
                const evCompactPadding = fitEventPadding(evPos.height, v(4), v(1.5));
                const evCompactAvailable = evPos.height - evCompactPadding * 2;
                const evCompactFitsTwoLines = evCompactAvailable / 2 / EVENT_LINE_HEIGHT_RATIO >= MIN_EVENT_FONT_PX;
                const evCompactTitleFont = fitEventFontSize(evCompactAvailable, 2, ms(12));
                const evCompactPriceFont = fitEventFontSize(evCompactAvailable, 2, ms(11));
                const evCompactSingleFont = fitEventFontSize(evPos.height - evTinyPadding * 2, 1, ms(11));
                const evShowSingleRow = evIsTiny || (evIsCompact && !evCompactFitsTwoLines);
                const evSingleRowFont = evIsCompact ? evCompactSingleFont : evTinyFont;
                const evIsPending = event.sourceType === 'internal' && event.status === 'pending';
                const evTextColor = evIsPending ? COLORS.green : COLORS.white;
                return (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.85}
                    style={[
                      styles.eventBlockPosition,
                      styles.eventBlockVisual,
                      evIsTiny && styles.eventBlockTiny,
                      evIsCompact && styles.eventBlockCompact,
                      evPos,
                      evIsPending
                        ? { backgroundColor: 'transparent', borderColor: COLORS.green, borderWidth: 1.5 }
                        : { backgroundColor: COLORS.green, borderColor: COLORS.green },
                      evIsTiny && { paddingVertical: evTinyPadding },
                      evIsCompact && { paddingVertical: evShowSingleRow ? evTinyPadding : evCompactPadding },
                    ]}
                    onPress={() => setRescheduleTime(new Date(event.startTime))}>
                    {evShowSingleRow ? (
                      <View style={styles.eventTinyRow}>
                        <Text
                          style={[styles.eventTinyTitle, { color: evTextColor, fontSize: evSingleRowFont }]}
                          numberOfLines={1}>
                          {cleanTitle(event.title)}
                        </Text>
                        <Text style={[styles.eventTinyPrice, { color: evTextColor, fontSize: evSingleRowFont }]}>
                          {priceLabel}
                        </Text>
                      </View>
                    ) : evIsCompact ? (
                      <>
                        <Text
                          style={[styles.eventCompactTitle, { color: evTextColor, fontSize: evCompactTitleFont }]}
                          numberOfLines={1}>
                          {cleanTitle(event.title)}
                        </Text>
                        <Text style={[styles.eventCompactPrice, { color: evTextColor, fontSize: evCompactPriceFont }]}>
                          {priceLabel}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.rescheduleBlockTitle, { color: evTextColor }]} numberOfLines={1}>
                          {cleanTitle(event.title)}
                        </Text>
                        <Text style={[styles.rescheduleBlockTime, { color: evTextColor }]} numberOfLines={1}>
                          {formatTime(new Date(event.startTime))} - {formatTime(new Date(event.endTime))}
                        </Text>
                        <Text style={[styles.eventPrice, { color: evTextColor }]}>{priceLabel}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}

            {/* Selected reschedule block */}
            {rescheduleTime ? (() => {
              const endTime = new Date(rescheduleTime.getTime() + duration * 60 * 1000);
              const pos = getEventPosition({ startTime: rescheduleTime.toISOString(), endTime: endTime.toISOString() } as CalendarItem);
              const rIsTiny = duration < minutesForPx(TINY_EVENT_PX);
              const rIsCompact = !rIsTiny && duration < minutesForPx(COMPACT_EVENT_PX);
              const priceLabel = getPriceLabel(selectedEvent);
              const rTinyPadding = fitEventPadding(pos.height, v(3), v(1));
              const rTinyFont = fitEventFontSize(pos.height - rTinyPadding * 2, 1, ms(10));
              const rCompactPadding = fitEventPadding(pos.height, v(4), v(1.5));
              const rCompactAvailable = pos.height - rCompactPadding * 2;
              const rCompactFitsTwoLines = rCompactAvailable / 2 / EVENT_LINE_HEIGHT_RATIO >= MIN_EVENT_FONT_PX;
              const rCompactTitleFont = fitEventFontSize(rCompactAvailable, 2, ms(12));
              const rCompactPriceFont = fitEventFontSize(rCompactAvailable, 2, ms(11));
              const rCompactSingleFont = fitEventFontSize(pos.height - rTinyPadding * 2, 1, ms(11));
              const rShowSingleRow = rIsTiny || (rIsCompact && !rCompactFitsTwoLines);
              const rSingleRowFont = rIsCompact ? rCompactSingleFont : rTinyFont;
              return (
                <View
                  style={[
                    styles.eventBlockPosition,
                    styles.eventBlockVisual,
                    rIsTiny && styles.eventBlockTiny,
                    rIsCompact && styles.eventBlockCompact,
                    { top: pos.top, height: pos.height, backgroundColor: COLORS.green, borderColor: COLORS.green },
                    rIsTiny && { paddingVertical: rTinyPadding },
                    rIsCompact && { paddingVertical: rShowSingleRow ? rTinyPadding : rCompactPadding },
                  ]}>
                  {rShowSingleRow ? (
                    <View style={styles.eventTinyRow}>
                      <Text
                        style={[styles.eventTinyTitle, { color: COLORS.white, fontSize: rSingleRowFont }]}
                        numberOfLines={1}>
                        {cleanTitle(selectedEvent.title)}
                      </Text>
                      <Text style={[styles.eventTinyPrice, { color: COLORS.white, fontSize: rSingleRowFont }]}>
                        {priceLabel}
                      </Text>
                    </View>
                  ) : rIsCompact ? (
                    <>
                      <Text
                        style={[styles.eventCompactTitle, { color: COLORS.white, fontSize: rCompactTitleFont }]}
                        numberOfLines={1}>
                        {cleanTitle(selectedEvent.title)}
                      </Text>
                      <Text style={[styles.eventCompactPrice, { color: COLORS.white, fontSize: rCompactPriceFont }]}>
                        {priceLabel}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.rescheduleBlockTitle} numberOfLines={1}>
                        {cleanTitle(selectedEvent.title)}
                      </Text>
                      <Text style={styles.rescheduleBlockTime} numberOfLines={1}>
                        {formatTime(rescheduleTime)} - {formatTime(endTime)}
                      </Text>
                      <Text style={[styles.eventPrice, { color: COLORS.white }]}>{priceLabel}</Text>
                    </>
                  )}
                </View>
              );
            })() : null}
          </View>
          </ScrollView>
          <View style={styles.currentTimePanel}>
            <Text style={styles.currentTitle}>Current time</Text>
            <Text style={styles.currentText}>
              Select a new time slot to reschedule this meeting.
            </Text>
            <View style={styles.currentCard}>
              <Text style={styles.currentCardTitle}>{cleanTitle(selectedEvent.title)}</Text>
              <Text style={styles.currentCardTime}>
                {formatTime(new Date(selectedEvent.startTime))}-
                {formatTime(new Date(selectedEvent.endTime))}
              </Text>
              <Text style={styles.currentCardPrice}>{getPriceLabel(selectedEvent)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, !rescheduleTime && styles.disabledButton]}
              onPress={rescheduleEvent}
              disabled={!rescheduleTime}>
              <Text style={styles.primaryButtonText}>Reschedule</Text>
            </TouchableOpacity>
          </View>
        </View>
    );
  }

  function renderLocationContent() {
    const defaultRegion = {
      latitude: mapCoords?.latitude ?? 37.7749,
      longitude: mapCoords?.longitude ?? -122.4194,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    return (
        <View style={styles.fullSheet}>
          <View style={styles.sheetHandle} />
          <SheetTop
            title="Edit location"
            onBack={() => setSheet('edit')}
            onSave={() => setSheet('edit')}
          />
          <View style={styles.searchInputWrap}>
            <MiniIcon type="search" color={COLORS.ink} />
            <TextInput
              style={styles.searchInput}
              value={editLocation}
              onChangeText={setEditLocation}
              returnKeyType="search"
              onSubmitEditing={() => geocodeLocation(editLocation)}
              onBlur={() => geocodeLocation(editLocation)}
              placeholder="Search location"
              placeholderTextColor={COLORS.pale}
            />
            {geocoding && <ActivityIndicator size="small" color={COLORS.green} style={{ marginLeft: h(8) }} />}
          </View>
          <MapView
            style={{ flex: 1 }}
            region={defaultRegion}
            showsUserLocation={false}>
            {mapCoords && (
              <Marker coordinate={mapCoords} />
            )}
          </MapView>
          {editLocation ? (
            <View style={styles.placeDetails}>
              <Text style={styles.placeTitle}>{editLocation}</Text>
              <Text style={styles.placeMeta}>{selectedEvent?.locationAddress || 'Tap Search to find on map'}</Text>
            </View>
          ) : null}
        </View>
    );
  }

  function renderInviteesContent() {
    const filteredContacts = contacts.filter((contact) =>
      contact.displayName.toLowerCase().includes(inviteeSearch.toLowerCase())
    );
    return (
        <View style={styles.bottomSheetTall}>
          <View style={styles.sheetHandle} />
          <SheetTop
            title="Add invitees"
            onBack={() => setSheet('edit')}
            onSave={() => setSheet('edit')}
          />
          <Text style={styles.fieldLabel}>Invitee name</Text>
          <TextInput
            style={styles.largeInput}
            placeholder="Enter invitee name"
            placeholderTextColor="#A8B3BF"
            value={inviteeSearch}
            onChangeText={setInviteeSearch}
          />
          <Text style={styles.fieldLabel}>Your contacts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.peopleRail}>
            {filteredContacts.length === 0 ? (
              <Text style={styles.emptyText}>No contacts found.</Text>
            ) : null}
            {filteredContacts.map((contact) => (
              <TouchableOpacity key={contact.id} onPress={() => addInvitee(contact)}>
                <PersonBubble
                  person={
                    contact.contactUser || {
                      id: contact.id,
                      name: contact.displayName,
                      avatar: contact.avatar,
                    }
                  }
                  addable
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.fieldLabel}>Added invitees</Text>
          <View style={styles.chipWrap}>
            {invitees.map((person) => (
              <TouchableOpacity
                key={person.id}
                style={styles.inviteeChip}
                onPress={() => setRemoveInvitee(person)}>
                <ContactAvatar
                  avatarMap={avatarMap}
                  hashedPhoneNumber={person.phoneNumber}
                  profileAvatarUrl={person.avatar}
                  style={styles.chipAvatar}
                />
                <Text style={styles.chipText}>
                  {person.name || person.phoneNumber || 'Invitee'}
                </Text>
                <Text style={styles.chipRemove}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
    );
  }

  function renderDeleteDialogOverlay() {
    return (
        <View style={[styles.confirmOverlay, StyleSheet.absoluteFillObject]}>
          <BlurView intensity={10} tint="dark" style={styles.backdrop}>
            <View style={styles.dim} />
          </BlurView>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete event?</Text>
            <Text style={styles.confirmText}>
              This event will be permanently deleted for all participants. This action cannot be
              undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeButton} onPress={deleteEvent}>
                <Text style={styles.removeText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    );
  }

  function renderRemoveInviteeDialogOverlay() {
    if (!removeInvitee) return null;
    return (
        <View style={[styles.confirmOverlay, StyleSheet.absoluteFillObject]}>
          <BlurView intensity={10} tint="dark" style={styles.backdrop}>
            <View style={styles.dim} />
          </BlurView>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Remove {removeInvitee.name || 'invitee'}?</Text>
            <Text style={styles.confirmText}>
              This person will be removed from the meeting and will no longer receive updates about
              it.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setRemoveInvitee(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  setInvitees((prev) => prev.filter((person) => person.id !== removeInvitee.id));
                  setRemoveInvitee(null);
                }}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
    );
  }

  function addInvitee(contact: Contact) {
    const person = contact.contactUser || {
      id: contact.id,
      name: contact.displayName,
      avatar: contact.avatar,
    };
    setInvitees((prev) => (prev.some((item) => item.id === person.id) ? prev : [...prev, person]));
  }
};

const Header = ({
  title,
  onBell,
  insetsTop,
  badgeCount = 0,
}: {
  title: string;
  onBell: () => void;
  insetsTop: number;
  badgeCount?: number;
}) => (
  <View style={[styles.header, { paddingTop: Math.max(insetsTop + v(28), v(58)) }]}>
    <Text style={styles.headerTitle}>{title}</Text>
    <TouchableOpacity onPress={onBell} style={{ position: 'relative' }}>
      <View
        style={{
          width: h(40),
          height: h(40),
          borderRadius: h(20),
          backgroundColor: COLORS.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Image source={NotificationsIcon} style={styles.notificationIcon} />
      </View>
      {badgeCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: h(16),
            height: h(16),
            borderRadius: h(8),
            backgroundColor: COLORS.green,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: COLORS.white, fontSize: ms(9), fontFamily: 'AssociateSansBold' }}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
);

const SheetTop = ({
  title,
  onBack,
  onSave,
}: {
  title: string;
  onBack: () => void;
  onSave?: () => void;
}) => (
  <View style={styles.editHeader}>
    <TouchableOpacity onPress={onBack}>
      <BackGlyph size={21} />
    </TouchableOpacity>
    <Text style={styles.editTitle}>{title}</Text>
    {onSave ? (
      <TouchableOpacity onPress={onSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    ) : (
      <View style={{ width: h(40) }} />
    )}
  </View>
);

const WeekRail = ({
  selectedDate,
  onSelect,
  compact,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  compact?: boolean;
}) => {
  const days = getWeekDates(selectedDate);
  return (
    <View style={[styles.weekRail, compact && styles.weekRailCompact]}>
      {days.map((day) => {
        const active = isSameDay(day, selectedDate);
        return (
          <TouchableOpacity
            key={day.toISOString()}
            style={styles.weekDay}
            onPress={() => onSelect(day)}>
            <Text style={styles.weekDayName}>{formatDayName(day)}</Text>
            <View style={[styles.weekDayNumber, active && styles.weekDayNumberActive]}>
              <Text style={[styles.weekDayText, active && styles.weekDayTextActive]}>
                {day.getDate()}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Full-screen Month view grid: 6 week rows, each day showing continuous
// colored bars for its events (single-day events render as a 1-day bar,
// multi-day events span uninterrupted across the days they cover) —
// matching Google Calendar's mobile month view. Distinct from `MonthGrid`
// below, which is the compact numbers-only grid still used by Year view.
const MonthAgendaGrid = ({
  monthDate,
  events,
  selectedDate,
  onSelectDay,
  onSelectEvent,
}: {
  monthDate: Date;
  events: CalendarItem[];
  selectedDate: Date;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: CalendarItem) => void;
}) => {
  const cells = getMonthCells(monthDate);
  const weeks: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  let laneHints = new Map<string, number>();
  const rows = weeks.map((week) => {
    const spans = layoutEventsForMonthRow(events, week[0], laneHints);
    laneHints = new Map(spans.filter((s) => s.continuesAfter).map((s) => [s.event.id, s.lane]));
    return { week, spans };
  });

  const today = new Date();

  return (
    <View style={styles.monthAgendaGrid}>
      <View style={styles.monthAgendaHeaderRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <View key={`weekday-${index}`} style={styles.monthAgendaDayCell}>
            <Text style={styles.monthAgendaHeaderText}>{day}</Text>
          </View>
        ))}
      </View>
      {rows.map(({ week, spans }, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.monthAgendaRow}>
          <View style={styles.monthAgendaDayNumbers} pointerEvents="box-none">
            {week.map((day) => {
              const isCurrentMonth = day.getMonth() === monthDate.getMonth();
              const isToday = isSameDay(day, today);
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={styles.monthAgendaDayCell}
                  onPress={() => onSelectDay(day)}>
                  <View style={[styles.monthAgendaDayCircle, isToday && styles.monthAgendaDayCircleToday]}>
                    <Text
                      style={[
                        styles.monthAgendaDayText,
                        !isCurrentMonth && styles.mutedMonthDay,
                        isToday && styles.monthAgendaDayTextToday,
                      ]}>
                      {day.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.monthAgendaLanesArea} pointerEvents="box-none">
            {week.map((day, dayIndex) => (
              <TouchableOpacity
                key={`underlay-${dayIndex}`}
                activeOpacity={1}
                style={[
                  styles.monthAgendaDayUnderlay,
                  { left: `${(dayIndex / 7) * 100}%` as const, width: `${100 / 7}%` as const },
                ]}
                onPress={() => onSelectDay(day)}
              />
            ))}
            {spans
              .filter((span) => span.lane < MAX_MONTH_LANES)
              .map((span) => {
                const widthPct = ((span.endCol - span.startCol + 1) / 7) * 100;
                const leftPct = (span.startCol / 7) * 100;
                const isExternal = span.event.sourceType === 'external';
                const isPending = span.event.sourceType === 'internal' && span.event.status === 'pending';
                const isDeclined = span.event.sourceType === 'internal' && span.event.status === 'rejected';
                return (
                  <TouchableOpacity
                    key={span.event.id}
                    activeOpacity={0.85}
                    onPress={() => onSelectEvent(span.event)}
                    style={[
                      styles.monthAgendaBar,
                      isExternal && styles.externalEventBlock,
                      isPending && styles.weekEventBlockPending,
                      isDeclined && styles.weekEventBlockDeclined,
                      {
                        top: span.lane * (MONTH_BAR_HEIGHT + MONTH_BAR_GAP),
                        left: `${leftPct}%` as const,
                        width: `${widthPct}%` as const,
                        marginLeft: span.continuesBefore ? 0 : h(2),
                        marginRight: span.continuesAfter ? 0 : h(2),
                      },
                      span.continuesBefore && styles.monthAgendaBarNoLeftRadius,
                      span.continuesAfter && styles.monthAgendaBarNoRightRadius,
                    ]}>
                    <Text
                      style={[
                        styles.monthAgendaBarText,
                        isExternal && { color: '#759719' },
                        isPending && styles.weekEventTitlePending,
                        isDeclined && styles.weekEventTitleDeclined,
                      ]}
                      numberOfLines={1}>
                      {cleanTitle(span.event.title)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            {week.map((day, dayIndex) => {
              const overflow = spans.filter(
                (span) => span.lane >= MAX_MONTH_LANES && span.startCol <= dayIndex && span.endCol >= dayIndex
              ).length;
              if (overflow === 0) return null;
              return (
                <View
                  key={`overflow-${dayIndex}`}
                  pointerEvents="none"
                  style={[
                    styles.monthAgendaOverflow,
                    {
                      top: MAX_MONTH_LANES * (MONTH_BAR_HEIGHT + MONTH_BAR_GAP),
                      left: `${(dayIndex / 7) * 100}%` as const,
                      width: `${100 / 7}%` as const,
                    },
                  ]}>
                  <Text style={styles.monthAgendaOverflowText}>•••</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
};

const MonthGrid = ({
  monthDate,
  selectedDate,
  onSelect,
  compact,
  showTitle = true,
}: {
  monthDate: Date;
  selectedDate: Date;
  onSelect: (day: Date) => void;
  compact?: boolean;
  showTitle?: boolean;
}) => {
  const cells = getMonthCells(monthDate);
  const weeks: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return (
    <View style={[styles.monthGrid, compact && styles.monthGridCompact]}>
      {showTitle && (
        <Text style={[styles.monthGridTitle, compact && styles.monthGridTitleCompact]}>
          {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      )}
      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.monthWeekRow}>
          {week.map((day, dayIndex) => {
            const isCurrentMonth = day.getMonth() === monthDate.getMonth();
            const selected = isSameDay(day, selectedDate);
            return (
              <TouchableOpacity
                key={`${weekIndex}-${dayIndex}`}
                style={[styles.monthDay, compact && styles.monthDayCompact]}
                onPress={() => onSelect(day)}>
                <View style={[styles.monthDayCircle, selected && styles.monthDayCircleActive, compact && styles.monthDayCircleCompact, selected && compact && styles.monthDayCircleActiveCompact]}>
                  <Text
                    style={[
                      styles.monthDayText,
                      selected && styles.monthDayTextActive,
                      !isCurrentMonth && styles.mutedMonthDay,
                      compact && styles.monthDayTextCompact,
                    ]}>
                    {day.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const DetailRow = ({
  icon,
  label,
  value,
}: {
  icon: 'clock' | 'pin' | 'host';
  label: string;
  value: string;
}) => (
  <View style={styles.detailRow}>
    <MiniIcon type={icon} size={19} />
    <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
  </View>
);

const InputGroup = ({
  label,
  value,
  onChangeText,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}) => (
  <View>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.largeInput}
      value={value}
      onChangeText={onChangeText}
      autoFocus={autoFocus}
    />
  </View>
);

const FieldButton = ({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
  icon: 'clock' | 'pin';
}) => (
  <TouchableOpacity onPress={onPress}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.largeInputReadonly}>
      <Text style={styles.readonlyText}>{value}</Text>
      <Text style={styles.chevronSmall}>›</Text>
    </View>
  </TouchableOpacity>
);

const Segment = ({
  active,
  onChange,
}: {
  active: 'paid' | 'free';
  onChange: (value: 'paid' | 'free') => void;
}) => (
  <View style={styles.segment}>
    <TouchableOpacity
      style={[styles.segmentItem, active === 'paid' && styles.segmentActive]}
      onPress={() => onChange('paid')}>
      <Text style={[styles.segmentText, active === 'paid' && styles.segmentTextActive]}>Paid</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.segmentItem, active === 'free' && styles.segmentActive]}
      onPress={() => onChange('free')}>
      <Text style={[styles.segmentText, active === 'free' && styles.segmentTextActive]}>Free</Text>
    </TouchableOpacity>
  </View>
);

const VIEW_MODES: ViewMode[] = ['day', 'week', 'month', 'year'];
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
};

const ViewSwitcher = ({ active, onChange }: { active: ViewMode; onChange: (mode: ViewMode) => void }) => (
  <View style={styles.viewSwitcher}>
    {VIEW_MODES.map((mode) => (
      <TouchableOpacity
        key={mode}
        style={[styles.viewSwitcherItem, active === mode && styles.viewSwitcherActive]}
        onPress={() => onChange(mode)}>
        <Text style={[styles.viewSwitcherText, active === mode && styles.viewSwitcherTextActive]}>
          {VIEW_MODE_LABELS[mode]}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const PersonBubble = ({
  person,
  selectable,
  removable,
  onRemove,
  addable,
}: {
  person: Person;
  selectable?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  addable?: boolean;
}) => {
  const { avatarMap } = useDeviceContactAvatarMap();
  return (
  <View style={styles.personBubble}>
    <ContactAvatar
      avatarMap={avatarMap}
      hashedPhoneNumber={person.phoneNumber}
      profileAvatarUrl={person.avatar}
      style={styles.personAvatar}
    />
    {selectable ? (
      <View style={styles.personCheck}>
        <Image source={CheckIcon} style={{ width: ms(11), height: ms(11) }} tintColor={COLORS.white} />
      </View>
    ) : null}
    {removable ? (
      <TouchableOpacity style={styles.personRemove} onPress={onRemove}>
        <Text style={styles.personRemoveText}>×</Text>
      </TouchableOpacity>
    ) : null}
    {addable ? (
      <View style={styles.personAdd}>
        <Text style={styles.personAddText}>+</Text>
      </View>
    ) : null}
    <Text style={styles.personName}>{person.name || person.phoneNumber || 'Invitee'}</Text>
  </View>
  );
};

function cleanTitle(title?: string) {
  if (!title) return 'Meeting';
  return title.replace(/:\s*#\s*catch.*$/i, '').trim() || title;
}

function isPaid(event: any) {
  return /\$\d+/.test(event.description || '') || /paid/i.test(event.meetingType || '');
}

function extractPrice(event: any) {
  const match = String(event.description || '').match(/\$\d+(?:\.\d+)?/);
  return match?.[0] || 'Paid';
}

function getPriceLabel(event: any) {
  if (event.priceLabel) return event.priceLabel;
  return isPaid(event) ? extractPrice(event) : 'Free';
}

function getLocationText(event: CalendarItem) {
  return event.locationLabel || event.locationAddress || 'Remote';
}

function formatSingleMonth(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Header title text per view mode.
function formatDayTitle(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatWeekRangeTitle(days: Date[]) {
  const start = days[0];
  const end = days[days.length - 1];
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = sameMonth
    ? end.toLocaleDateString('en-US', { day: 'numeric' })
    : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function getWeekDates(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function getMonthCells(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(first.getDate() + mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDayName(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatHour(hour: number) {
  return new Date(2026, 6, 30, hour)
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toLowerCase();
}

// Compact "9a"/"2p" labels for the Week view's narrower hour gutter.
function formatHourShort(hour: number) {
  const period = hour >= 12 ? 'p' : 'a';
  const displayHour = hour % 12 || 12;
  return `${displayHour}${period}`;
}

function formatTime(date: Date) {
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}

function formatDisplayDate(date: Date) {
  return `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })} ${formatTime(date)}`;
}

function formatToastDate(date: Date) {
  return isSameDay(date, new Date())
    ? 'Today'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDurationMinutes(event: CalendarItem) {
  return Math.max(
    15,
    Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)
  );
}

function getEventPosition(event: CalendarItem) {
  const start = new Date(event.startTime);
  const minutes = start.getHours() * 60 + start.getMinutes();
  const top = v(10) + (minutes / 60) * HOUR_HEIGHT;
  const rawHeight = (getDurationMinutes(event) / 60) * HOUR_HEIGHT - EVENT_GAP_PX;
  // Floor at TINY_EVENT_PX so very short events stay legible/tappable.
  const height = Math.max(TINY_EVENT_PX, rawHeight);
  return { top, height };
}

function getEventPeople(event: CalendarItem) {
  return [event.sender, event.receiver].filter(Boolean) as Person[];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: h(16),
  },
  headerTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(31),
    lineHeight: ms(38),
  },
  notificationIcon: { width: h(26), height: h(26) },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: v(120),
  },
  primaryButton: {
    height: v(46),
    borderRadius: h(23),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginHorizontal: h(16),
  },
  primaryButtonText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(16) },
  disabledButton: { opacity: 0.55 },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: h(16),
    marginBottom: v(30),
  },
  monthTitleWrap: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(24),
    lineHeight: ms(30),
  },
  content: { flex: 1 },
  weekRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: h(16),
    marginBottom: v(36),
  },
  weekRailCompact: { marginHorizontal: -h(8), marginBottom: v(28) },
  weekDay: { alignItems: 'center', width: h(44) },
  weekDayName: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
    marginBottom: v(12),
  },
  weekDayNumber: {
    width: h(40),
    height: h(40),
    borderRadius: h(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayNumberActive: {
    width: h(44),
    height: h(44),
    borderRadius: h(22),
    backgroundColor: COLORS.ink,
  },
  weekDayText: { color: COLORS.ink, fontFamily: 'Inter_700Bold', fontSize: ms(16) },
  weekDayTextActive: { color: COLORS.white },
  timeline: { minHeight: v(620), marginHorizontal: h(16), position: 'relative' },
  timelineRow: { height: HOUR_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' },
  hourText: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(13), width: h(65) },
  hourLine: { flex: 1, height: 1, backgroundColor: COLORS.line, marginTop: v(10) },

  // --- Week view ---
  weekGridHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: h(16),
    marginBottom: v(10),
  },
  weekGridHeaderCell: { flex: 1, alignItems: 'center' },
  weekGridDayName: { color: COLORS.muted, fontFamily: 'Inter_400Regular', fontSize: ms(11) },
  weekGridDayNumber: {
    width: h(26),
    height: h(26),
    borderRadius: h(13),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: v(2),
  },
  weekGridDayNumberActive: { backgroundColor: COLORS.ink },
  weekGridDayText: { color: COLORS.ink, fontFamily: 'Inter_700Bold', fontSize: ms(14) },
  weekGridDayTextActive: { color: COLORS.white },
  weekAllDayRow: {
    flexDirection: 'row',
    paddingHorizontal: h(16),
    marginBottom: v(10),
  },
  weekAllDayCell: { flex: 1, paddingHorizontal: h(2), gap: v(2) },
  weekAllDayChip: {
    backgroundColor: COLORS.green,
    borderRadius: h(4),
    paddingHorizontal: h(4),
    paddingVertical: v(2),
  },
  weekAllDayChipText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(9) },
  weekAllDayMore: { color: COLORS.muted, fontFamily: 'Inter_400Regular', fontSize: ms(9) },
  weekTimeline: { minHeight: v(620), marginHorizontal: h(16), position: 'relative' },
  weekHourRow: { height: HOUR_HEIGHT, flexDirection: 'row', alignItems: 'flex-start' },
  weekHourText: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(10), width: h(36) },
  weekHourLine: { flex: 1, height: 1, backgroundColor: COLORS.line, marginTop: v(10) },
  weekColumnsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  weekDayColumn: { flex: 1, position: 'relative' },
  weekDayColumnBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.softLine },
  weekEventBlock: {
    position: 'absolute',
    borderRadius: h(3),
    backgroundColor: COLORS.green,
    paddingHorizontal: h(3),
    paddingVertical: v(1),
    overflow: 'hidden',
  },
  weekEventBlockPending: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.green },
  weekEventBlockDeclined: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.pale },
  weekEventTitle: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(11) },
  weekEventTitleExternal: { color: '#759719' },
  weekEventTitlePending: { color: COLORS.green },
  weekEventTitleDeclined: { color: COLORS.declinedText },
  weekNowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  weekNowDot: {
    width: h(7),
    height: h(7),
    borderRadius: h(3.5),
    backgroundColor: '#E53935',
    marginLeft: -h(3.5),
  },
  weekNowBar: { flex: 1, height: 2, backgroundColor: '#E53935' },
  unavailBand: {
    position: 'absolute',
    left: h(65),
    right: 0,
    backgroundColor: '#F0F2F6',
    opacity: 0.75,
  },
  // Position (top/left/right/height) is kept separate from visual styling so
  // the main Day-view timeline can override just the horizontal placement
  // per-event (for side-by-side overlapping events) without duplicating the
  // border/background/padding declarations.
  eventBlockPosition: {
    position: 'absolute',
    left: h(72),
    right: 0,
  },
  eventBlockVisual: {
    borderRadius: h(4),
    borderWidth: 1,
    borderColor: '#D8EE9B',
    backgroundColor: COLORS.lightGreen,
    padding: h(10),
    overflow: 'hidden',
  },
  // Tiny block: 15 min — single row, micro text
  eventBlockTiny: { paddingVertical: v(3), paddingHorizontal: h(5) },
  eventTinyRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  eventTinyTitle: {
    color: '#759719',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(10),
    flex: 1,
  },
  eventTinyPrice: {
    color: '#759719',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(10),
    flexShrink: 0,
    marginLeft: h(4),
  },
  // Compact block: 20–29 min — two rows, small text
  eventBlockCompact: { paddingVertical: v(4), paddingHorizontal: h(6) },
  eventCompactTitle: {
    color: '#759719',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(12),
    marginBottom: v(1),
  },
  eventCompactPrice: {
    color: '#759719',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(11),
  },
  externalEventBlock: { backgroundColor: '#F8FDEB' },
  // Transparent fill + a solid green outline reads as "provisional" — still
  // clearly green/on-brand, but visibly lighter-weight than a filled block,
  // which is reserved for a meeting that's actually confirmed.
  pendingEventBlock: { backgroundColor: 'transparent', borderColor: COLORS.green, borderWidth: 1.5 },
  declinedEventBlock: { backgroundColor: 'transparent', borderColor: COLORS.pale, borderWidth: 1.5 },
  eventTitle: {
    color: '#759719',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(14),
    marginBottom: v(6),
  },
  eventTime: { color: '#759719', fontFamily: 'Inter_700Bold', fontSize: ms(12) },
  eventPrice: {
    position: 'absolute',
    top: h(10),
    right: h(10),
    color: '#759719',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(14),
  },
  eventProvider: { position: 'absolute', right: h(10), bottom: h(8) },
  monthViewContainer: {
    flex: 1,
    paddingBottom: v(90),
  },
  monthAgendaGrid: {
    flex: 1,
    paddingHorizontal: h(10),
  },
  monthAgendaHeaderRow: {
    flexDirection: 'row',
    paddingBottom: v(6),
  },
  monthAgendaHeaderText: {
    textAlign: 'center',
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
  },
  monthAgendaRow: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: COLORS.softLine,
    overflow: 'hidden',
  },
  monthAgendaDayNumbers: {
    flexDirection: 'row',
    paddingTop: v(4),
  },
  monthAgendaDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  monthAgendaDayCircle: {
    width: h(22),
    height: h(22),
    borderRadius: h(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthAgendaDayCircleToday: {
    backgroundColor: COLORS.green,
  },
  monthAgendaDayText: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
  },
  monthAgendaDayTextToday: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
  },
  monthAgendaLanesArea: {
    flex: 1,
    position: 'relative',
  },
  monthAgendaDayUnderlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  monthAgendaBar: {
    position: 'absolute',
    height: MONTH_BAR_HEIGHT,
    borderRadius: h(4),
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    paddingHorizontal: h(5),
  },
  monthAgendaBarNoLeftRadius: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  monthAgendaBarNoRightRadius: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  monthAgendaBarText: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(10),
  },
  monthAgendaOverflow: {
    position: 'absolute',
    alignItems: 'center',
  },
  monthAgendaOverflowText: {
    color: COLORS.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(11),
  },
  monthNavButton: {
    width: h(40),
    height: h(40),
    borderRadius: h(20),
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: {
    color: COLORS.ink,
    fontSize: ms(22),
    fontFamily: 'Inter_400Regular',
    marginTop: -v(2),
  },
  monthGrid: { paddingHorizontal: h(16), marginBottom: v(28) },
  monthGridCompact: { marginBottom: v(8) },
  yearGrid: { paddingBottom: v(40) },
  yearNavRow: { flexDirection: 'row', paddingHorizontal: h(16), marginBottom: v(12) },
  yearMonthsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  yearMonthCell: { width: '50%' },
  monthGridTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(23),
    textAlign: 'center',
    marginBottom: v(20),
  },
  monthGridTitleCompact: {
    fontSize: ms(18),
    marginBottom: v(10),
  },
  monthGridDays: { flexDirection: 'row', flexWrap: 'wrap' },
  monthWeekRow: {
    flexDirection: 'row',
  },
  monthDay: {
    flex: 1,
    height: v(45),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: v(13),
  },
  monthDayCompact: {
    height: v(34),
    marginBottom: v(6),
  },
  monthDayCircle: {
    width: h(45),
    height: h(45),
    borderRadius: h(23),
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDayCircleCompact: {
    width: h(36),
    height: h(36),
    borderRadius: h(18),
  },
  monthDayCircleActive: {
    backgroundColor: COLORS.ink,
    width: h(45),
    height: h(45),
    borderRadius: h(23),
  },
  monthDayCircleActiveCompact: {
    width: h(36),
    height: h(36),
    borderRadius: h(18),
  },
  monthDayText: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(16) },
  monthDayTextCompact: { fontSize: ms(13) },
  monthDayTextActive: { color: COLORS.white },
  mutedMonthDay: { color: '#98A0A9' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  dim: { flex: 1, backgroundColor: '#000', opacity: 0.25 },
  bottomSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(26),
    borderTopRightRadius: h(26),
    paddingHorizontal: h(16),
    paddingTop: v(14),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: h(56),
    height: v(4),
    borderRadius: h(2),
    backgroundColor: COLORS.line,
    marginBottom: v(16),
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: v(20),
  },
  sheetTitle: { color: COLORS.ink, fontFamily: 'Inter_700Bold', fontSize: ms(21) },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: v(18),
  },
  detailEventName: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(17), flex: 1 },
  badges: { flexDirection: 'row', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', gap: h(6) },
  confirmBadge: {
    overflow: 'hidden',
    color: '#65840E',
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(11),
    paddingHorizontal: h(9),
    paddingVertical: v(4),
    fontFamily: 'Inter_400Regular',
    fontSize: ms(12),
  },
  freeBadge: {
    overflow: 'hidden',
    color: '#65840E',
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(11),
    paddingHorizontal: h(10),
    paddingVertical: v(4),
    fontFamily: 'Inter_400Regular',
    fontSize: ms(12),
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', minHeight: v(32) },
  detailLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    marginLeft: h(8),
  },
  detailValue: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    textAlign: 'right',
    marginLeft: h(8),
  },
  respondRow: {
    flexDirection: 'row',
    gap: h(10),
    marginTop: v(14),
    marginBottom: v(4),
  },
  declineButton: {
    flex: 1,
    height: v(44),
    borderRadius: h(22),
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: { color: COLORS.muted, fontFamily: 'Inter_700Bold', fontSize: ms(15) },
  confirmButton: {
    flex: 1,
    height: v(44),
    borderRadius: h(22),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(15) },
  inviteesTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(17),
    marginTop: v(4),
    marginBottom: v(10),
  },
  peopleRail: { gap: h(13), paddingBottom: v(8) },
  personBubble: { width: h(68), alignItems: 'center' },
  personAvatar: { width: h(52), height: h(52), borderRadius: h(26) },
  personName: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(12),
    lineHeight: ms(15),
    textAlign: 'center',
    marginTop: v(6),
  },
  personCheck: {
    position: 'absolute',
    right: h(5),
    top: h(37),
    width: h(16),
    height: h(16),
    borderRadius: h(8),
    backgroundColor: '#7EA9DB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personCheckText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(9) },
  personRemove: {
    position: 'absolute',
    right: h(1),
    top: 0,
    width: h(18),
    height: h(18),
    borderRadius: h(9),
    backgroundColor: '#FF5B66',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personRemoveText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(12) },
  personAdd: {
    position: 'absolute',
    right: h(1),
    top: 0,
    width: h(18),
    height: h(18),
    borderRadius: h(9),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personAddText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(12) },
  foodCard: {
    marginTop: v(16),
    height: v(64),
    borderRadius: h(13),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(12),
  },
  foodIcon: {
    width: h(42),
    height: h(42),
    borderRadius: h(21),
    backgroundColor: '#F4F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: h(11),
  },
  foodTextWrap: { flex: 1 },
  foodTitle: { color: COLORS.ink, fontFamily: 'Inter_700Bold', fontSize: ms(16) },
  foodText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
    lineHeight: ms(17),
  },
  chevron: { color: COLORS.pale, fontFamily: 'Inter_400Regular', fontSize: ms(30) },
  editSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(26),
    borderTopRightRadius: h(26),
    paddingHorizontal: h(16),
    paddingTop: v(14),
    maxHeight: '92%',
  },
  editHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: v(18) },
  editTitle: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(18),
    marginLeft: h(9),
  },
  saveText: { color: COLORS.green, fontFamily: 'Inter_400Regular', fontSize: ms(15) },
  fieldLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    marginBottom: v(8),
    marginTop: v(10),
  },
  largeInput: {
    height: v(48),
    borderRadius: h(24),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
    paddingHorizontal: h(16),
    marginBottom: v(11),
  },
  largeInputReadonly: {
    height: v(48),
    borderRadius: h(24),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(16),
    marginBottom: v(11),
  },
  readonlyText: { flex: 1, color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(15) },
  chevronSmall: { color: COLORS.ink, fontSize: ms(24) },
  addInviteeBubble: {
    width: h(68),
    height: v(92),
    borderRadius: h(34),
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.softLine,
  },
  addInviteePlus: {
    width: h(52),
    height: h(52),
    borderRadius: h(26),
    backgroundColor: COLORS.green,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: h(52),
    fontFamily: 'Inter_400Regular',
    fontSize: ms(30),
  },
  addInviteeText: {
    color: COLORS.green,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(12),
    marginTop: v(6),
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: v(12),
  },
  segment: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: h(22) },
  segmentItem: {
    height: v(42),
    paddingHorizontal: h(18),
    borderRadius: h(19),
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: COLORS.green },
  segmentText: { color: '#8E98A2', fontFamily: 'Inter_400Regular', fontSize: ms(15) },
  segmentTextActive: { color: COLORS.white },
  viewSwitcherRow: { paddingHorizontal: h(16), marginBottom: v(18) },
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: h(20),
    padding: h(3),
  },
  viewSwitcherItem: {
    flex: 1,
    height: v(32),
    borderRadius: h(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSwitcherActive: { backgroundColor: COLORS.green },
  viewSwitcherText: { color: '#8E98A2', fontFamily: 'Inter_700Bold', fontSize: ms(13) },
  viewSwitcherTextActive: { color: COLORS.white },
  deleteButton: {
    height: v(48),
    borderRadius: h(24),
    backgroundColor: COLORS.greyButton,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: h(8),
    marginTop: v(18),
  },
  deleteButtonText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(16) },
  fullSheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(26),
    borderTopRightRadius: h(26),
    paddingHorizontal: h(16),
    paddingTop: v(16),
  },
  rescheduleBlock: {
    top: v(270),
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
    height: v(58),
  },
rescheduleBlockTitle: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(14) },
  rescheduleBlockTime: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(15),
    marginTop: v(8),
  },
  currentTimePanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.softLine,
    padding: h(16),
    paddingBottom: v(34),
  },
  currentTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(23),
    marginBottom: v(5),
  },
  currentText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
    marginBottom: v(16),
  },
  currentCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: h(12),
    padding: h(16),
    marginBottom: v(20),
  },
  currentCardTitle: { color: COLORS.muted, fontFamily: 'Inter_700Bold', fontSize: ms(18) },
  currentCardTime: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
    marginTop: v(10),
  },
  currentCardPrice: {
    position: 'absolute',
    top: h(16),
    right: h(16),
    color: COLORS.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(18),
  },
  searchInputWrap: {
    height: v(58),
    borderRadius: h(28),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(20),
    marginBottom: v(22),
  },
  searchInput: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(22),
    marginLeft: h(12),
  },
  placeDetails: {
    borderRadius: h(14),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    padding: h(16),
  },
  placeTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(22),
    marginBottom: v(8),
  },
  placeMeta: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
    marginBottom: v(8),
  },
  successToast: {
    position: 'absolute',
    left: h(16),
    right: h(16),
    zIndex: 40,
    minHeight: v(76),
    borderRadius: h(18),
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.softLine,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(14),
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  successIcon: {
    width: h(38),
    height: h(38),
    borderRadius: h(19),
    backgroundColor: '#86A91E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: h(12),
  },
  successIconText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(18) },
  successTextWrap: { flex: 1 },
  successTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(19),
    marginBottom: v(3),
  },
  successSubtitle: { color: COLORS.muted, fontFamily: 'Inter_400Regular', fontSize: ms(15) },
  bottomSheetTall: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: '58%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(26),
    borderTopRightRadius: h(26),
    paddingHorizontal: h(16),
    paddingTop: v(16),
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(17),
    paddingVertical: v(20),
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: h(10), marginTop: v(4) },
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
  chipText: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(15) },
  chipRemove: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(22),
    marginLeft: h(8),
  },
  confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmCard: {
    width: '91%',
    borderRadius: h(22),
    backgroundColor: COLORS.white,
    padding: h(24),
    alignItems: 'center',
  },
  confirmTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(26),
    textAlign: 'center',
    marginBottom: v(12),
  },
  confirmText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
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
    backgroundColor: COLORS.greyButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: COLORS.green, fontFamily: 'Inter_700Bold', fontSize: ms(17) },
  removeText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(17) },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 5,
  },
  currentTimeDot: {
    width: h(11),
    height: h(11),
    borderRadius: h(5.5),
    backgroundColor: '#E53935',
    marginLeft: h(60),
  },
  currentTimeBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#E53935',
    marginLeft: h(1),
  },
});

export default AppStack_CalendarScreen;
