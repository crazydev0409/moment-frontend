import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';
import * as ExpoLocation from 'expo-location';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
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
import { Avatar, NotificationsIcon, GoogleCalendarIcon, OutlookIcon, HookIcon, CheckIcon } from '~/lib/images';
import { getDeviceId } from '~/services/deviceService';
import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';
import { userAtom } from '~/store';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_CalendarScreen'>;

interface BookableUserResponse {
  id: string;
  displayName: string;
  avatar?: string | null;
}
type CalendarProvider = 'google' | 'microsoft' | 'icloud';
type ViewMode = 'agenda' | 'month';
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
};

const h = (size: number) => horizontalScale(size);
const v = (size: number) => verticalScale(size);
const ms = (size: number) => moderateScale(size, 0.2);

const providerLabels: Record<CalendarProvider, string> = {
  google: 'Google Calendar',
  icloud: 'Apple Calendar',
  microsoft: 'Outlook Calendar',
};

WebBrowser.maybeCompleteAuthSession();

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

const CalendarPlusIcon = () => (
  <Svg width={h(54)} height={h(54)} viewBox="0 0 54 54" fill="none">
    <Rect x="13" y="15" width="25" height="25" rx="4" stroke={COLORS.muted} strokeWidth="3" />
    <Path
      d="M19 10v10M32 10v10M13 24h25"
      stroke={COLORS.muted}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <Path d="M40 32v16M32 40h16" stroke={COLORS.muted} strokeWidth="3" strokeLinecap="round" />
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
}: {
  type: 'clock' | 'pin' | 'host' | 'edit' | 'search' | 'trash' | 'food';
  color?: string;
}) => (
  <Svg width={h(24)} height={h(24)} viewBox="0 0 24 24" fill="none">
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
    // Align with the same coordinate system as events: top = v(10) + (min/60)*v(80)
    // For the very first band (midnight), extend to the top of the container.
    const top = startMinutes === 0 ? 0 : v(10) + (startMinutes / 60) * v(80);
    const bottom = v(10) + (endMinutes / 60) * v(80);
    return { top, height: bottom - top };
  });
}

const AppStack_CalendarScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [user] = useAtom(userAtom);
  const oauthRedirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'catch', path: 'calendar-integration' }),
    []
  );

  const routeDate = route.params?.date;
  const routeContact = route.params?.contact;
  const routeMomentRequestId = route.params?.momentRequestId;
  const routeBookingUserId = route.params?.bookingUserId;

  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider | null>(null);
  const [showConnectOptions, setShowConnectOptions] = useState(false);
  const [showIcloudModal, setShowIcloudModal] = useState(false);
  const [icloudAppleId, setIcloudAppleId] = useState('');
  const [icloudPassword, setIcloudPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('agenda');
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

  // Keep navigateDayRef current every render so the PanResponder closure always sees fresh state.
  navigateDayRef.current = (direction: number) => {
    const w = Dimensions.get('window').width;
    Animated.timing(slideAnim, {
      toValue: -direction * w,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + direction);
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
    if (loading || viewMode !== 'agenda') return;
    if (routeMomentRequestId) return; // meeting deep-link — let that effect scroll instead
    if (!isSameDay(selectedDate, new Date())) return;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const top = v(10) + (minutes / 60) * v(80);
    const scrollY = Math.max(0, top - v(160));
    const t = setTimeout(() => {
      timelineScrollRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 500);
    return () => clearTimeout(t);
  }, [selectedDate, loading, viewMode, routeMomentRequestId]);

  const monthViewBase = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 40,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          setMonthOffset((prev) => prev + 2);
        } else if (gestureState.dx > 50) {
          setMonthOffset((prev) => prev - 2);
        }
      },
    })
  ).current;

  const hasConnectedCalendar = integrations.some((integration) => integration.connected);

  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true);
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
          return request.status === 'approved' || request.status === 'pending';
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
        const scrollY = Math.max(0, v(10) + (eventMinutes / 60) * v(80) - v(160));
        setTimeout(() => {
          timelineScrollRef.current?.scrollTo({ y: scrollY, animated: false });
        }, 500);
      }
    }
  }, [routeMomentRequestId, events]);

  useFocusEffect(
    useCallback(() => {
      loadCalendarData();
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
        setTimeout(() => loadCalendarData(), 1000);
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

        cleanup = setupSocketEventListeners({
          onMomentRequest: () => loadCalendarData(),
          onMomentResponse: () => {
            setTimeout(() => loadCalendarData(), 1000);
          },
          onMomentCanceled: () => {
            setTimeout(() => loadCalendarData(), 1000);
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

  const connectProvider = async () => {
    if (!selectedProvider) return;
    if (selectedProvider === 'icloud') {
      setShowIcloudModal(true);
      return;
    }

    try {
      setConnecting(true);
      const deviceId = await getDeviceId();
      const deviceName =
        Device.deviceName || Device.modelName || Device.modelId || 'unknown-device';
      const response = await http.post(`/users/calendar-integrations/${selectedProvider}/start`, {
        device_id: deviceId,
        device_name: deviceName,
        deviceId,
        deviceName,
        redirectUri: oauthRedirectUri,
      });
      const result = await WebBrowser.openAuthSessionAsync(
        response.data.authorizationUrl,
        oauthRedirectUri
      );

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        if (parsed.queryParams?.status === 'success') {
          setShowConnectOptions(false);
          await loadCalendarData();
          return;
        }
      }
      Alert.alert('Connection failed', 'Calendar connection was not completed.');
    } catch (error: any) {
      console.error('Error connecting calendar:', error);
      Alert.alert(
        'Connection failed',
        error.response?.data?.error || 'Failed to connect calendar.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleIcloudConnect = async () => {
    if (!icloudAppleId.trim() || !icloudPassword.trim()) {
      Alert.alert('Apple Calendar', 'Enter your Apple ID and app-specific password.');
      return;
    }

    try {
      setConnecting(true);
      await http.post('/users/calendar-integrations/icloud/connect', {
        appleId: icloudAppleId.trim(),
        appSpecificPassword: icloudPassword.trim(),
      });
      setShowIcloudModal(false);
      setShowConnectOptions(false);
      setIcloudAppleId('');
      setIcloudPassword('');
      await loadCalendarData();
    } catch (error: any) {
      console.error('Error connecting iCloud calendar:', error);
      Alert.alert(
        'Connection failed',
        error.response?.data?.error || 'Failed to connect Apple Calendar.'
      );
    } finally {
      setConnecting(false);
    }
  };

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

  if (loading && !showConnectOptions) {
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

  if (!hasConnectedCalendar && !showConnectOptions) {
    return (
      <View style={styles.screen}>
        <Header
          title="Calendar"
          onBell={() => navigation.navigate('AppStack_NotificationScreen')}
          insetsTop={insets.top}
          badgeCount={unreadNotifCount}
        />
        <View style={styles.connectEmpty}>
          <View style={styles.connectIconCircle}>
            <CalendarPlusIcon />
          </View>
          <Text style={styles.connectTitle}>Connect your calendar</Text>
          <Text style={styles.connectText}>
            Sync Google, Apple, or Outlook Calendar to view your schedule in one place
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowConnectOptions(true)}>
            <Text style={styles.primaryButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
        {renderIcloudModal()}
      </View>
    );
  }

  if (showConnectOptions) {
    return (
      <View style={styles.screen}>
        <TopBar
          title="Connect your calendar"
          insetsTop={insets.top}
          onBack={() => setShowConnectOptions(false)}
        />
        <View style={styles.providerList}>
          {(['google', 'icloud', 'microsoft'] as CalendarProvider[]).map((provider) => (
            <TouchableOpacity
              key={provider}
              style={[
                styles.providerCard,
                selectedProvider === provider && styles.providerCardSelected,
              ]}
              onPress={() => setSelectedProvider(provider)}>
              <ProviderIcon provider={provider} size={36} />
              <Text style={styles.providerText}>{providerLabels[provider]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.connectContinue,
            !selectedProvider && styles.disabledButton,
          ]}
          disabled={!selectedProvider || connecting}
          onPress={connectProvider}>
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
        {renderIcloudModal()}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.calendarHeader, { paddingTop: Math.max(insets.top + v(28), v(58)) }]}>
        <TouchableOpacity
          style={styles.monthTitleWrap}
          onPress={() => setViewMode(viewMode === 'agenda' ? 'month' : 'agenda')}>
          <Text style={styles.monthTitle}>{formatMonthRange(viewMode === 'month' ? monthViewBase : selectedDate)}</Text>
          <Text style={styles.monthChevron}>{viewMode === 'agenda' ? '▼' : '▲'}</Text>
        </TouchableOpacity>
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
                width: h(16),
                height: h(16),
                borderRadius: h(8),
                backgroundColor: COLORS.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ color: COLORS.white, fontSize: ms(9), fontFamily: 'AssociateSansBold' }}>
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {viewMode === 'month' ? renderMonthView() : renderAgendaView()}
      {renderDetailsSheet()}
      {renderEditSheet()}
      {renderTimeSheet()}
      {renderLocationSheet()}
      {renderInviteesSheet()}
      {renderIcloudModal()}
      {renderDeleteDialog()}
      {renderRemoveInviteeDialog()}
      {renderSuccessToast()}
    </View>
  );

  function renderIcloudModal() {
    return (
      <Modal
        visible={showIcloudModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIcloudModal(false)}>
        <KeyboardAvoidingView
          style={styles.icloudOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.icloudCard}>
            <Text style={styles.icloudTitle}>Connect Apple Calendar</Text>
            <Text style={styles.icloudText}>
              Use your Apple ID and an app-specific password for calendar sync.
            </Text>
            <TextInput
              style={styles.icloudInput}
              placeholder="Apple ID"
              placeholderTextColor="#A8B3BF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={icloudAppleId}
              onChangeText={setIcloudAppleId}
            />
            <TextInput
              style={styles.icloudInput}
              placeholder="App-specific password"
              placeholderTextColor="#A8B3BF"
              autoCapitalize="none"
              secureTextEntry
              value={icloudPassword}
              onChangeText={setIcloudPassword}
            />
            <View style={styles.icloudActions}>
              <TouchableOpacity
                style={styles.icloudCancel}
                onPress={() => setShowIcloudModal(false)}
                disabled={connecting}>
                <Text style={styles.icloudCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.icloudConnect}
                onPress={handleIcloudConnect}
                disabled={connecting}>
                {connecting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.icloudConnectText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

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
    const nowTop = v(10) + (nowMinutes / 60) * v(80);
    const unavailBands = getUnavailableBands(myAvailability, selectedDate.getDay());

    return (
      <View style={styles.content} {...agendaPanResponder.panHandlers}>
        <WeekRail selectedDate={selectedDate} onSelect={setSelectedDate} />
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <ScrollView ref={timelineScrollRef} contentContainerStyle={{ paddingBottom: v(140) }}>
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
          {selectedDayEvents.map((event) => {
            const durationMins = getDurationMinutes(event);
            // < 20 min (e.g. 15 min): single-row title + price, micro font
            const isTiny = durationMins < 20;
            // 20–29 min: two compact rows (title + price), no time/icon
            const isCompact = !isTiny && durationMins < 30;
            const priceLabel = getPriceLabel(event);
            const providerKey =
              event.source === 'catch' ? 'catch'
              : event.source === 'microsoft' ? 'microsoft'
              : event.source === 'icloud' ? 'icloud'
              : 'google';
            return (
              <TouchableOpacity
                key={event.id}
                activeOpacity={0.85}
                style={[
                  styles.eventBlock,
                  getEventPosition(event),
                  event.sourceType === 'external' && styles.externalEventBlock,
                  isTiny && styles.eventBlockTiny,
                  isCompact && styles.eventBlockCompact,
                ]}
                onPress={() => openEventDetails(event)}>
                {isTiny ? (
                  // Single horizontal row: agenda · cost
                  <View style={styles.eventTinyRow}>
                    <Text style={styles.eventTinyTitle} numberOfLines={1}>
                      {cleanTitle(event.title)}
                    </Text>
                    <Text style={styles.eventTinyPrice}>{priceLabel}</Text>
                  </View>
                ) : isCompact ? (
                  // Two compact rows: title then price
                  <>
                    <Text style={styles.eventCompactTitle} numberOfLines={1}>
                      {cleanTitle(event.title)}
                    </Text>
                    <Text style={styles.eventCompactPrice}>{priceLabel}</Text>
                  </>
                ) : (
                  // Full layout
                  <>
                    <Text style={styles.eventTitle}>{cleanTitle(event.title)}</Text>
                    <Text style={styles.eventTime}>
                      {formatTime(new Date(event.startTime))} - {formatTime(new Date(event.endTime))}
                    </Text>
                    <Text style={styles.eventPrice}>{priceLabel}</Text>
                    <View style={styles.eventProvider}>
                      <ProviderIcon provider={providerKey} size={20} />
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        </ScrollView>
        </Animated.View>
      </View>
    );
  }

  function renderMonthView() {
    const firstMonth = monthViewBase;
    const secondMonth = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + 1, 1);
    return (
      <View style={styles.monthViewContainer}>
        <View style={styles.monthNavRow}>
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev) => prev - 2)}>
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.monthNavButton}
            onPress={() => setMonthOffset((prev) => prev + 2)}>
            <Text style={styles.monthNavText}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.weekLabels}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <Text key={`weekday-${index}`} style={styles.weekLabel}>
              {day}
            </Text>
          ))}
        </View>
        <MonthGrid
          monthDate={firstMonth}
          selectedDate={selectedDate}
          onSelect={(day) => {
            setSelectedDate(day);
            setViewMode('agenda');
          }}
          compact
        />
        <MonthGrid
          monthDate={secondMonth}
          selectedDate={selectedDate}
          onSelect={(day) => {
            setSelectedDate(day);
            setViewMode('agenda');
          }}
          compact
        />
      </View>
    );
  }

  function renderDetailsSheet() {
    if (sheet !== 'details' || !selectedEvent) return null;
    const people = invitees.length ? invitees : getEventPeople(selectedEvent);
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSheet(null)}>
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
                <MiniIcon type="edit" color={COLORS.muted} />
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
                  size={22}
                />
                <Text style={[styles.detailEventName, { marginLeft: h(8), flex: 1 }]} numberOfLines={2}>
                  {cleanTitle(selectedEvent.title)}
                </Text>
              </View>
              <View style={styles.badges}>
                <Text style={[
                  styles.confirmBadge,
                  selectedEvent.status === 'pending' && { backgroundColor: '#FFF3CD', color: '#856404' },
                ]}>
                  {selectedEvent.status === 'approved' ? 'Confirmed' : selectedEvent.status === 'pending' ? 'Pending' : 'External'}
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
                <MiniIcon type="food" color={COLORS.muted} />
              </View>
              <View style={styles.foodTextWrap}>
                <Text style={styles.foodTitle}>Need a Bite?</Text>
                <Text style={styles.foodText}>Get your favorite meal delivered in minutes.</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  function renderEditSheet() {
    if (sheet !== 'edit' || !selectedEvent) return null;
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSheet('details')}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BlurView intensity={10} tint="dark" style={styles.backdrop}>
            <View style={styles.dim} />
          </BlurView>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheet('details')} />
          <ScrollView
            style={styles.editSheet}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + v(22), v(34)) }}>
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
              <MiniIcon type="trash" color={COLORS.white} />
              <Text style={styles.deleteButtonText}>Delete Event</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  function renderTimeSheet() {
    if (sheet !== 'time' || !selectedEvent) return null;
    const duration = getDurationMinutes(selectedEvent);

    const pickSlot = (slotMinutes: number) => {
      const d = new Date(selectedDate);
      d.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);
      setRescheduleTime(d);
    };

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSheet('edit')}>
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
              const top = v(10) + (slotMinutes / 60) * v(80);
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
                const evIsTiny = evDuration < 20;
                const evIsCompact = !evIsTiny && evDuration < 30;
                const priceLabel = getPriceLabel(event);
                return (
                  <TouchableOpacity
                    key={event.id}
                    activeOpacity={0.85}
                    style={[
                      styles.eventBlock,
                      evIsTiny && styles.eventBlockTiny,
                      evIsCompact && styles.eventBlockCompact,
                      getEventPosition(event),
                      { backgroundColor: COLORS.green, borderColor: COLORS.green },
                    ]}
                    onPress={() => setRescheduleTime(new Date(event.startTime))}>
                    {evIsTiny ? (
                      <View style={styles.eventTinyRow}>
                        <Text style={[styles.eventTinyTitle, { color: COLORS.white }]} numberOfLines={1}>
                          {cleanTitle(event.title)}
                        </Text>
                        <Text style={[styles.eventTinyPrice, { color: COLORS.white }]}>{priceLabel}</Text>
                      </View>
                    ) : evIsCompact ? (
                      <>
                        <Text style={[styles.eventCompactTitle, { color: COLORS.white }]} numberOfLines={1}>
                          {cleanTitle(event.title)}
                        </Text>
                        <Text style={[styles.eventCompactPrice, { color: COLORS.white }]}>{priceLabel}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.rescheduleBlockTitle}>{cleanTitle(event.title)}</Text>
                        <Text style={styles.rescheduleBlockTime}>
                          {formatTime(new Date(event.startTime))} - {formatTime(new Date(event.endTime))}
                        </Text>
                        <Text style={[styles.eventPrice, { color: COLORS.white }]}>{priceLabel}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}

            {/* Selected reschedule block */}
            {rescheduleTime ? (() => {
              const endTime = new Date(rescheduleTime.getTime() + duration * 60 * 1000);
              const pos = getEventPosition({ startTime: rescheduleTime.toISOString(), endTime: endTime.toISOString() } as CalendarItem);
              const rIsTiny = duration < 20;
              const rIsCompact = !rIsTiny && duration < 30;
              const priceLabel = getPriceLabel(selectedEvent);
              return (
                <View
                  style={[
                    styles.eventBlock,
                    rIsTiny && styles.eventBlockTiny,
                    rIsCompact && styles.eventBlockCompact,
                    { top: pos.top, height: pos.height, backgroundColor: COLORS.green, borderColor: COLORS.green },
                  ]}>
                  {rIsTiny ? (
                    <View style={styles.eventTinyRow}>
                      <Text style={[styles.eventTinyTitle, { color: COLORS.white }]} numberOfLines={1}>
                        {cleanTitle(selectedEvent.title)}
                      </Text>
                      <Text style={[styles.eventTinyPrice, { color: COLORS.white }]}>{priceLabel}</Text>
                    </View>
                  ) : rIsCompact ? (
                    <>
                      <Text style={[styles.eventCompactTitle, { color: COLORS.white }]} numberOfLines={1}>
                        {cleanTitle(selectedEvent.title)}
                      </Text>
                      <Text style={[styles.eventCompactPrice, { color: COLORS.white }]}>{priceLabel}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.rescheduleBlockTitle}>{cleanTitle(selectedEvent.title)}</Text>
                      <Text style={styles.rescheduleBlockTime}>
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
      </Modal>
    );
  }

  function renderLocationSheet() {
    if (sheet !== 'location') return null;
    const defaultRegion = {
      latitude: mapCoords?.latitude ?? 37.7749,
      longitude: mapCoords?.longitude ?? -122.4194,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSheet('edit')}>
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
      </Modal>
    );
  }

  function renderInviteesSheet() {
    if (sheet !== 'invitees') return null;
    const filteredContacts = contacts.filter((contact) =>
      contact.displayName.toLowerCase().includes(inviteeSearch.toLowerCase())
    );
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSheet('edit')}>
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
                <Image
                  source={person.avatar ? { uri: person.avatar } : Avatar}
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
      </Modal>
    );
  }

  function renderDeleteDialog() {
    if (!deleteConfirm) return null;
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.confirmOverlay}>
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
      </Modal>
    );
  }

  function renderRemoveInviteeDialog() {
    if (!removeInvitee) return null;
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.confirmOverlay}>
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
      </Modal>
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

const TopBar = ({
  title,
  onBack,
  insetsTop,
}: {
  title: string;
  onBack: () => void;
  insetsTop: number;
}) => (
  <View style={[styles.topBar, { paddingTop: Math.max(insetsTop + v(24), v(54)) }]}>
    <TouchableOpacity onPress={onBack}>
      <BackGlyph />
    </TouchableOpacity>
    <Text style={styles.topTitle}>{title}</Text>
    <View style={{ width: h(32) }} />
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
      <BackGlyph size={25} />
    </TouchableOpacity>
    <Text style={styles.editTitle}>{title}</Text>
    {onSave ? (
      <TouchableOpacity onPress={onSave}>
        <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    ) : (
      <View style={{ width: h(48) }} />
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

const MonthGrid = ({
  monthDate,
  selectedDate,
  onSelect,
  compact,
}: {
  monthDate: Date;
  selectedDate: Date;
  onSelect: (day: Date) => void;
  compact?: boolean;
}) => {
  const cells = getMonthCells(monthDate);
  const weeks: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return (
    <View style={[styles.monthGrid, compact && styles.monthGridCompact]}>
      <Text style={[styles.monthGridTitle, compact && styles.monthGridTitleCompact]}>
        {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </Text>
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
    <MiniIcon type={icon} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
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
}) => (
  <View style={styles.personBubble}>
    <Image source={person.avatar ? { uri: person.avatar } : Avatar} style={styles.personAvatar} />
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

function formatMonthRange(date: Date) {
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const currentLabel = date.toLocaleDateString('en-US', { month: 'short' });
  const nextLabel = nextMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${currentLabel} - ${nextLabel}`;
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
  const top = v(10) + (minutes / 60) * v(80);
  // 15 min = v(20) — matches the minimum getDurationMinutes returns
  const height = Math.max(v(20), (getDurationMinutes(event) / 60) * v(80));
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
  connectEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: h(16),
    paddingBottom: v(140),
  },
  connectIconCircle: {
    width: h(104),
    height: h(104),
    borderRadius: h(52),
    backgroundColor: '#EDF1F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: v(28),
  },
  connectTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(30),
    textAlign: 'center',
    marginBottom: v(11),
  },
  connectText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
    lineHeight: ms(24),
    textAlign: 'center',
    marginBottom: v(28),
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: v(120),
  },
  primaryButton: {
    height: v(58),
    borderRadius: h(29),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginHorizontal: h(16),
  },
  primaryButtonText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(20) },
  disabledButton: { opacity: 0.55 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(16),
    marginBottom: v(32),
  },
  topTitle: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(27),
    textAlign: 'center',
  },
  providerList: { gap: v(12), paddingHorizontal: h(16) },
  providerCard: {
    height: v(72),
    borderRadius: h(16),
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(20),
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  providerCardSelected: { borderColor: '#CBE985' },
  providerText: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(17),
    marginLeft: h(16),
  },
  connectContinue: {
    position: 'absolute',
    left: h(16),
    right: h(16),
    bottom: v(43),
    marginHorizontal: 0,
  },
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
  monthChevron: { color: COLORS.ink, fontSize: ms(15), marginLeft: h(7), marginTop: v(3) },
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
  timelineRow: { height: v(80), flexDirection: 'row', alignItems: 'flex-start' },
  hourText: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(13), width: h(65) },
  hourLine: { flex: 1, height: 1, backgroundColor: COLORS.line, marginTop: v(10) },
  unavailBand: {
    position: 'absolute',
    left: h(65),
    right: 0,
    backgroundColor: '#F0F2F6',
    opacity: 0.75,
  },
  eventBlock: {
    position: 'absolute',
    left: h(72),
    right: 0,
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
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: h(16),
    marginBottom: v(10),
  },
  weekLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
    width: h(38),
    textAlign: 'center',
  },
  monthViewContainer: {
    flex: 1,
    paddingBottom: v(90),
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(16),
    marginBottom: v(8),
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
    paddingTop: v(16),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: h(64),
    height: v(4),
    borderRadius: h(2),
    backgroundColor: COLORS.line,
    marginBottom: v(19),
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: v(28),
  },
  sheetTitle: { color: COLORS.ink, fontFamily: 'Inter_700Bold', fontSize: ms(27) },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: v(26),
  },
  detailEventName: { color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(22), flex: 1 },
  badges: { flexDirection: 'row', gap: h(8) },
  confirmBadge: {
    overflow: 'hidden',
    color: '#65840E',
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(15),
    paddingHorizontal: h(12),
    paddingVertical: v(5),
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
  },
  freeBadge: {
    overflow: 'hidden',
    color: '#65840E',
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(15),
    paddingHorizontal: h(14),
    paddingVertical: v(5),
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', minHeight: v(38) },
  detailLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
    marginLeft: h(10),
  },
  detailValue: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
    textAlign: 'right',
  },
  inviteesTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(22),
    marginBottom: v(12),
  },
  peopleRail: { gap: h(16), paddingBottom: v(10) },
  personBubble: { width: h(82), alignItems: 'center' },
  personAvatar: { width: h(64), height: h(64), borderRadius: h(32) },
  personName: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
    lineHeight: ms(18),
    textAlign: 'center',
    marginTop: v(8),
  },
  personCheck: {
    position: 'absolute',
    right: h(6),
    top: h(45),
    width: h(20),
    height: h(20),
    borderRadius: h(10),
    backgroundColor: '#7EA9DB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personCheckText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(11) },
  personRemove: {
    position: 'absolute',
    right: h(2),
    top: 0,
    width: h(22),
    height: h(22),
    borderRadius: h(11),
    backgroundColor: '#FF5B66',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personRemoveText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(14) },
  personAdd: {
    position: 'absolute',
    right: h(2),
    top: 0,
    width: h(22),
    height: h(22),
    borderRadius: h(11),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personAddText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(15) },
  foodCard: {
    marginTop: v(20),
    height: v(76),
    borderRadius: h(15),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(14),
  },
  foodIcon: {
    width: h(50),
    height: h(50),
    borderRadius: h(25),
    backgroundColor: '#F4F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: h(14),
  },
  foodTextWrap: { flex: 1 },
  foodTitle: { color: COLORS.ink, fontFamily: 'Inter_700Bold', fontSize: ms(20) },
  foodText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
    lineHeight: ms(20),
  },
  chevron: { color: COLORS.pale, fontFamily: 'Inter_400Regular', fontSize: ms(38) },
  editSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: h(26),
    borderTopRightRadius: h(26),
    paddingHorizontal: h(16),
    paddingTop: v(16),
    maxHeight: '92%',
  },
  editHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: v(24) },
  editTitle: {
    flex: 1,
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(22),
    marginLeft: h(10),
  },
  saveText: { color: COLORS.green, fontFamily: 'Inter_400Regular', fontSize: ms(18) },
  fieldLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
    marginBottom: v(10),
    marginTop: v(12),
  },
  largeInput: {
    height: v(58),
    borderRadius: h(28),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(20),
    paddingHorizontal: h(20),
    marginBottom: v(14),
  },
  largeInputReadonly: {
    height: v(58),
    borderRadius: h(28),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(20),
    marginBottom: v(14),
  },
  readonlyText: { flex: 1, color: COLORS.ink, fontFamily: 'Inter_400Regular', fontSize: ms(19) },
  chevronSmall: { color: COLORS.ink, fontSize: ms(30) },
  addInviteeBubble: {
    width: h(82),
    height: v(112),
    borderRadius: h(41),
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.softLine,
  },
  addInviteePlus: {
    width: h(64),
    height: h(64),
    borderRadius: h(32),
    backgroundColor: COLORS.green,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: h(64),
    fontFamily: 'Inter_400Regular',
    fontSize: ms(38),
  },
  addInviteeText: {
    color: COLORS.green,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(15),
    marginTop: v(8),
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: v(16),
  },
  segment: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: h(28) },
  segmentItem: {
    height: v(50),
    paddingHorizontal: h(22),
    borderRadius: h(25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: COLORS.green },
  segmentText: { color: '#8E98A2', fontFamily: 'Inter_400Regular', fontSize: ms(19) },
  segmentTextActive: { color: COLORS.white },
  deleteButton: {
    height: v(58),
    borderRadius: h(29),
    backgroundColor: COLORS.greyButton,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: h(10),
    marginTop: v(22),
  },
  deleteButtonText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(20) },
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
  icloudOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,25,39,0.42)',
    paddingHorizontal: h(24),
  },
  icloudCard: {
    width: '100%',
    borderRadius: h(24),
    backgroundColor: COLORS.white,
    padding: h(22),
  },
  icloudTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(24),
    marginBottom: v(8),
  },
  icloudText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
    lineHeight: ms(22),
    marginBottom: v(16),
  },
  icloudInput: {
    height: v(56),
    borderRadius: h(28),
    borderWidth: 1,
    borderColor: COLORS.softLine,
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
    paddingHorizontal: h(18),
    marginBottom: v(12),
  },
  icloudActions: { flexDirection: 'row', gap: h(10), marginTop: v(6) },
  icloudCancel: {
    flex: 1,
    height: v(50),
    borderRadius: h(25),
    borderWidth: 1,
    borderColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icloudConnect: {
    flex: 1,
    height: v(50),
    borderRadius: h(25),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icloudCancelText: { color: COLORS.green, fontFamily: 'Inter_700Bold', fontSize: ms(16) },
  icloudConnectText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: ms(16) },
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
