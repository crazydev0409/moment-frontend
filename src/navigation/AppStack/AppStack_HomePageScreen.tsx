import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Text,
  Image,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppStackParamList } from '.';

import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import {
  Avatar,
  SearchIcon,
  WeClearSky,
  WeFoggy,
  WePartlyCloudy,
  WeRainy,
  WeSnowy,
  WeRainShower,
  WeSnowShower,
  WeThunderstorm,
} from '~/lib/images';
import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';
import { hashPhoneNumber } from '~/utils/phoneHash';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_HomePageScreen'>;
type MeetingFilter = 'all' | 'needsAttention' | 'comingUp';

const COLORS = {
  background: '#F3F6FA',
  ink: '#171927',
  muted: '#6F7780',
  pale: '#AEB9C4',
  line: '#E8EDF2',
  green: '#9AC51F',
  lightGreen: '#EAF4CE',
  dark: '#171927',
  white: '#FFFFFF',
  orange: '#E99023',
  purple: '#7A52FF',
};

const h = (size: number) => horizontalScale(size);
const v = (size: number) => verticalScale(size);
const ms = (size: number) => moderateScale(size, 0.2);

interface DateItem {
  day: string;
  date: number;
  fullDate: Date;
}

interface MomentRequest {
  id: string;
  senderId: string;
  receiverId: string;
  startTime: string;
  endTime: string;
  status: string;
  meetingType?: string;
  title?: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    name: string;
    phoneNumber: string;
    avatar?: string;
  };
  receiver?: {
    id: string;
    name: string;
    phoneNumber: string;
    avatar?: string;
  };
}

// Helper functions to replace date-fns
const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

const isAfter = (date1: Date, date2: Date) => {
  return date1.getTime() > date2.getTime();
};

// Deterministic hash: same input → same output across all devices (for progress value)
const hashToProgress = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const normalized = Math.abs(hash) / 2147483647;
  return 0.25 + normalized * 0.75; // 0.25 to 1
};

const formatDate = (date: Date, formatStr: string): string => {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const fullMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const day = date.getDate();
  const month = date.getMonth();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const getOrdinalSuffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    const displayMinutes = m.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  switch (formatStr) {
    case 'd':
      return day.toString();
    case 'MMMM':
      return fullMonths[month];
    case 'MMM do':
      return `${months[month]} ${day}${getOrdinalSuffix(day)}`;
    case 'h:mm':
      return formatTime(hours, minutes).replace(/ [AP]M$/, '');
    case 'h:mm a':
      return formatTime(hours, minutes);
    default:
      return date.toISOString();
  }
};

const ProfileGlyph = ({ size = 31, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Circle cx="16" cy="9.5" r="5.5" stroke={color} strokeWidth="3" />
    <Path
      d="M6.5 28v-5.5c0-4.2 3.4-7.5 7.5-7.5h4c4.1 0 7.5 3.3 7.5 7.5V28"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </Svg>
);

const BellGlyph = ({ size = 32, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M25 22.5H7c1.8-2.1 2.4-4.8 2.4-8.1C9.4 10.3 12 7 16 7s6.6 3.3 6.6 7.4c0 3.3.6 6 2.4 8.1Z"
      stroke={color}
      strokeWidth="2.7"
      strokeLinejoin="round"
    />
    <Path
      d="M13.2 23.2c.4 2 1.3 3 2.8 3s2.4-1 2.8-3"
      stroke={color}
      strokeWidth="2.7"
      strokeLinecap="round"
    />
    <Path d="M16 4.8v2" stroke={color} strokeWidth="2.7" strokeLinecap="round" />
  </Svg>
);

const ClockGlyph = ({ size = 14, color = COLORS.muted }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.8" />
    <Path
      d="M8 4.6V8l2.5 1.7"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const PinGlyph = ({ size = 14, color = COLORS.muted }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path
      d="M8 14s4.5-4.1 4.5-7.2A4.5 4.5 0 0 0 3.5 6.8C3.5 9.9 8 14 8 14Z"
      stroke={color}
      strokeWidth="1.8"
    />
    <Circle cx="8" cy="6.8" r="1.4" stroke={color} strokeWidth="1.8" />
  </Svg>
);

const GlobeGlyph = ({ size = 15, color = COLORS.pale }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Circle cx="8" cy="8" r="6.2" stroke={color} strokeWidth="1.7" />
    <Path
      d="M2 8h12M8 2c1.7 1.8 2.5 3.8 2.5 6S9.7 12.2 8 14M8 2C6.3 3.8 5.5 5.8 5.5 8S6.3 12.2 8 14"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </Svg>
);

const NeedsAttentionGlyph = ({ size = 14, color = COLORS.green }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path
      d="M3 3.5C1.6 5 .8 6.8.8 8.5s.8 3.5 2.2 5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <Path
      d="M13 3.5c1.4 1.5 2.2 3.3 2.2 5s-.8 3.5-2.2 5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <Path d="M8 4v5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <Circle cx="8" cy="12" r="1" fill={color} />
  </Svg>
);

const ComingUpGlyph = ({ size = 14, color = COLORS.green }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path
      d="M3 3C1.6 4.5.8 6.2.8 8s.8 3.5 2.2 5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <Path
      d="M13 3c1.4 1.5 2.2 3.2 2.2 5s-.8 3.5-2.2 5"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <Circle cx="8" cy="8" r="3.5" stroke={color} strokeWidth="1.5" />
    <Path
      d="M8 6v2.5l1.5 1"
      stroke={color}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CarGlyph = ({ size = 43, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <Path
      d="M9 29h30v9H9zM14 20h20l5 9H9l5-9Z"
      stroke={color}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <Circle cx="16" cy="38" r="3" fill={color} />
    <Circle cx="32" cy="38" r="3" fill={color} />
    <Path d="M17 24h14" stroke={color} strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

const WeatherCloudGlyph = ({ size = 44, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <Path
      d="M15 35h21a8 8 0 0 0 .5-16 12 12 0 0 0-22.7 3.3A6.5 6.5 0 0 0 15 35Z"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M12 8v4M5 15h4M10 10l3 3" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

const EmptyScheduleIllustration = () => (
  <Svg width={h(130)} height={h(130)} viewBox="0 0 214 214" fill="none">
    <Path
      d="M63 59c23-31 74-20 96 7 29 35 27 98-15 121-37 20-93 8-111-29-15-32 7-69 30-99Z"
      fill="#CAE67C"
    />
    <Path
      d="M41 76c25 7 54-12 59-28M63 47c33 14 64 16 80 1 14 17 45 18 46-3"
      stroke={COLORS.ink}
      strokeWidth="8"
      strokeLinecap="round"
    />
    <Path
      d="M73 114c22-2 39-3 62-3M142 110c18-1 26-1 39-2M93 92l14-12M157 81l14 13M126 145c7-14 16-25 30-36"
      stroke={COLORS.ink}
      strokeWidth="8"
      strokeLinecap="round"
    />
    <Path
      d="M101 113c1 12 4 17 12 5M166 109c-1 11-5 15-12 5"
      stroke={COLORS.ink}
      strokeWidth="8"
      strokeLinecap="round"
    />
  </Svg>
);

const AppStack_HomePageScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dates, setDates] = useState<DateItem[]>([]);
  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState<MeetingFilter>('comingUp');
  const [insightSlide, setInsightSlide] = useState<'traffic' | 'ride'>('traffic');

  // Toast state
  const [toast, setToast] = useState<{ title: string; subtitle: string; calendarDate?: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const dateScrollRef = useRef<ScrollView>(null);

  const showToast = useCallback((toastData: { title: string; subtitle: string; calendarDate?: string }) => {
    setToast(toastData);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.delay(3500),
      Animated.timing(toastAnim, {
        toValue: -150,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  useEffect(() => {
    const toastData = route.params?.toast;
    if (toastData) {
      navigation.setParams({ toast: undefined } as any);
      showToast(toastData);
    }
  }, [route.params?.toast, showToast]);

  // Meetings data
  const [allMeetings, setAllMeetings] = useState<MomentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Weather data
  const [weather, setWeather] = useState<{
    temperature: number;
    description: string;
    icon: any;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Location data
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Local contact avatars mapping (phone number -> avatar URI)
  const [localAvatars, setLocalAvatars] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Generate dates for the current week
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startOfWeek = new Date(today);

    // Calculate days to go back to Monday
    // Monday = 1, Sunday = 0 (need to go back 6 days for Sunday)
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(today.getDate() - daysFromMonday);

    const weekDates: DateItem[] = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push({
        day: dayNames[i],
        date: date.getDate(),
        fullDate: date,
      });
    }

    setDates(weekDates);
    setSelectedDate(today);

    // Scroll so today's pill is centered in the rail
    const pillWidth = horizontalScale(52);
    const gap = horizontalScale(12);
    const pillStep = pillWidth + gap;
    const railViewWidth = Dimensions.get('window').width - 2 * horizontalScale(16);
    const scrollX = Math.max(0, daysFromMonday * pillStep - (railViewWidth / 2 - pillWidth / 2));
    setTimeout(() => {
      dateScrollRef.current?.scrollTo({ x: scrollX, animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    fetchUserData();
    fetchMeetings();
    fetchUnreadNotificationCount();
    requestLocationAndFetchWeather();
    loadLocalContactAvatars();
  }, []);

  // Refresh meetings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchMeetings();
      fetchUnreadNotificationCount();
    }, [])
  );

  // Fetch weather when selected date changes
  useEffect(() => {
    if (location) {
      fetchWeather(location.latitude, location.longitude);
    }
  }, [selectedDate, location]);

  // Listen for notifications and refresh meetings when moment-related notifications are received
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      const eventType = data.eventType || data.type;

      // Refresh meetings when moment-related events occur
      if (
        eventType === 'moment.request.created' ||
        eventType === 'moment.request.approved' ||
        eventType === 'moment.request.rejected' ||
        eventType === 'moment.request.canceled' ||
        eventType === 'moment.updated' ||
        eventType === 'moment.deleted'
      ) {
        console.log('📬 Moment-related notification received, refreshing meetings...');
        fetchMeetings();
        fetchUnreadNotificationCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Listen for Socket.IO events and refresh meetings when moment-related events occur
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let reconnectHandler: (() => void) | null = null;
    let isMounted = true;

    const setupSocketListeners = async () => {
      if (!isMounted) return;

      let socket = getSocket();

      // If socket is not available, try to initialize it
      if (!socket) {
        console.log('[HomePage] Socket not available, attempting to initialize...');
        socket = await initializeSocket();

        if (!socket || !isMounted) {
          console.log('[HomePage] Failed to initialize socket or component unmounted');
          return;
        }
      }

      // Set up listeners when socket connects
      const setupOnConnect = () => {
        if (!isMounted) return;

        const currentSocket = getSocket();
        if (!currentSocket || !currentSocket.connected) {
          console.log('[HomePage] Socket not connected, waiting...');
          return;
        }

        console.log('[HomePage] Setting up Socket.IO event listeners...');

        // Clean up previous listeners if any
        if (cleanup) {
          cleanup();
        }

        cleanup = setupSocketEventListeners({
          // Meeting created → receiver gets update
          onMomentRequest: (data) => {
            console.log('[HomePage] 📬 Meeting created - refreshing...');
            fetchMeetings();
            fetchUnreadNotificationCount();
            // Visible in-app feedback in addition to the (silent) badge-count
            // refresh above — the badge alone is easy to miss, especially
            // while push notifications are unavailable (Expo Go, simulators).
            showToast({
              title: 'New meeting request',
              subtitle: `${data.senderName || 'Someone'} invited you to "${data.title || 'a meeting'}"`,
              calendarDate: data.startTime
                ? new Date(data.startTime).toISOString().split('T')[0]
                : undefined,
            });
          },
          // Meeting accepted/rejected → sender gets update
          onMomentResponse: (data) => {
            console.log('[HomePage] ✅ Meeting accepted/rejected socket event received:', {
              eventType: data.eventType,
              momentRequestId: data.momentRequestId,
              senderId: data.senderId,
              receiverId: data.receiverId,
              fullData: data,
            });

            // Determine status from eventType
            const newStatus =
              data.eventType === 'moment.request.approved' ? 'approved' : 'rejected';
            console.log('[HomePage] New status:', newStatus);

            // Immediately update the request status in state if request exists
            if (data.momentRequestId) {
              setAllMeetings((prev) => {
                const updated = prev.map((meeting) => {
                  if (meeting.id === data.momentRequestId) {
                    console.log('[HomePage] Found request in state, updating status:', meeting.id);
                    return {
                      ...meeting,
                      status: newStatus,
                    };
                  }
                  return meeting;
                });
                console.log('[HomePage] Updated meetings count:', updated.length);
                return updated;
              });
            } else {
              console.warn('[HomePage] No momentRequestId in socket data');
            }

            // Always refetch to ensure consistency (even if request wasn't in state)
            setTimeout(() => {
              console.log('[HomePage] Refetching meetings after socket event...');
              fetchMeetings();
              fetchUnreadNotificationCount();
            }, 1000);

            // Visible in-app feedback, same as the "new request" toast — the
            // sender otherwise has no indication the receiver responded
            // unless they happen to reopen the app or check the badge.
            showToast({
              title: newStatus === 'approved' ? 'Meeting confirmed' : 'Meeting declined',
              subtitle:
                newStatus === 'approved'
                  ? `${data.receiverName || 'They'} confirmed "${data.title || 'your meeting'}"`
                  : `${data.receiverName || 'They'} declined "${data.title || 'your meeting'}"`,
              calendarDate: data.startTime
                ? new Date(data.startTime).toISOString().split('T')[0]
                : undefined,
            });
          },
          // Meeting canceled → receiver gets update
          onMomentCanceled: (data) => {
            console.log('[HomePage] ❌ Meeting canceled - refreshing...');
            fetchMeetings();
            fetchUnreadNotificationCount();
            showToast({
              title: 'Meeting canceled',
              subtitle: `"${data.title || 'A meeting'}" has been canceled`,
              calendarDate: data.startTime
                ? new Date(data.startTime).toISOString().split('T')[0]
                : undefined,
            });
          },
        });
      };

      // If socket is already connected, set up listeners immediately
      if (socket.connected) {
        setupOnConnect();
      } else {
        // Wait for initial connection
        console.log('[HomePage] Socket not connected yet, waiting for connection...');
        socket.once('connect', setupOnConnect);
      }

      // Set up reconnect handler to re-establish listeners on reconnect
      reconnectHandler = () => {
        console.log('[HomePage] Socket reconnected, re-establishing listeners...');
        setupOnConnect();
      };
      socket.on('reconnect', reconnectHandler);
    };

    setupSocketListeners();

    // Cleanup function
    return () => {
      isMounted = false;

      // Remove reconnect handler
      if (reconnectHandler) {
        const socket = getSocket();
        if (socket) {
          socket.off('reconnect', reconnectHandler);
        }
      }

      // Clean up event listeners
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await http.get('/users/profile');
      if (response.data && response.data.id) {
        setUserId(response.data.id);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // User ID not critical for rendering, so continue without it
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      // Fetch both received and sent moment requests using existing endpoints
      const [receivedResponse, sentResponse] = await Promise.all([
        http.get('/users/moment-requests/received'),
        http.get('/users/moment-requests/sent'),
      ]);

      // Backend returns { requests: [...] } for both endpoints
      const received = Array.isArray(receivedResponse.data.requests)
        ? receivedResponse.data.requests
        : [];
      const sent = Array.isArray(sentResponse.data.requests) ? sentResponse.data.requests : [];
      const allMeetings = [...received, ...sent];

      setAllMeetings(allMeetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setAllMeetings([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadNotificationCount = async () => {
    try {
      const response = await http.get('/users/notifications?unreadOnly=true&limit=1');
      setUnreadNotificationCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
    }
  };

  const loadLocalContactAvatars = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();

      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.Image, Contacts.Fields.PhoneNumbers],
        });

        // Create a map of hashed phone numbers to local contact avatars
        const phoneToAvatarMap = new Map<string, string>();

        // Process contacts sequentially or in parallel? Parallel is faster.
        await Promise.all(
          data.map(async (contact) => {
            if (contact.phoneNumbers && contact.phoneNumbers.length > 0 && contact.image?.uri) {
              const avatarUri = contact.image.uri;
              await Promise.all(
                contact.phoneNumbers.map(async (phone) => {
                  // Normalize phone number
                  const normalized = phone.number?.replace(/[\s\-()]/g, '') || '';
                  if (normalized && avatarUri) {
                    // Determine if it already looks like a hash or needs hashing
                    // During transition, some might be raw, some might be hashed
                    // But specifically for local contacts, we ALWAYS hash them to match backend hashes
                    const hashed = await hashPhoneNumber(normalized);
                    phoneToAvatarMap.set(hashed, avatarUri);
                  }
                })
              );
            }
          })
        );

        setLocalAvatars(phoneToAvatarMap);
      }
    } catch (error) {
      console.error('Error loading local contact avatars:', error);
    }
  };

  const requestLocationAndFetchWeather = async () => {
    try {
      // Check if location permission is already granted (requested at app initialization)
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.log('Location permission not granted, using default location');
        // Fall back to default location (London)
        const defaultLocation = { latitude: 51.5074, longitude: -0.1278 };
        setLocation(defaultLocation);
        fetchWeather(defaultLocation.latitude, defaultLocation.longitude);
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      console.log('📍 Location detected:', coords);
      setLocation(coords);
      fetchWeather(coords.latitude, coords.longitude);
    } catch (error) {
      console.error('Error getting location:', error);
      // Fall back to default location
      const defaultLocation = { latitude: 51.5074, longitude: -0.1278 };
      setLocation(defaultLocation);
      fetchWeather(defaultLocation.latitude, defaultLocation.longitude);
    }
  };

  const fetchWeather = async (latitude: number, longitude: number) => {
    try {
      setWeatherLoading(true);
      // Using Open-Meteo API (free, no key required)

      // Get the date string for the selected date
      const dateStr = selectedDate.toISOString().split('T')[0];

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`
      );

      const data = await response.json();

      if (data.daily) {
        const temp = Math.round(data.daily.temperature_2m_max[0]);
        const weatherCode = data.daily.weathercode[0];

        // Map weather codes to descriptions and emojis
        const getWeatherInfo = (code: number) => {
          if (code === 0) return { description: 'Clear sky', icon: WeClearSky };
          if (code <= 3) return { description: 'Partly cloudy', icon: WePartlyCloudy };
          if (code <= 48) return { description: 'Foggy', icon: WeFoggy };
          if (code <= 67) return { description: 'Rainy', icon: WeRainy };
          if (code <= 77) return { description: 'Snowy', icon: WeSnowy };
          if (code <= 82) return { description: 'Rain showers', icon: WeRainShower };
          if (code <= 86) return { description: 'Snow showers', icon: WeSnowShower };
          if (code <= 99) return { description: 'Thunderstorm', icon: WeThunderstorm };
          return { description: 'Cloudy', icon: WePartlyCloudy };
        };

        const weatherInfo = getWeatherInfo(weatherCode);

        setWeather({
          temperature: temp,
          description: weatherInfo.description,
          icon: weatherInfo.icon,
        });
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      // Set default weather on error
      setWeather({
        temperature: 28,
        description: 'Cloudy',
        icon: WePartlyCloudy,
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  // Filter meetings by selected date and new status buckets.
  const getFilteredMeetings = () => {
    if (!allMeetings || !Array.isArray(allMeetings)) return [];
    return allMeetings.filter((meeting) => {
      const meetingDate = new Date(meeting.startTime);
      const dateMatch = isSameDay(meetingDate, selectedDate);
      const isUpcoming = isAfter(meetingDate, new Date());
      const status = meeting.status?.toLowerCase();

      if (!dateMatch) return false;
      if (selectedMeetingFilter === 'needsAttention') return status === 'pending';
      if (selectedMeetingFilter === 'comingUp') return isUpcoming && status === 'approved';
      return status === 'approved' || status === 'pending';
    });
  };

  // Get first confirmed meeting for the selected date
  const getUpcomingMeeting = () => {
    if (!allMeetings || !Array.isArray(allMeetings)) return null;
    const meetings = allMeetings
      .filter((meeting) => {
        const meetingDate = new Date(meeting.startTime);
        return isSameDay(meetingDate, selectedDate) && meeting.status === 'approved';
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return meetings.length > 0 ? meetings[0] : null;
  };

  const filteredMeetings = getFilteredMeetings();
  const upcomingMeeting = getUpcomingMeeting();
  const selectedDateMeetings = useMemo(
    () => allMeetings.filter((meeting) => isSameDay(new Date(meeting.startTime), selectedDate)),
    [allMeetings, selectedDate]
  );
  const hasSelectedDateSchedule = selectedDateMeetings.some(
    (meeting) => meeting.status?.toLowerCase() === 'approved'
  );

  // Deterministic progress value (0.25–1): same seed → same value on all devices
  const progressValue = useMemo(() => {
    const seed =
      upcomingMeeting?.id ?? `${userId || 'default'}-${selectedDate.toISOString().split('T')[0]}`;
    return hashToProgress(seed);
  }, [upcomingMeeting?.id, userId, selectedDate]);

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const formatTimeRange = (meeting: MomentRequest) => {
    const start = new Date(meeting.startTime);
    const end = new Date(meeting.endTime);
    const fmtTime = (d: Date, showPeriod: boolean) => {
      const hrs = d.getHours() % 12 || 12;
      const mins = d.getMinutes().toString().padStart(2, '0');
      const period = d.getHours() >= 12 ? 'pm' : 'am';
      return showPeriod ? `${hrs}:${mins} ${period}` : `${hrs}:${mins}`;
    };
    const startPeriod = start.getHours() >= 12 ? 'pm' : 'am';
    const endPeriod = end.getHours() >= 12 ? 'pm' : 'am';
    return `${fmtTime(start, startPeriod !== endPeriod)}-${fmtTime(end, true)}`;
  };

  const getOtherPerson = (meeting: MomentRequest) =>
    meeting.senderId === userId ? meeting.receiver : meeting.sender;

  const getMeetingDisplayTitle = (meeting: MomentRequest) => {
    const rawTitle = meeting.title || meeting.notes || meeting.meetingType || 'Meeting';
    const otherPersonName = getOtherPerson(meeting)?.name;
    const titlePattern = /(.+):\s*(?:#\s*catch|Meeting\s+with)\s+(.+)/i;
    const match = rawTitle.match(titlePattern);

    if (match) return match[1];
    if (/meeting with/i.test(rawTitle) && otherPersonName) return `Coffee with ${otherPersonName}`;
    return rawTitle;
  };

  const getMeetingLocation = (meeting: MomentRequest) => {
    const text = `${meeting.description || ''} ${meeting.notes || ''}`;
    const placeMatch = text.match(/(?:at|location:)\s*([^,\n]+)/i);
    if (placeMatch?.[1]) return placeMatch[1].trim();
    return meeting.meetingType?.toLowerCase().includes('remote') ? 'Remote' : '';
  };

  const getConfidence = (meeting?: MomentRequest | null) => {
    const seed =
      meeting?.id ?? `${userId || 'default'}-${selectedDate.toISOString().split('T')[0]}`;
    return Math.max(0.25, Math.min(0.99, hashToProgress(seed))).toFixed(2);
  };

  const navigateToMeetingDate = (meeting?: MomentRequest | null) => {
    const targetDate = meeting ? new Date(meeting.startTime) : selectedDate;
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    navigation.navigate('AppStack_CalendarScreen', {
      date: `${year}-${month}-${day}`,
      ...(meeting?.id ? { momentRequestId: meeting.id } : {}),
    });
  };

  const getLocalAvatar = (phoneNumber?: string) => {
    if (!phoneNumber) return null;
    // Since backend returns hashed phone numbers, if phoneNumber is a 64-char hex string,
    // it's already hashed and we can look it up directly.
    // If it's not a hash (legacy data), we would need to hash it, but here we assume
    // it's either the hash from the backend or nothing.
    return localAvatars.get(phoneNumber) || null;
  };

  return (
    <View style={styles.screen}>
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              top: Math.max(insets.top + v(8), v(44)),
              transform: [{ translateY: toastAnim }],
            },
          ]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
            onPress={() => {
              if (toast.calendarDate) {
                navigation.navigate('AppStack_CalendarScreen', { date: toast.calendarDate });
              }
            }}>
            <View style={styles.toastIcon}>
              <Svg width={h(22)} height={h(22)} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 13l4 4L19 7"
                  stroke={COLORS.white}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.toastCopy}>
              <Text style={styles.toastTitle}>{toast.title}</Text>
              <Text style={styles.toastSubtitle}>{toast.subtitle}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + v(18), v(54)),
            paddingBottom: Math.max(insets.bottom + v(130), v(150)),
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AppStack_ProfileScreen')}
            activeOpacity={0.75}
            style={styles.headerButton}>
            <ProfileGlyph />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('AppStack_NotificationScreen')}
            activeOpacity={0.75}
            style={styles.headerButton}>
            <BellGlyph />
            {unreadNotificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={dateScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRail}>
          {dates.map((item) => {
            const selected = isSelected(item.fullDate);
            return (
              <TouchableOpacity
                key={`${item.day}-${item.date}`}
                onPress={() => setSelectedDate(item.fullDate)}
                activeOpacity={0.8}
                style={[styles.datePill, selected && styles.datePillSelected]}>
                <Text style={[styles.dateDay, selected && styles.dateDaySelected]}>{item.day}</Text>
                <View style={[styles.dateBubble, selected && styles.dateBubbleSelected]}>
                  <Text style={styles.dateNumber}>{item.date}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AppStack_SearchScreen')}
          style={styles.searchBar}>
          <Text style={styles.searchPlaceholder}>Search your meetings</Text>
          <Image source={SearchIcon} style={styles.searchIcon} resizeMode="contain" />
        </TouchableOpacity>

        {loading ? (
          <View style={[styles.emptyPanel, styles.loadingWrap]}>
            <ActivityIndicator size="large" color={COLORS.green} />
          </View>
        ) : !hasSelectedDateSchedule ? (
          <View style={styles.emptyPanel}>
            <EmptyScheduleIllustration />
            <Text style={styles.emptyText}>No meetings scheduled</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.scheduleButton}
              onPress={() => {
                const y = selectedDate.getFullYear();
                const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                const d = String(selectedDate.getDate()).padStart(2, '0');
                navigation.navigate('AppStack_SendCatchScreen', {
                  mode: 'one',
                  initialDate: `${y}-${m}-${d}`,
                });
              }}>
              <Text style={styles.scheduleButtonText}>Schedule Meeting</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.upcomingRow}>
              <View style={styles.startDateCard}>
                <Text style={styles.startDateLabel}>Starts on</Text>
                <Text style={styles.startDateNumber}>
                  {upcomingMeeting
                    ? formatDate(new Date(upcomingMeeting.startTime), 'd')
                    : formatDate(selectedDate, 'd')}
                </Text>
                <Text style={styles.startDateMonth}>
                  {upcomingMeeting
                    ? formatDate(new Date(upcomingMeeting.startTime), 'MMMM')
                    : formatDate(selectedDate, 'MMMM')}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigateToMeetingDate(upcomingMeeting)}
                style={styles.previewCard}>
                {upcomingMeeting ? (
                  insightSlide === 'traffic' ? (
                    <>
                      <View style={styles.previewMainRow}>
                        <View style={styles.avatarWrap}>
                          {getLocalAvatar(getOtherPerson(upcomingMeeting)?.phoneNumber) ? (
                            <Image
                              source={{
                                uri:
                                  getLocalAvatar(getOtherPerson(upcomingMeeting)?.phoneNumber) ||
                                  undefined,
                              }}
                              style={styles.avatarImage}
                            />
                          ) : (
                            <Image source={Avatar} style={styles.avatarImage} />
                          )}
                        </View>
                        <View style={styles.previewCopy}>
                          <Text style={styles.previewTitle} numberOfLines={1}>
                            {getMeetingDisplayTitle(upcomingMeeting)}
                          </Text>
                          <View style={styles.metaRow}>
                            <ClockGlyph />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {formatTimeRange(upcomingMeeting)}
                            </Text>
                            <PinGlyph />
                            <Text
                              style={[styles.metaText, styles.metaTextShrink]}
                              numberOfLines={1}>
                              {getMeetingLocation(upcomingMeeting)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.previewDivider} />
                      <View style={styles.confidenceLine}>
                        <Text style={styles.confidenceLabel}>Confidence Score:</Text>
                        <Text style={styles.confidenceValue}>{getConfidence(upcomingMeeting)}</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressValue * 100}%` }]} />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.previewMainRow}>
                        <View style={styles.avatarWrap}>
                          {getLocalAvatar(getOtherPerson(upcomingMeeting)?.phoneNumber) ? (
                            <Image
                              source={{
                                uri:
                                  getLocalAvatar(getOtherPerson(upcomingMeeting)?.phoneNumber) ||
                                  undefined,
                              }}
                              style={styles.avatarImage}
                            />
                          ) : (
                            <Image source={Avatar} style={styles.avatarImage} />
                          )}
                        </View>
                        <View style={styles.previewCopy}>
                          <Text style={styles.previewTitle} numberOfLines={1}>
                            {getMeetingDisplayTitle(upcomingMeeting)}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.confidenceHelpRow, { marginTop: v(10) }]}>
                        <View style={styles.confidenceHelpCopy}>
                          <Text style={styles.confidenceHelpTitle}>Confidence Score</Text>
                          <Text style={styles.confidenceHelpText}>
                            Confidence Score shows how likely this meeting is to happen smoothly
                            based on timing and context.
                          </Text>
                        </View>
                        <View style={styles.infoDot}>
                          <Text style={styles.infoDotText}>i</Text>
                        </View>
                      </View>
                    </>
                  )
                ) : (
                  <Text style={styles.noPreviewText}>No upcoming meeting</Text>
                )}
                <View style={styles.slideDots}>
                  <View style={[styles.dot, insightSlide === 'traffic' && styles.dotActive]} />
                  <View style={[styles.dot, insightSlide === 'ride' && styles.dotActive]} />
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setInsightSlide(insightSlide === 'traffic' ? 'ride' : 'traffic')}
              style={styles.insightCard}>
              {insightSlide === 'traffic' ? (
                <>
                  <View style={styles.insightTextColumn}>
                    <View style={styles.trafficChip}>
                      <Text style={styles.trafficChipText}>Heavy traffic</Text>
                    </View>
                    <Text style={styles.trafficDistance}>1.2 km away</Text>
                    <Text style={styles.trafficPlace}>Gardiner Expressway Near CN Tower</Text>
                    <Text style={styles.trafficSource}>4 min ago by OneLoner</Text>
                  </View>
                  <View style={styles.carCircle}>
                    <CarGlyph />
                  </View>
                </>
              ) : (
                <View style={styles.rideContent}>
                  <Text style={styles.rideTitle}>Need a ride?</Text>
                  <Text style={styles.rideSubtitle}>
                    Book a ride in seconds and arrive stress-free.
                  </Text>
                  {['Uber', 'Lyft'].map((provider) => (
                    <View key={provider} style={styles.rideProvider}>
                      <View style={[styles.providerLogo, provider === 'Lyft' && styles.lyftLogo]}>
                        <Text style={styles.providerLogoText}>
                          {provider === 'Uber' ? 'U' : 'lyft'}
                        </Text>
                      </View>
                      <Text style={styles.providerName}>{provider}</Text>
                      <Text style={styles.providerArrow}>{'>'}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.insightDots}>
                <View
                  style={[styles.darkDot, insightSlide === 'traffic' && styles.darkDotActive]}
                />
                <View style={[styles.darkDot, insightSlide === 'ride' && styles.darkDotActive]} />
              </View>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.weatherCard}>
          {weatherLoading ? (
            <ActivityIndicator size="small" color={COLORS.green} />
          ) : (
            <>
              <Text style={styles.weatherTemp}>{weather ? `${weather.temperature}°` : '11°'}</Text>
              <View style={styles.weatherCopy}>
                <Text style={styles.weatherTitle}>{weather?.description || 'Partly Cloudy'}</Text>
                <Text style={styles.weatherDate}>{formatDate(selectedDate, 'MMM do')}</Text>
              </View>
              {weather?.icon ? (
                <Image source={weather.icon} style={styles.weatherIcon} resizeMode="contain" />
              ) : (
                <WeatherCloudGlyph />
              )}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Your Meetings</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}>
          {[
            { id: 'all' as MeetingFilter, label: 'All' },
            { id: 'needsAttention' as MeetingFilter, label: 'Needs Attention' },
            { id: 'comingUp' as MeetingFilter, label: 'Coming Up' },
          ].map((filter) => {
            const selected = selectedMeetingFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setSelectedMeetingFilter(filter.id)}
                activeOpacity={0.8}
                style={[styles.filterPill, selected && styles.filterPillSelected]}>
                <View style={[styles.filterDot, selected && styles.filterDotSelected]}>
                  {selected && filter.id === 'all' && (
                    <NeedsAttentionGlyph size={h(11)} />
                  )}
                  {selected && filter.id === 'needsAttention' && (
                    <NeedsAttentionGlyph size={h(11)} />
                  )}
                  {selected && filter.id === 'comingUp' && (
                    <ComingUpGlyph size={h(11)} />
                  )}
                </View>
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.meetingList}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.green} />
            </View>
          ) : filteredMeetings.length > 0 ? (
            filteredMeetings.map((meeting) => {
              const otherPerson = getOtherPerson(meeting);
              const localAvatar = getLocalAvatar(otherPerson?.phoneNumber);
              const isPending = meeting.status?.toLowerCase() === 'pending';
              const isPaid = Boolean(meeting.meetingType?.toLowerCase().includes('paid'));
              const confidence = getConfidence(meeting);

              return (
                <TouchableOpacity
                  key={meeting.id}
                  style={styles.meetingCard}
                  activeOpacity={0.82}
                  onPress={() => navigateToMeetingDate(meeting)}>
                  <View style={styles.meetingTopRow}>
                    <Text style={styles.meetingTitle} numberOfLines={1}>
                      {getMeetingDisplayTitle(meeting)}
                    </Text>
                    <View style={styles.meetingBadges}>
                      <View style={[styles.statusBadge, isPending && styles.pendingBadge]}>
                        <Text
                          style={[styles.statusBadgeText, isPending && styles.pendingBadgeText]}>
                          {isPending ? 'Pending' : 'Confirmed'}
                        </Text>
                      </View>
                      <View style={[styles.priceBadge, isPaid && styles.paidBadge]}>
                        <Text style={[styles.priceBadgeText, isPaid && styles.paidBadgeText]}>
                          {isPaid ? '$20' : 'Free'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.meetingDetailRow}>
                    <ClockGlyph color={COLORS.pale} />
                    <Text style={styles.meetingDetailText}>{formatTimeRange(meeting)}</Text>
                  </View>
                  <View style={styles.meetingDetailRow}>
                    <GlobeGlyph />
                    <Text style={styles.meetingDetailText}>
                      {meeting.meetingType?.toLowerCase().includes('remote')
                        ? 'Remote'
                        : 'In-person'}
                    </Text>
                  </View>
                  {!meeting.meetingType?.toLowerCase().includes('remote') && (
                    <View style={styles.meetingDetailRow}>
                      <PinGlyph color={COLORS.pale} />
                      <Text style={styles.meetingDetailText}>{getMeetingLocation(meeting)}</Text>
                    </View>
                  )}

                  <View style={styles.attendeeRow}>
                    {Array.from({ length: Math.min(4, filteredMeetings.length + 1) }).map(
                      (_, index) => (
                        <View
                          key={`${meeting.id}-avatar-${index}`}
                          style={[styles.smallAvatar, { marginLeft: index === 0 ? 0 : -h(8) }]}>
                          {index === 0 && localAvatar ? (
                            <Image source={{ uri: localAvatar }} style={styles.smallAvatarImage} />
                          ) : (
                            <Image source={Avatar} style={styles.smallAvatarImage} />
                          )}
                        </View>
                      )
                    )}
                  </View>

                  <View style={styles.cardDivider} />
                  <View style={styles.confidenceLine}>
                    <Text style={styles.confidenceLabel}>Confidence Score:</Text>
                    <Text style={styles.confidenceValue}>{confidence}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[styles.progressFill, { width: `${Number(confidence) * 100}%` }]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noMeetingsInline}>
              <Text style={styles.noMeetingsInlineText}>No meetings scheduled</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  toastContainer: {
    position: 'absolute',
    left: h(16),
    right: h(16),
    zIndex: 100,
    backgroundColor: COLORS.white,
    borderRadius: h(18),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: h(14),
    paddingVertical: v(14),
    shadowColor: '#1C2330',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  toastIcon: {
    width: h(42),
    height: h(42),
    borderRadius: h(21),
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: h(12),
  },
  toastCopy: {
    flex: 1,
  },
  toastTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(16),
    lineHeight: ms(21),
  },
  toastSubtitle: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    marginTop: v(2),
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: h(16),
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: v(20),
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: h(28),
    height: h(56),
    justifyContent: 'center',
    shadowColor: '#1C2330',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    width: h(56),
  },
  notificationBadge: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: h(8),
    height: h(16),
    justifyContent: 'center',
    minWidth: h(16),
    position: 'absolute',
    right: h(5),
    top: h(5),
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(8),
  },
  dateRail: {
    gap: h(8),
    paddingRight: h(24),
  },
  datePill: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(30),
    borderWidth: 1,
    height: v(64),
    justifyContent: 'space-between',
    paddingBottom: v(3),
    paddingTop: v(8),
    width: h(46),
  },
  datePillSelected: {
    backgroundColor: COLORS.ink,
  },
  dateDay: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
    lineHeight: ms(17),
  },
  dateDaySelected: {
    color: COLORS.white,
  },
  dateBubble: {
    alignItems: 'center',
    backgroundColor: '#EEF1F4',
    borderRadius: h(19),
    height: h(38),
    justifyContent: 'center',
    width: h(38),
  },
  dateBubbleSelected: {
    backgroundColor: COLORS.white,
  },
  dateNumber: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
    lineHeight: ms(23),
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(25),
    borderWidth: 1,
    flexDirection: 'row',
    height: v(48),
    marginTop: v(16),
    paddingHorizontal: h(16),
  },
  searchPlaceholder: {
    color: '#A8B3BF',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
  },
  searchIcon: {
    height: h(20),
    tintColor: '#A8B3BF',
    width: h(20),
  },
  emptyPanel: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(20),
    borderWidth: 1,
    marginTop: v(16),
    paddingBottom: v(22),
    paddingHorizontal: h(24),
    paddingTop: v(28),
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
    marginBottom: v(16),
    marginTop: v(8),
  },
  scheduleButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: COLORS.green,
    borderRadius: h(25),
    height: v(50),
    justifyContent: 'center',
  },
  scheduleButtonText: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(18),
  },
  upcomingRow: {
    flexDirection: 'row',
    gap: h(9),
    marginTop: v(22),
  },
  startDateCard: {
    alignItems: 'center',
    backgroundColor: COLORS.green,
    borderRadius: h(18),
    height: v(142),
    justifyContent: 'center',
    width: h(86),
  },
  startDateLabel: {
    color: COLORS.white,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
  },
  startDateNumber: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(31),
    lineHeight: ms(40),
    marginVertical: v(6),
  },
  startDateMonth: {
    color: COLORS.white,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(17),
  },
  previewCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(18),
    borderWidth: 1,
    flex: 1,
    // Fixed (not minHeight) so this always matches startDateCard's height
    // exactly, since they sit side-by-side in the same row.
    height: v(142),
    // Extra bottom padding (beyond the h(14) used on the other three sides)
    // reserves clear space for the absolutely-positioned slideDots below, so
    // they don't crowd the confidence score bar, which is otherwise the last
    // element in normal flow right above them.
    paddingBottom: v(26),
    paddingHorizontal: h(14),
    paddingTop: h(14),
  },
  previewMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatarWrap: {
    borderRadius: h(22),
    height: h(44),
    marginRight: h(10),
    overflow: 'hidden',
    width: h(44),
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(17),
    lineHeight: ms(21),
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: h(4),
    marginTop: v(5),
  },
  metaText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(12),
  },
  // Only the location text is allowed to shrink/truncate — the clock icon,
  // time, and pin icon stay full width so a long location name can no
  // longer push the whole row past the card's edge (it was overflowing the
  // card's right border instead of wrapping or truncating).
  metaTextShrink: {
    flexShrink: 1,
  },
  previewDivider: {
    backgroundColor: COLORS.line,
    height: 1,
    marginVertical: v(10),
  },
  confidenceLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
  },
  confidenceValue: {
    color: '#6F8E13',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(14),
  },
  progressTrack: {
    backgroundColor: '#EDF1F4',
    borderRadius: h(6),
    height: v(10),
    marginTop: v(9),
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: COLORS.green,
    borderRadius: h(6),
    height: '100%',
  },
  confidenceHelpRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  confidenceHelpCopy: {
    flex: 1,
    paddingRight: h(8),
  },
  confidenceHelpTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(15),
    marginBottom: v(5),
  },
  confidenceHelpText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(12),
    lineHeight: ms(15),
  },
  infoDot: {
    alignItems: 'center',
    backgroundColor: '#EFF2F5',
    borderRadius: h(14),
    height: h(28),
    justifyContent: 'center',
    width: h(28),
  },
  infoDotText: {
    color: COLORS.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(12),
  },
  noPreviewText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
    margin: 'auto',
    textAlign: 'center',
  },
  slideDots: {
    alignSelf: 'center',
    bottom: v(10),
    flexDirection: 'row',
    gap: h(4),
    position: 'absolute',
  },
  dot: {
    backgroundColor: '#D5DBE1',
    borderRadius: h(4),
    height: h(6),
    width: h(6),
  },
  dotActive: {
    backgroundColor: COLORS.green,
    width: h(15),
  },
  insightCard: {
    backgroundColor: COLORS.ink,
    borderRadius: h(18),
    flexDirection: 'row',
    marginTop: v(9),
    minHeight: v(136),
    overflow: 'hidden',
    padding: h(18),
  },
  insightTextColumn: {
    flex: 1,
  },
  trafficChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: h(12),
    paddingHorizontal: h(9),
    paddingVertical: v(2),
  },
  trafficChipText: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
  },
  trafficDistance: {
    color: COLORS.white,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(30),
    lineHeight: ms(37),
    marginTop: v(20),
  },
  trafficPlace: {
    color: '#B7BDCA',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    marginTop: v(6),
  },
  trafficSource: {
    color: '#8E95A4',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(12),
    marginTop: v(6),
  },
  carCircle: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderRadius: h(35),
    height: h(70),
    justifyContent: 'center',
    width: h(70),
  },
  rideContent: {
    flex: 1,
  },
  rideTitle: {
    color: COLORS.white,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(21),
  },
  rideSubtitle: {
    color: '#C2C6D2',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    marginBottom: v(12),
    marginTop: v(5),
  },
  rideProvider: {
    alignItems: 'center',
    borderBottomColor: '#272A39',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: v(9),
  },
  providerLogo: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: h(10),
    height: h(20),
    justifyContent: 'center',
    marginRight: h(10),
    width: h(20),
  },
  lyftLogo: {
    backgroundColor: '#D927C9',
  },
  providerLogoText: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(8),
  },
  providerName: {
    color: COLORS.white,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(15),
  },
  providerArrow: {
    color: COLORS.white,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
  },
  insightDots: {
    bottom: v(16),
    flexDirection: 'row',
    gap: h(5),
    left: 0,
    right: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  darkDot: {
    backgroundColor: '#55596D',
    borderRadius: h(4),
    height: h(6),
    width: h(6),
  },
  darkDotActive: {
    backgroundColor: COLORS.white,
    width: h(17),
  },
  weatherCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(17),
    borderWidth: 1,
    flexDirection: 'row',
    height: v(74),
    marginTop: v(9),
    paddingHorizontal: h(18),
  },
  weatherTemp: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(28),
    marginRight: h(16),
  },
  weatherCopy: {
    flex: 1,
  },
  weatherTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
  },
  weatherDate: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
    marginTop: v(3),
  },
  weatherIcon: {
    height: h(42),
    width: h(42),
  },
  sectionTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(20),
    marginTop: v(28),
  },
  filterRail: {
    gap: h(10),
    paddingRight: h(24),
    paddingTop: v(15),
  },
  filterPill: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(17),
    borderWidth: 1,
    flexDirection: 'row',
    height: v(29),
    paddingHorizontal: h(8),
  },
  filterPillSelected: {
    borderColor: '#C5E476',
  },
  filterDot: {
    alignItems: 'center',
    backgroundColor: '#F2F4F6',
    borderColor: COLORS.line,
    borderRadius: h(9),
    borderWidth: 1,
    height: h(18),
    justifyContent: 'center',
    marginRight: h(8),
    width: h(18),
  },
  filterDotSelected: {
    backgroundColor: '#F5FFE0',
    borderColor: COLORS.green,
  },
  filterText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(15),
  },
  filterTextSelected: {
    color: COLORS.green,
  },
  meetingList: {
    marginTop: v(18),
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: v(44),
  },
  meetingCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.line,
    borderRadius: h(17),
    borderWidth: 1,
    marginBottom: v(10),
    minHeight: v(145),
    padding: h(16),
  },
  meetingTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: h(8),
    justifyContent: 'space-between',
  },
  meetingTitle: {
    color: COLORS.ink,
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(16),
  },
  meetingBadges: {
    flexDirection: 'row',
    gap: h(6),
  },
  statusBadge: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(13),
    paddingHorizontal: h(10),
    paddingVertical: v(4),
  },
  pendingBadge: {
    backgroundColor: '#FFF3E3',
  },
  statusBadgeText: {
    color: '#65840E',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
  },
  pendingBadgeText: {
    color: COLORS.orange,
  },
  priceBadge: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(13),
    paddingHorizontal: h(10),
    paddingVertical: v(4),
  },
  paidBadge: {
    backgroundColor: '#F0E8FF',
  },
  priceBadgeText: {
    color: '#65840E',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(13),
  },
  paidBadgeText: {
    color: COLORS.purple,
  },
  meetingDetailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: h(6),
    marginTop: v(7),
  },
  meetingDetailText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: v(-20),
    minHeight: h(30),
  },
  smallAvatar: {
    borderColor: COLORS.white,
    borderRadius: h(15),
    borderWidth: 2,
    height: h(30),
    overflow: 'hidden',
    width: h(30),
  },
  smallAvatarImage: {
    height: '100%',
    width: '100%',
  },
  cardDivider: {
    backgroundColor: COLORS.line,
    height: 1,
    marginBottom: v(10),
    marginTop: v(8),
  },
  noMeetingsInline: {
    alignItems: 'center',
    paddingVertical: v(32),
  },
  noMeetingsInlineText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
  },
});

export default AppStack_HomePageScreen;
