import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';
import * as Contacts from 'expo-contacts';
import { useAtom } from 'jotai';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import {
  Background,
  Notification,
  Avatar,
  AddIcon,
  HomeIcon,
  CalendarIcon,
  BusinessIcon,
  ProfileIcon,
  BackArrow,
  Search,
  GymIcon,
  FootballIcon,
  TimeIcon,
} from '~/lib/images';
import { http, mapApiKey } from '~/helpers/http';
import { userAtom } from '~/store';
import Toast from '~/components/Toast';
import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { hashPhoneNumber } from '~/utils/phoneHash';
import MapView, { Marker } from 'react-native-maps';
import { getPlacesByQuery } from '~/helpers/common';
import {
  AvailabilitySchedule,
  DEFAULT_AVAILABILITY_SCHEDULE,
  getAvailabilityBlocksForDate,
  isRangeWithinBlocks,
  minutesToLabel,
  timeStringToMinutes,
} from '~/helpers/calendarAvailability';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_DateDetailScreen'>;

interface Meeting {
  id: string;
  title: string;
  duration: string;
  platform: string;
  date: Date;
  time?: string; // Time in HH:mm format
}

interface MomentRequest {
  id: string;
  senderId: string;
  receiverId: string;
  startTime: string;
  endTime: string;
  title: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  locationType?: 'remote' | 'onsite';
  locationLabel?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  sender?: {
    id: string;
    name?: string;
    phoneNumber: string;
    avatar?: string;
  };
  receiver?: {
    id: string;
    name?: string;
    phoneNumber: string;
    avatar?: string;
  };
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
  };
}

interface CalendarEvent {
  id: string;
  source: 'catch' | 'google' | 'microsoft' | 'icloud';
  sourceType: 'internal' | 'external';
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  status?: string;
  meetingType?: string;
  locationType?: 'remote' | 'onsite';
  locationLabel?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  compact: boolean;
}

interface BookableUserResponse {
  id: string;
  displayName: string;
  avatar?: string | null;
  isContact: boolean;
  timezone: string;
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

interface MeetingType {
  id: string;
  name: string;
  icon: any; // Image source
}

interface TimelineEvent extends CalendarEvent {
  isPendingPlaceholder?: boolean;
}

const AppStack_DateDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  // Get current user
  const [user, setUser] = useAtom(userAtom);

  // Get the selected date and contact from route params
  const routeContact = route.params?.contact;
  const routeMomentRequestId = route.params?.momentRequestId;
  const routeBookingUserId = route.params?.bookingUserId;
  const [selectedDate, setSelectedDate] = useState(
    route.params?.date || new Date().toISOString().split('T')[0]
  );
  const [availabilityView, setAvailabilityView] = useState<'scheduled' | 'full'>('scheduled');

  // Selected contact from route or state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(routeContact || null);

  // Update selectedDate when route params change (e.g., from notification navigation)
  // This handles both initial load and subsequent navigation with different dates
  // We only update when route.params.date actually changes, not on every focus
  useEffect(() => {
    const paramDate = route.params?.date;
    console.log('📅 [UseEffect] Route params changed:', {
      paramDate,
      currentSelectedDate: selectedDate,
    });

    if (paramDate && paramDate !== selectedDate) {
      console.log('📅 [UseEffect] Updating selectedDate from', selectedDate, 'to', paramDate);
      setSelectedDate(paramDate);
    }
  }, [route.params?.date, route.params?.momentRequestId]); // Only watch route params, not selectedDate to avoid loops
  const [appointmentTitle, setAppointmentTitle] = useState('30 Minute Meeting');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentDuration, setAppointmentDuration] = useState('30 min');
  const [appointmentType, setAppointmentType] = useState('meet');
  const [userMeetingTypes, setUserMeetingTypes] = useState<string[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MomentRequest | null>(null);

  // External event detail modal
  const [showExternalEventModal, setShowExternalEventModal] = useState(false);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState<CalendarEvent | null>(null);

  // Contact selection modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearchText, setContactSearchText] = useState('');
  const [phoneNumberMap, setPhoneNumberMap] = useState<Map<string, string>>(new Map());
  const [isTransitioningModals, setIsTransitioningModals] = useState(false);

  // Animation values for smooth modal transitions
  const createModalSlideAnim = useRef(new Animated.Value(0)).current;
  const createModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const requestModalSlideAnim = useRef(new Animated.Value(0)).current;
  const requestModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const externalEventModalSlideAnim = useRef(new Animated.Value(0)).current;
  const externalEventModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const contactModalSlideAnim = useRef(new Animated.Value(0)).current;
  const contactModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const [contactModalContentHeight, setContactModalContentHeight] = useState(
    Dimensions.get('window').height
  );
  const contactScrollMaxHeight = Math.max(
    contactModalContentHeight - verticalScale(130),
    verticalScale(150)
  );

  // Track which momentRequestId has already been auto-opened so that internal date
  // navigation (which re-fetches momentRequests) does not re-trigger the modal.
  const handledMomentRequestIdRef = useRef<string | null>(null);

  // Pending meeting (temporary placeholder while creating)
  const [pendingMeeting, setPendingMeeting] = useState<{
    startTime: Date;
    endTime: Date;
    title: string;
  } | null>(null);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Contact's availability (to be fetched)
  const [userAvailabilitySchedule, setUserAvailabilitySchedule] = useState<AvailabilitySchedule>(
    DEFAULT_AVAILABILITY_SCHEDULE
  );
  const [contactAvailabilitySchedule, setContactAvailabilitySchedule] =
    useState<AvailabilitySchedule | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [contactCalendarEvents, setContactCalendarEvents] = useState<CalendarEvent[]>([]);

  const [meetingLocationType, setMeetingLocationType] = useState<'remote' | 'onsite'>('remote');
  const [locationQuery, setLocationQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);

  // Moment requests (received and sent)
  const [momentRequests, setMomentRequests] = useState<MomentRequest[]>([]);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Helper function to show toast
  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const buildStaticMapUrl = (latitude?: number | null, longitude?: number | null) => {
    if (!mapApiKey || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null;
    }

    return `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=640x240&scale=2&markers=color:0xA3CB31%7C${latitude},${longitude}&key=${mapApiKey}`;
  };

  // Fetch user profile to get meetingTypes
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await http.get('/users/profile');
        if (response.data) {
          setUser(response.data);
          const meetingTypesArray = response.data.meetingTypes || [];
          setUserMeetingTypes(meetingTypesArray);
          // Set default appointment type to first available type
          if (meetingTypesArray.length > 0) {
            setAppointmentType(meetingTypesArray[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    fetchUserProfile();
  }, []);

  const buildPseudoContact = (bookableUser: BookableUserResponse): Contact => ({
    id: `bookable-${bookableUser.id}`,
    displayName: bookableUser.displayName,
    avatar: bookableUser.avatar || undefined,
    contactUser: {
      id: bookableUser.id,
      name: bookableUser.displayName,
      avatar: bookableUser.avatar || undefined,
    },
  });

  const loadUserAvailability = useCallback(async () => {
    try {
      const response = await http.get('/users/availability');
      setUserAvailabilitySchedule({
        timezone: response.data.timezone || user.timezone || 'UTC',
        slots: response.data.slots || DEFAULT_AVAILABILITY_SCHEDULE.slots,
      });
    } catch (error) {
      console.error('Error loading user availability schedule:', error);
      setUserAvailabilitySchedule({
        ...DEFAULT_AVAILABILITY_SCHEDULE,
        timezone: user.timezone || DEFAULT_AVAILABILITY_SCHEDULE.timezone,
      });
    }
  }, [user.timezone]);

  const loadUserCalendarEvents = useCallback(async () => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0);
      const end = new Date(year, month - 1, day + 1, 0, 0, 0);
      const response = await http.get('/users/calendar-events', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      const events = response.data.events || [];
      const internalCount = events.filter((e: any) => e.sourceType === 'internal').length;
      const externalCount = events.filter((e: any) => e.sourceType === 'external').length;
      console.log(`[DateDetailScreen] Calendar events loaded for ${selectedDate}: ${events.length} total (${internalCount} internal, ${externalCount} external)`);
      if (externalCount > 0) {
        console.log('[DateDetailScreen] External events:', events.filter((e: any) => e.sourceType === 'external').map((e: any) => ({ id: e.id, title: e.title, source: e.source, start: e.startTime, end: e.endTime })));
      }
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error loading user calendar events:', error);
      setCalendarEvents([]);
    }
  }, [selectedDate]);

  const loadSelectedContactCalendarData = useCallback(async () => {
    if (!selectedContact?.contactUser?.id) {
      setContactAvailabilitySchedule(null);
      setContactCalendarEvents([]);
      return;
    }

    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0);
      const end = new Date(year, month - 1, day + 1, 0, 0, 0);

      const [availabilityResponse, eventsResponse] = await Promise.all([
        http.get(`/users/${selectedContact.contactUser.id}/availability`),
        http.get(`/users/${selectedContact.contactUser.id}/calendar-events`, {
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
        }),
      ]);

      setContactAvailabilitySchedule({
        timezone: availabilityResponse.data.timezone || 'UTC',
        slots: availabilityResponse.data.slots || DEFAULT_AVAILABILITY_SCHEDULE.slots,
      });
      setContactCalendarEvents(eventsResponse.data.events || []);
    } catch (error) {
      console.error('Error loading selected contact calendar data:', error);
      setContactAvailabilitySchedule(null);
      setContactCalendarEvents([]);
    }
  }, [selectedContact, selectedDate]);

  useEffect(() => {
    loadUserAvailability();
  }, [loadUserAvailability]);

  useEffect(() => {
    loadUserCalendarEvents();
  }, [loadUserCalendarEvents]);

  useEffect(() => {
    loadSelectedContactCalendarData();
  }, [loadSelectedContactCalendarData]);

  useEffect(() => {
    const fetchBookableUser = async () => {
      if (!routeBookingUserId || routeContact) {
        return;
      }

      try {
        const response = await http.get(`/users/bookable/${routeBookingUserId}`);
        setSelectedContact(buildPseudoContact(response.data.user));
      } catch (error: any) {
        console.error('Error loading bookable user:', error);
        showToastMessage(error.response?.data?.error || 'Unable to open this booking profile.');
      }
    };

    fetchBookableUser();
  }, [routeBookingUserId, routeContact]);

  // Get meeting types based on user's selected types
  const getMeetingTypes = (): MeetingType[] => {
    const allTypes: MeetingType[] = [
      { id: 'meet', name: 'Meet', icon: CalendarIcon },
      { id: 'gym', name: 'Gym', icon: GymIcon },
      { id: 'football', name: 'Football', icon: FootballIcon },
    ];

    // Filter to only show user's selected types
    if (userMeetingTypes.length > 0) {
      return allTypes.filter((type) => userMeetingTypes.includes(type.id));
    }

    // Default to 'meet' if no types selected
    return [{ id: 'meet', name: 'Meet', icon: CalendarIcon }];
  };

  const meetingTypes = getMeetingTypes();

  const durationOptions = ['30 min', '1 hr', '1h 30min', '2hr'];

  // Sample meetings data - in real app, this would come from API
  const [meetings] = useState<Meeting[]>([
    {
      id: '1',
      title: 'Quick check in',
      duration: '30 min',
      platform: 'Zoom',
      date: new Date(2025, 6, 30),
      time: '20:00',
    },
    {
      id: '2',
      title: 'Quick check in',
      duration: '30 min',
      platform: 'Zoom',
      date: new Date(2025, 6, 30),
      time: '21:00',
    },
    {
      id: '3',
      title: 'Intro call',
      duration: '30 min',
      platform: 'Zoom',
      date: new Date(2025, 6, 30),
      time: '23:00',
    },
    {
      id: '4',
      title: '30 Minute Meeting',
      duration: '30 min',
      platform: 'Zoom',
      date: new Date(2025, 6, 30),
      time: '00:00',
    },
  ]);

  // Generate all available time slots (30-minute intervals, 24-hour format)
  // Memoize to avoid regenerating on every render
  const allTimeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  // Get the week containing the selected date (Monday to Sunday)
  const weekDates = useMemo(() => {
    // Parse date string to avoid timezone issues
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate offset to get to Monday (1)
    // If day is 0 (Sunday), go back 6 days to get Monday
    // If day is 1 (Monday), offset is 0
    // If day is 2 (Tuesday), go back 1 day, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(year, month - 1, day);
    monday.setDate(monday.getDate() + mondayOffset);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(monday);
      weekDate.setDate(monday.getDate() + i);
      week.push({
        date: weekDate,
        dayName: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
        dateNum: weekDate.getDate(),
        dateString: `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`,
      });
    }
    return week;
  }, [selectedDate]);

  const getMeetingsForDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return meetings.filter((meeting) => {
      return (
        meeting.date.getDate() === date.getDate() &&
        meeting.date.getMonth() === date.getMonth() &&
        meeting.date.getFullYear() === date.getFullYear()
      );
    });
  };

  // Get all moment requests that overlap with a specific time
  const getMomentRequestsForTime = (time: string): MomentRequest[] => {
    const [hours, minutes] = time.split(':').map(Number);
    const [year, month, day] = selectedDate.split('-').map(Number);
    const timeDate = new Date(year, month - 1, day, hours, minutes);

    return momentRequests.filter((request) => {
      const requestStart = new Date(request.startTime);
      const requestEnd = new Date(request.endTime);
      // Check if the time slot falls within the request time range
      return timeDate >= requestStart && timeDate < requestEnd;
    });
  };

  // Group overlapping moment requests into columns (like Google Calendar)
  const groupOverlappingRequests = (requests: MomentRequest[]): MomentRequest[][] => {
    if (requests.length === 0) return [];

    // Sort by start time
    const sorted = [...requests].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const columns: MomentRequest[][] = [];

    for (const request of sorted) {
      const requestStart = new Date(request.startTime).getTime();
      const requestEnd = new Date(request.endTime).getTime();

      // Find the first column where this request doesn't overlap
      let placed = false;
      for (const column of columns) {
        const lastInColumn = column[column.length - 1];
        const lastEnd = new Date(lastInColumn.endTime).getTime();

        // If this request starts after the last one ends, or they don't overlap
        if (requestStart >= lastEnd) {
          column.push(request);
          placed = true;
          break;
        }
      }

      // If no column found, create a new one
      if (!placed) {
        columns.push([request]);
      }
    }

    return columns;
  };

  // Calculate block height based on request duration
  const getRequestBlockHeight = (request: MomentRequest): number => {
    const start = new Date(request.startTime);
    const end = new Date(request.endTime);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    // Base height is 32px for 30 minutes, scale proportionally
    return Math.max(32, (durationMinutes / 30) * 32);
  };

  // Handle clicking on a meeting block - show details modal
  const handleRequestBlockPress = useCallback(
    (request: MomentRequest) => {
      setSelectedRequest(request);
      setShowRequestModal(true);
      // Animate modal in
      Animated.parallel([
        Animated.timing(requestModalSlideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(requestModalOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [requestModalSlideAnim, requestModalOpacityAnim]
  );

  // Handle clicking on an external calendar event - show details modal
  const handleExternalEventPress = useCallback(
    (event: CalendarEvent) => {
      setSelectedExternalEvent(event);
      setShowExternalEventModal(true);
      Animated.parallel([
        Animated.timing(externalEventModalSlideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(externalEventModalOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [externalEventModalSlideAnim, externalEventModalOpacityAnim]
  );

  // Handle accepting a moment request
  const handleAcceptRequest = async () => {
    if (!selectedRequest || isAccepting) return;

    try {
      setIsAccepting(true);
      await http.post(`/users/moment-requests/${selectedRequest.id}/respond`, {
        approved: true,
      });

      // Schedule a reminder notification 30 minutes before the meeting
      try {
        const { scheduleMeetingReminder } = await import('~/services/notificationService');
        await scheduleMeetingReminder(selectedRequest, user.id);
      } catch (reminderError) {
        console.error('Error scheduling meeting reminder:', reminderError);
        // Don't block the acceptance if reminder scheduling fails
      }

      // Refresh moment requests
      await fetchMomentRequests();
      await loadUserCalendarEvents();
      await loadSelectedContactCalendarData();

      setShowRequestModal(false);
      setSelectedRequest(null);
      showToastMessage('Meeting request accepted!');
    } catch (error: any) {
      console.error('Error accepting request:', error);
      showToastMessage(error.response?.data?.error || 'Failed to accept request');
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle rejecting a moment request
  const handleRejectRequest = async () => {
    if (!selectedRequest || isRejecting) return;

    try {
      setIsRejecting(true);
      await http.post(`/users/moment-requests/${selectedRequest.id}/respond`, {
        approved: false,
      });

      // Refresh moment requests
      await fetchMomentRequests();
      await loadUserCalendarEvents();
      await loadSelectedContactCalendarData();

      setShowRequestModal(false);
      setSelectedRequest(null);
      showToastMessage('Meeting request has been rejected.');
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      showToastMessage(error.response?.data?.error || 'Failed to reject request');
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle canceling a scheduled meeting or request
  const handleCancelMeeting = async () => {
    if (!selectedRequest) return;

    const isPending = selectedRequest.status === 'pending';
    const title = isPending ? 'Cancel Request' : 'Cancel Meeting';
    const message = isPending
      ? 'Are you sure you want to cancel this meeting request? This action cannot be undone.'
      : 'Are you sure you want to cancel this meeting? This action cannot be undone.';
    const successBody = isPending
      ? 'The meeting request has been successfully canceled.'
      : 'The meeting has been successfully canceled.';

    // Show confirmation dialog
    Alert.alert(
      title,
      message,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCanceling(true);
              await http.delete(`/users/moment-requests/${selectedRequest.id}`);

              // Refresh moment requests and contact requests
              await fetchMomentRequests();
              await loadUserCalendarEvents();
              await loadSelectedContactCalendarData();

              setShowRequestModal(false);
              setSelectedRequest(null);
              showToastMessage(successBody);
            } catch (error: any) {
              console.error('Error canceling meeting:', error);
              showToastMessage(error.response?.data?.error || 'Failed to cancel');
            } finally {
              setIsCanceling(false);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const navigateToNextWeek = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 7);
    const newDateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(newDateString);
  };

  const navigateToPrevWeek = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 7);
    const newDateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(newDateString);
  };

  const getMonthAbbreviation = (dateString: string) => {
    const monthNum = parseInt(dateString.split('-')[1], 10);
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
    return months[monthNum - 1];
  };

  // Get the first and last day of the week for header display
  const firstDayOfWeek = weekDates[0].date;
  const lastDayOfWeek = weekDates[6].date;
  const firstMonthAbbr = getMonthAbbreviation(
    `${firstDayOfWeek.getFullYear()}-${String(firstDayOfWeek.getMonth() + 1).padStart(2, '0')}`
  );
  const lastMonthAbbr = getMonthAbbreviation(
    `${lastDayOfWeek.getFullYear()}-${String(lastDayOfWeek.getMonth() + 1).padStart(2, '0')}`
  );
  const lastYear = lastDayOfWeek.getFullYear();

  const filteredMeetings = getMeetingsForDate(selectedDate);

  // Get scheduled times for the selected date, sorted by time
  const scheduledTimes = filteredMeetings
    .map((m) => m.time || '')
    .filter(Boolean)
    .sort();

  // Function to fetch moment requests
  const fetchMomentRequests = useCallback(async () => {
    try {
      console.log('[DateDetailScreen] Fetching moment requests for date:', selectedDate);

      // Fetch both received and sent requests
      const [receivedRes, sentRes] = await Promise.all([
        http.get('/users/moment-requests/received'),
        http.get('/users/moment-requests/sent'),
      ]);

      const allRequests = [...(receivedRes.data.requests || []), ...(sentRes.data.requests || [])];

      console.log(
        '[DateDetailScreen] All moment requests fetched:',
        allRequests.length,
        allRequests.map((r) => ({ id: r.id, status: r.status }))
      );

      // Filter requests for the selected date
      const [year, month, day] = selectedDate.split('-').map(Number);
      const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
      const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59);

      const filteredRequests = allRequests.filter((request: MomentRequest) => {
        const requestDate = new Date(request.startTime);
        // Check if request is on the selected date
        return requestDate >= selectedDateStart && requestDate <= selectedDateEnd;
      });

      console.log(
        `[DateDetailScreen] Filtered ${filteredRequests.length} requests for date ${selectedDate}:`,
        filteredRequests.map((r) => ({ id: r.id, status: r.status }))
      );

      // Always update state, even if empty (to remove canceled requests from UI)
      setMomentRequests(filteredRequests);
    } catch (error) {
      console.error('[DateDetailScreen] Error fetching moment requests:', error);
      // On error, set empty array to clear UI
      setMomentRequests([]);
    }
  }, [selectedDate]);

  // Fetch moment requests when date changes or screen is focused
  useEffect(() => {
    fetchMomentRequests();
  }, [fetchMomentRequests, loadSelectedContactCalendarData, loadUserCalendarEvents]);

  // Refresh when screen comes into focus (e.g., after accepting/rejecting from notification)
  useFocusEffect(
    useCallback(() => {
      fetchMomentRequests();
      loadUserCalendarEvents();
      loadSelectedContactCalendarData();
    }, [fetchMomentRequests, loadSelectedContactCalendarData, loadUserCalendarEvents])
  );

  // Listen for notifications and refresh when receiver accepts/rejects via push notification
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      const eventType = data.eventType || data.type;

      console.log('[DateDetailScreen] 📬 Notification received:', {
        eventType,
        momentRequestId: data.momentRequestId,
      });

      // Refresh when receiver accepts/rejects via push notification
      if (eventType === 'moment.request.approved' || eventType === 'moment.request.rejected') {
        console.log(
          '[DateDetailScreen] 📬 Notification received for accept/reject, updating state...'
        );

        // Immediately update the request status in state if request exists
        if (data.momentRequestId) {
          const newStatus: 'approved' | 'rejected' =
            eventType === 'moment.request.approved' ? 'approved' : 'rejected';
          setMomentRequests((prev) => {
            const updated = prev.map((request) => {
              if (request.id === data.momentRequestId) {
                console.log(
                  '[DateDetailScreen] Found request in state, updating status:',
                  request.id
                );
                return {
                  ...request,
                  status: newStatus,
                };
              }
              return request;
            });
            console.log('[DateDetailScreen] Updated requests count:', updated.length);
            return updated;
          });
        }

        // Then refetch to ensure consistency
        setTimeout(() => {
          console.log('[DateDetailScreen] Refetching after notification...');
          fetchMomentRequests();
          loadUserCalendarEvents();
          loadSelectedContactCalendarData();
        }, 1000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchMomentRequests, loadSelectedContactCalendarData, loadUserCalendarEvents]);

  // Listen for Socket.IO events and refresh moment requests when moment-related events occur
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let reconnectHandler: (() => void) | null = null;
    let isMounted = true;

    const setupSocketListeners = async () => {
      if (!isMounted) return;

      let socket = getSocket();

      // If socket is not available, try to initialize it
      if (!socket) {
        console.log('[DateDetailScreen] Socket not available, attempting to initialize...');
        socket = await initializeSocket();

        if (!socket || !isMounted) {
          console.log('[DateDetailScreen] Failed to initialize socket or component unmounted');
          return;
        }
      }

      // Set up listeners when socket connects
      const setupOnConnect = () => {
        if (!isMounted) return;

        const currentSocket = getSocket();
        if (!currentSocket || !currentSocket.connected) {
          console.log('[DateDetailScreen] Socket not connected, waiting...');
          return;
        }

        console.log('[DateDetailScreen] Setting up Socket.IO event listeners...');

        // Clean up previous listeners if any
        if (cleanup) {
          cleanup();
        }

        cleanup = setupSocketEventListeners({
          // Meeting created → receiver gets update
          onMomentRequest: (data) => {
            console.log('[DateDetailScreen] 📬 Meeting created - refreshing...');
            fetchMomentRequests();
            loadUserCalendarEvents();
            loadSelectedContactCalendarData();
          },
          // Meeting accepted/rejected → sender gets update
          onMomentResponse: (data) => {
            console.log('[DateDetailScreen] ✅ Meeting accepted/rejected socket event received:', {
              eventType: data.eventType,
              momentRequestId: data.momentRequestId,
              senderId: data.senderId,
              receiverId: data.receiverId,
              fullData: data,
            });

            // Determine status from eventType
            const newStatus: 'approved' | 'rejected' =
              data.eventType === 'moment.request.approved' ? 'approved' : 'rejected';
            console.log('[DateDetailScreen] New status:', newStatus);

            // Immediately update the request status in state if request exists
            if (data.momentRequestId) {
              setMomentRequests((prev) => {
                const updated = prev.map((request) => {
                  if (request.id === data.momentRequestId) {
                    console.log(
                      '[DateDetailScreen] Found request in state, updating status:',
                      request.id
                    );
                    return {
                      ...request,
                      status: newStatus,
                    };
                  }
                  return request;
                });
                console.log('[DateDetailScreen] Updated requests count:', updated.length);
                return updated;
              });
            } else {
              console.warn('[DateDetailScreen] No momentRequestId in socket data');
            }

            // Always refetch to ensure consistency (even if request wasn't in state)
            setTimeout(() => {
              console.log('[DateDetailScreen] Refetching moment requests after socket event...');
              fetchMomentRequests();
              loadUserCalendarEvents();
              loadSelectedContactCalendarData();
            }, 1000);
          },
          // Meeting canceled → receiver gets update
          onMomentCanceled: (data) => {
            console.log('[DateDetailScreen] ❌ Meeting canceled - refreshing...', data);

            // Immediately remove the canceled request from state if we have the ID
            if (data.momentRequestId) {
              setMomentRequests((prev) => prev.filter((req) => req.id !== data.momentRequestId));
              console.log(
                '[DateDetailScreen] Removed canceled request from state:',
                data.momentRequestId
              );
            }

            // Then refetch to ensure consistency
            setTimeout(() => {
              fetchMomentRequests();
              loadUserCalendarEvents();
              loadSelectedContactCalendarData();
            }, 1000);
          },
        });
      };

      // If socket is already connected, set up listeners immediately
      if (socket.connected) {
        setupOnConnect();
      } else {
        // Wait for initial connection
        console.log('[DateDetailScreen] Socket not connected yet, waiting for connection...');
        socket.once('connect', setupOnConnect);
      }

      // Set up reconnect handler to re-establish listeners on reconnect
      reconnectHandler = () => {
        console.log('[DateDetailScreen] Socket reconnected, re-establishing listeners...');
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
  }, [fetchMomentRequests]);

  // Auto-open modal when navigating with momentRequestId (from push notification or notification screen).
  // We guard with handledMomentRequestIdRef so that internal date navigation, which re-fetches
  // momentRequests and therefore re-runs this effect, does not reopen the modal.
  useEffect(() => {
    if (
      routeMomentRequestId &&
      momentRequests.length > 0 &&
      handledMomentRequestIdRef.current !== routeMomentRequestId
    ) {
      const request = momentRequests.find((r) => r.id === routeMomentRequestId);
      if (request) {
        handledMomentRequestIdRef.current = routeMomentRequestId;
        setSelectedRequest(request);
        setShowRequestModal(true);
        console.log(
          '📬 Auto-opening moment request modal for:',
          routeMomentRequestId,
          'Status:',
          request.status
        );
        Animated.parallel([
          Animated.timing(requestModalSlideAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(requestModalOpacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [
    routeMomentRequestId,
    momentRequests,
    user?.id,
    requestModalSlideAnim,
    requestModalOpacityAnim,
  ]);

  // Handle clicking on a time slot to create meeting
  const handleTimeSlotClick = useCallback(
    (hour: number, minute: number) => {
      const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      setAppointmentTime(timeString);
      setAppointmentDuration('30 min');
      setMeetingLocationType('remote');
      setLocationQuery('');
      setPlaceResults([]);
      setSelectedPlace(null);

      // Create pending meeting placeholder
      const [year, month, day] = selectedDate.split('-').map(Number);
      const startTime = new Date(year, month - 1, day, hour, minute);
      const durationMinutes = durationToMinutes('30 min');
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      setPendingMeeting({
        startTime,
        endTime,
        title: appointmentTitle || 'New Meeting',
      });

      // If no contact is selected, show contact selection first
      if (!selectedContact) {
        setShowContactModal(true);
      } else {
        // If contact is already selected, show create modal directly
        setShowCreateModal(true);
      }
    },
    [selectedDate, appointmentTitle, selectedContact]
  );

  // Handle closing create modal without creating
  const handleCloseCreateModal = () => {
    Animated.parallel([
      Animated.timing(createModalSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(createModalOpacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCreateModal(false);
      setPendingMeeting(null); // Remove placeholder
      setMeetingLocationType('remote');
      setLocationQuery('');
      setPlaceResults([]);
      setSelectedPlace(null);
    });
  };

  // Handle closing contact modal without selecting
  const handleCloseContactModal = () => {
    Animated.parallel([
      Animated.timing(contactModalSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contactModalOpacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowContactModal(false);
      setPendingMeeting(null); // Remove placeholder
    });
  };

  // Update pending meeting when title or duration changes (only if modal is open)
  useEffect(() => {
    if (pendingMeeting && showCreateModal && appointmentTime) {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const [hours, minutes] = appointmentTime.split(':').map(Number);
      const startTime = new Date(year, month - 1, day, hours, minutes);
      const durationMinutes = durationToMinutes(appointmentDuration);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      setPendingMeeting({
        startTime,
        endTime,
        title: appointmentTitle || 'New Meeting',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentTitle, appointmentDuration, appointmentTime, selectedDate, showCreateModal]);

  // Load contacts
  const loadContacts = async () => {
    try {
      const response = await http.get('/users/contacts');
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  // Load contacts and phone number mapping on mount
  useEffect(() => {
    loadContacts();
    loadPhoneNumberMapping();
  }, []);

  // Load local contacts to create a mapping from hashed to original phone numbers
  // Optimized to batch requests and avoid bridge flooding on iOS
  const loadPhoneNumberMapping = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });

        const mapping = new Map<string, string>();

        // Process contacts in batches to avoid flooding the JS-Native bridge
        const BATCH_SIZE = 20;

        // Flatten the list of phone numbers to process
        const allPhones: string[] = [];
        data.forEach((contact) => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            contact.phoneNumbers.forEach((phone) => {
              const normalized = phone.number?.replace(/[\s\-\(\)]/g, '') || '';
              if (normalized) {
                allPhones.push(normalized);
                // Also store original if needed, but here we just need normalized -> hash
                // actually we need hash -> original (or normalized)
                // The mapping requires: hash -> original display number
                // So we'll need to store pairs
              }
            });
          }
        });

        // We need to re-iterate to keep the original number for display
        // Let's create a list of items to process: { normalized, original }
        const itemsToProcess: { normalized: string; original: string }[] = [];
        data.forEach((contact) => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            contact.phoneNumbers.forEach((phone) => {
              const normalized = phone.number?.replace(/[\s\-\(\)]/g, '') || '';
              if (normalized) {
                itemsToProcess.push({ normalized, original: phone.number || normalized });
              }
            });
          }
        });

        // Process sequentially in batches
        for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
          const batch = itemsToProcess.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (item) => {
              try {
                const hashed = await hashPhoneNumber(item.normalized);
                mapping.set(hashed, item.original);
              } catch (e) {
                console.warn('Error hashing phone:', e);
              }
            })
          );

          // Small delay to yield to event loop if needed, though await Promise.all releases checks
          if (i + BATCH_SIZE < itemsToProcess.length) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }

        setPhoneNumberMap(mapping);
      }
    } catch (error) {
      console.error('Error loading phone number mapping:', error);
    }
  };

  // Handle contact selection
  const handleContactSelect = (contact: Contact) => {
    if (!contact.contactUser?.id) {
      showToastMessage('This contact is not registered. Please select a registered contact.');
      return;
    }
    setSelectedContact(contact);
    setIsTransitioningModals(true);
    setShowContactModal(false);
    // iOS production builds require more time for modal animations and BlurView cleanup
    // Use requestAnimationFrame for smoother transition and platform-specific delay
    const transitionDelay = Platform.OS === 'ios' ? 500 : 200;
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsTransitioningModals(false);
        setShowCreateModal(true);
      }, transitionDelay);
    });
  };

  const filteredContacts = contacts
    .filter((contact) =>
      contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase())
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Convert duration string to minutes
  const durationToMinutes = (duration: string): number => {
    if (duration === '30 min') return 30;
    if (duration === '1 hr') return 60;
    if (duration === '1h 30min') return 90;
    if (duration === '2hr') return 120;
    return 30; // default
  };

  // Only internal (Catch) events affect availability — external calendar events are display-only
  const internalCalendarEvents = useMemo(
    () => calendarEvents.filter((e) => e.sourceType === 'internal'),
    [calendarEvents]
  );
  const internalContactCalendarEvents = useMemo(
    () => contactCalendarEvents.filter((e) => e.sourceType === 'internal'),
    [contactCalendarEvents]
  );

  const userAvailabilityBlocks = useMemo(
    () => getAvailabilityBlocksForDate(selectedDate, userAvailabilitySchedule, internalCalendarEvents),
    [selectedDate, userAvailabilitySchedule, internalCalendarEvents]
  );

  const contactAvailabilityBlocks = useMemo(
    () =>
      selectedContact
        ? getAvailabilityBlocksForDate(
            selectedDate,
            contactAvailabilitySchedule || DEFAULT_AVAILABILITY_SCHEDULE,
            internalContactCalendarEvents
          )
        : [],
    [selectedDate, selectedContact, contactAvailabilitySchedule, internalContactCalendarEvents]
  );

  // Check if a specific time slot is occupied by a meeting
  const isTimeSlotOccupied = useCallback(
    (hour: number, minute: number, meetings: Array<{ startTime: string; endTime: string }>) => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const slotTime = new Date(year, month - 1, day, hour, minute);

      return meetings.some((meeting) => {
        const meetingStart = new Date(meeting.startTime);
        const meetingEnd = new Date(meeting.endTime);
        return slotTime >= meetingStart && slotTime < meetingEnd;
      });
    },
    [selectedDate]
  );

  // Pre-calculate busy intervals for the selected date to optimize conflict detection
  // Only internal events block scheduling — external events are display-only
  const busyIntervals = useMemo(() => {
    const intervals: { start: number; end: number }[] = [];

    const [year, month, day] = selectedDate.split('-').map(Number);
    const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0).getTime();
    const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59).getTime();

    const addInterval = (events: Array<{ startTime: string; endTime: string }>) => {
      events.forEach((event) => {
        const start = new Date(event.startTime).getTime();
        const end = new Date(event.endTime).getTime();

        if (end > selectedDateStart && start < selectedDateEnd) {
          intervals.push({ start, end });
        }
      });
    };

    addInterval(internalCalendarEvents);

    if (selectedContact && internalContactCalendarEvents.length > 0) {
      addInterval(internalContactCalendarEvents);
    }

    return intervals;
  }, [selectedDate, internalCalendarEvents, internalContactCalendarEvents, selectedContact]);

  const isTimeWithinAvailability = useCallback(
    (timeString: string, durationStr: string): boolean => {
      const startMinutes = timeStringToMinutes(timeString);
      const endMinutes = startMinutes + durationToMinutes(durationStr);

      const fitsUser = isRangeWithinBlocks(userAvailabilityBlocks, startMinutes, endMinutes);
      if (!fitsUser) {
        return false;
      }

      if (!selectedContact) {
        return true;
      }

      return isRangeWithinBlocks(contactAvailabilityBlocks, startMinutes, endMinutes);
    },
    [contactAvailabilityBlocks, selectedContact, userAvailabilityBlocks]
  );

  const wouldConflictWithMeetings = useCallback(
    (timeString: string, durationStr: string): boolean => {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const [hour, minute] = timeString.split(':').map(Number);

      const proposedStart = new Date(year, month - 1, day, hour, minute).getTime();
      const durationMins = durationToMinutes(durationStr);
      const proposedEnd = proposedStart + durationMins * 60 * 1000;

      return busyIntervals.some(
        (interval) => proposedStart < interval.end && proposedEnd > interval.start
      );
    },
    [selectedDate, busyIntervals]
  );

  const handleBookMeetingPress = () => {
    if (!selectedContact) {
      setShowContactModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  useEffect(() => {
    const searchPlaces = async () => {
      if (meetingLocationType !== 'onsite' || locationQuery.trim().length < 2 || !mapApiKey) {
        setPlaceResults([]);
        return;
      }

      try {
        setIsLoadingPlaces(true);
        const results = await getPlacesByQuery(locationQuery.trim(), mapApiKey);
        setPlaceResults((results || []).slice(0, 5));
      } catch (error) {
        console.error('Error searching places:', error);
        setPlaceResults([]);
      } finally {
        setIsLoadingPlaces(false);
      }
    };

    const timeout = setTimeout(() => {
      searchPlaces();
    }, 250);

    return () => clearTimeout(timeout);
  }, [locationQuery, meetingLocationType]);

  const handleSubmitAppointment = async () => {
    if (!appointmentTime || !appointmentTitle) {
      showToastMessage('Please select a time and enter an event name');
      return;
    }

    if (!selectedContact?.contactUser?.id) {
      showToastMessage('Contact user ID is missing');
      return;
    }

    if (meetingLocationType === 'onsite' && !selectedPlace) {
      showToastMessage('Please select an onsite location');
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      // Ensure calendar visibility is granted before creating the request

      // Parse selected date and time
      const [year, month, day] = selectedDate.split('-').map(Number);
      const [hours, minutes] = appointmentTime.split(':').map(Number);

      // Create start time
      const startTime = new Date(year, month - 1, day, hours, minutes);

      // Calculate end time based on duration
      const durationMinutes = durationToMinutes(appointmentDuration);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // Call API to create moment request
      await http.post('/users/moment-requests', {
        receiverId: selectedContact.contactUser.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        title: `${appointmentTitle}: # catch ${selectedContact.displayName}`,
        description: appointmentTitle,
        meetingType: appointmentType,
        locationType: meetingLocationType,
        locationLabel: meetingLocationType === 'onsite' ? selectedPlace?.name : 'Remote meeting',
        locationAddress: meetingLocationType === 'onsite' ? selectedPlace?.formatted_address : null,
        locationLatitude:
          meetingLocationType === 'onsite' ? selectedPlace?.geometry?.location?.lat : null,
        locationLongitude:
          meetingLocationType === 'onsite' ? selectedPlace?.geometry?.location?.lng : null,
      });

      // Success - refresh the calendar to show the new meeting
      await fetchMomentRequests();
      await loadUserCalendarEvents();
      await loadSelectedContactCalendarData();

      // Remove pending meeting placeholder and close modal
      setPendingMeeting(null);
      setShowCreateModal(false);
      setMeetingLocationType('remote');
      setLocationQuery('');
      setPlaceResults([]);
      setSelectedPlace(null);
      showToastMessage('Meeting request created successfully!');
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      showToastMessage(error.response?.data?.error || 'Failed to create meeting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const timelineHourHeight = verticalScale(75);
  const timelineHalfHourHeight = verticalScale(37.5);
  const compactEventHeight = verticalScale(24);

  const scheduledTimelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [...calendarEvents];

    if (pendingMeeting) {
      events.push({
        id: 'pending',
        source: 'catch',
        sourceType: 'internal',
        title: pendingMeeting.title,
        startTime: pendingMeeting.startTime.toISOString(),
        endTime: pendingMeeting.endTime.toISOString(),
        status: 'pending',
        compact: false,
        isPendingPlaceholder: true,
        locationType: meetingLocationType,
        locationLabel:
          meetingLocationType === 'onsite' ? selectedPlace?.name || null : 'Remote meeting',
        locationAddress:
          meetingLocationType === 'onsite' ? selectedPlace?.formatted_address || null : null,
        locationLatitude:
          meetingLocationType === 'onsite'
            ? (selectedPlace?.geometry?.location?.lat ?? null)
            : null,
        locationLongitude:
          meetingLocationType === 'onsite'
            ? (selectedPlace?.geometry?.location?.lng ?? null)
            : null,
      });
    }

    return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [calendarEvents, meetingLocationType, pendingMeeting, selectedPlace]);

  const sourceLabels: Record<CalendarEvent['source'], string> = {
    catch: 'Catch',
    google: 'Google',
    microsoft: 'Microsoft',
    icloud: 'iCloud',
  };

  const scheduledViewElements = useMemo(() => {
    if (availabilityView !== 'scheduled') return null;

    // LAYER 1: Hour bars and labels (bottom layer)
    const hourBars = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourTime = `${String(hour).padStart(2, '0')}:00`;
      hourBars.push(
        <View key={`hour-${hour}`} style={[tw`flex-row`, { height: timelineHourHeight }]}>
          <Text
            style={[
              tw`text-black font-bold font-dm`,
              {
                fontSize: moderateScale(15),
                width: horizontalScale(60),
                marginTop: -verticalScale(11.25),
              },
            ]}>
            {hourTime}
          </Text>
          <View style={[tw`flex-1`, { marginLeft: horizontalScale(7.5) }]}>
            <View style={[tw`bg-gray-300`, { height: verticalScale(1.875) }]} />
          </View>
        </View>
      );
    }

    const formatEventTitle = (event: TimelineEvent) => {
      if (event.sourceType === 'external') {
        return event.title || `${sourceLabels[event.source]} event`;
      }

      const relatedRequest = momentRequests.find((request) => request.id === event.id);
      if (!relatedRequest) {
        return event.title || 'Meeting';
      }

      const otherPersonName =
        relatedRequest.senderId === user?.id
          ? relatedRequest.receiver?.name
          : relatedRequest.sender?.name;

      const titlePattern = /(.+):\s*(?:#\s*catch|Meeting\s+with)\s+(.+)/i;
      const match = (relatedRequest.title || '').match(titlePattern);
      if (match && otherPersonName) {
        return `${match[1]}: # catch ${otherPersonName}`;
      }

      return relatedRequest.title || event.title || 'Meeting';
    };

    // LAYER 2: Meeting blocks (top layer) - separate absolute container
    // External events are rendered as thin bars pinned to the left; internal events use column-splitting
    const meetingBlocks: React.ReactElement[] = [];
    const internalTimelineEvents = scheduledTimelineEvents.filter((e) => e.sourceType !== 'external');
    const externalTimelineEvents = scheduledTimelineEvents.filter((e) => e.sourceType === 'external');

    // External events: thin compact bar pinned to the left side
    externalTimelineEvents.forEach((event) => {
      const start = new Date(event.startTime);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const topPosition = (startMinutes / 30) * timelineHalfHourHeight;

      meetingBlocks.push(
        <View
          key={`container-${event.id}`}
          style={[
            tw`absolute`,
            {
              top: topPosition,
              left: horizontalScale(60),
              right: 0,
              height: compactEventHeight,
            },
          ]}
          pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleExternalEventPress(event)}
            style={[
              tw`bg-black rounded-md absolute`,
              {
                left: 0,
                width: '40%',
                height: '100%',
                paddingHorizontal: horizontalScale(7.5),
                flexDirection: 'row',
                alignItems: 'center',
                gap: horizontalScale(6),
              },
            ]}>
            <View
              style={[
                tw`rounded-full bg-white/20`,
                {
                  paddingHorizontal: horizontalScale(5),
                  paddingVertical: verticalScale(1.5),
                },
              ]}>
              <Text
                style={[tw`text-white font-dm font-semibold`, { fontSize: moderateScale(8.25) }]}>
                {sourceLabels[event.source]}
              </Text>
            </View>
            <Text
              style={[
                tw`text-white font-dm font-semibold flex-1`,
                { fontSize: moderateScale(10) },
              ]}
              numberOfLines={1}>
              {formatEventTitle(event)}
            </Text>
          </TouchableOpacity>
        </View>
      );
    });

    // Internal events: normal column-splitting for overlapping events
    internalTimelineEvents.forEach((event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const topPosition = (startMinutes / 30) * timelineHalfHourHeight;
      const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / (1000 * 60));
      const defaultHeight = (durationMinutes / 30) * timelineHalfHourHeight - verticalScale(4);
      const blockHeight = Math.max(timelineHalfHourHeight, defaultHeight);

      // Only consider internal events for column-splitting
      const simultaneousEvents = internalTimelineEvents.filter((candidate) => {
        const candidateStart = new Date(candidate.startTime).getTime();
        const candidateEnd = new Date(candidate.endTime).getTime();
        return candidateStart < end.getTime() && candidateEnd > start.getTime();
      });
      const eventIndex = simultaneousEvents.findIndex((candidate) => candidate.id === event.id);
      const totalSimultaneous = Math.max(simultaneousEvents.length, 1);
      const blockWidthPercent = totalSimultaneous === 1 ? 100 : 100 / totalSimultaneous - 1;
      const leftPercent = totalSimultaneous === 1 ? 0 : eventIndex * (100 / totalSimultaneous);

      const relatedRequest = momentRequests.find((request) => request.id === event.id);
      const blockColor = event.status === 'approved'
        ? 'bg-[#A3CB31]'
        : event.status === 'rejected'
          ? 'bg-red-500'
          : 'bg-gray-400';
      const subtitle = event.locationType === 'onsite'
        ? event.locationLabel || 'Onsite'
        : 'Remote';

      meetingBlocks.push(
        <View
          key={`container-${event.id}`}
          style={[
            tw`absolute`,
            {
              top: topPosition,
              left: horizontalScale(60),
              right: 0,
              height: blockHeight,
            },
          ]}
          pointerEvents="box-none">
          <TouchableOpacity
            style={[
              tw`${blockColor} rounded-lg absolute`,
              {
                left: `${leftPercent}%`,
                width: `${blockWidthPercent}%`,
                height: '100%',
                paddingHorizontal: horizontalScale(7.5),
                justifyContent: 'center',
                opacity: event.isPendingPlaceholder ? 0.6 : 1,
              },
            ]}
            activeOpacity={relatedRequest ? 0.7 : 1}
            onPress={() => relatedRequest && handleRequestBlockPress(relatedRequest)}
            disabled={!relatedRequest}>
            <Text
              style={[
                tw`${event.isPendingPlaceholder ? 'text-gray-700' : 'text-white'} font-dm font-semibold`,
                { fontSize: moderateScale(11.25) },
              ]}
              numberOfLines={2}>
              {formatEventTitle(event)}
            </Text>
            <Text
              style={[
                tw`${event.isPendingPlaceholder ? 'text-gray-700' : 'text-white/80'} font-dm`,
                { fontSize: moderateScale(9.75), marginTop: verticalScale(3) },
              ]}
              numberOfLines={1}>
              {subtitle}
            </Text>
          </TouchableOpacity>
        </View>
      );
    });

    // LAYER 3: Clickable time slots
    const timeSlots = [];
    for (let hour = 0; hour < 24; hour++) {
      if (!wouldConflictWithMeetings(`${String(hour).padStart(2, '0')}:00`, '30 min')) {
        timeSlots.push(
          <TouchableOpacity
            key={`slot-${hour}-0`}
            style={[
              tw`absolute`,
              {
                top: hour * timelineHourHeight,
                left: horizontalScale(60),
                right: 0,
                height: timelineHalfHourHeight,
              },
            ]}
            activeOpacity={0.3}
            onPress={() => handleTimeSlotClick(hour, 0)}
          />
        );
      }
      if (!wouldConflictWithMeetings(`${String(hour).padStart(2, '0')}:30`, '30 min')) {
        timeSlots.push(
          <TouchableOpacity
            key={`slot-${hour}-30`}
            style={[
              tw`absolute`,
              {
                top: hour * timelineHourHeight + timelineHalfHourHeight,
                left: horizontalScale(60),
                right: 0,
                height: timelineHalfHourHeight,
              },
            ]}
            activeOpacity={0.3}
            onPress={() => handleTimeSlotClick(hour, 30)}
          />
        );
      }
    }

    // Return THREE separate layers in correct order
    return (
      <View style={tw`relative`} collapsable={false}>
        {/* Layer 1: Hour bars (bottom) */}
        <View collapsable={false}>{hourBars}</View>

        {/* Layer 2: Time slots (middle) */}
        <View
          style={tw`absolute top-0 left-0 right-0`}
          collapsable={false}
          pointerEvents="box-none">
          {timeSlots}
        </View>

        {/* Layer 3: Meeting blocks (top) */}
        <View
          style={[tw`absolute top-0`, { left: 0, right: 0 }]}
          collapsable={false}
          pointerEvents="box-none">
          {meetingBlocks}
        </View>
      </View>
    );
  }, [
    availabilityView,
    compactEventHeight,
    handleRequestBlockPress,
    handleTimeSlotClick,
    momentRequests,
    scheduledTimelineEvents,
    timelineHalfHourHeight,
    timelineHourHeight,
    user,
    wouldConflictWithMeetings,
  ]);

  const fullAvailabilityViewElements = useMemo(() => {
    if (availabilityView !== 'full') return null;

    const hourBars = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourTime = `${String(hour).padStart(2, '0')}:00`;
      hourBars.push(
        <View
          key={`availability-hour-${hour}`}
          style={[tw`flex-row`, { height: timelineHourHeight }]}>
          <Text
            style={[
              tw`text-black font-bold font-dm`,
              {
                fontSize: moderateScale(15),
                width: horizontalScale(60),
                marginTop: -verticalScale(11.25),
              },
            ]}>
            {hourTime}
          </Text>
          <View style={[tw`flex-1`, { marginLeft: horizontalScale(7.5) }]}>
            <View style={[tw`bg-gray-300`, { height: verticalScale(1.875) }]} />
          </View>
        </View>
      );
    }

    const renderAvailabilityBlocks = (
      blocks: typeof userAvailabilityBlocks,
      backgroundColor: string,
      leftOffset: number | string,
      rightInset = 0,
      leftInset = 0
    ) =>
      blocks.map((block) => {
        const top = (block.startMinutes / 30) * timelineHalfHourHeight;
        const height = Math.max(
          timelineHalfHourHeight,
          ((block.endMinutes - block.startMinutes) / 30) * timelineHalfHourHeight - verticalScale(4)
        );

        return (
          <View
            key={`${leftOffset}-${block.startMinutes}-${block.endMinutes}`}
            style={[
              tw`absolute rounded-2xl`,
              {
                top,
                left: leftInset,
                right: rightInset,
                height,
                backgroundColor,
              },
            ]}
          />
        );
      });

    return (
      <View style={tw`relative`} collapsable={false}>
        <View collapsable={false}>{hourBars}</View>
        <View
          style={[
            tw`absolute top-0`,
            {
              left: horizontalScale(60) + horizontalScale(7.5),
              right: 0,
              height: 24 * timelineHourHeight,
            },
          ]}
          pointerEvents="none"
          collapsable={false}>
          {selectedContact ? (
            <>
              <View
                style={[
                  tw`absolute top-0`,
                  { left: 0, width: '48%', height: 24 * timelineHourHeight },
                ]}>
                {renderAvailabilityBlocks(
                  contactAvailabilityBlocks,
                  '#D1D5DB',
                  0,
                  horizontalScale(4),
                  0
                )}
              </View>
              <View
                style={[
                  tw`absolute top-0`,
                  { right: 0, width: '48%', height: 24 * timelineHourHeight },
                ]}>
                {renderAvailabilityBlocks(
                  userAvailabilityBlocks,
                  '#DDE8C2',
                  '52%',
                  0,
                  horizontalScale(4)
                )}
              </View>
            </>
          ) : (
            renderAvailabilityBlocks(userAvailabilityBlocks, '#DDE8C2', 0)
          )}
        </View>
      </View>
    );
  }, [
    availabilityView,
    contactAvailabilityBlocks,
    selectedContact,
    timelineHalfHourHeight,
    timelineHourHeight,
    userAvailabilityBlocks,
  ]);

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      {/* Fixed Header Section */}
      <View
        style={[
          { paddingTop: verticalScale(60), paddingBottom: verticalScale(22.5) },
          { paddingHorizontal: '4%' },
        ]}>
        {/* Header */}
        <View
          style={[
            tw`flex-row justify-between items-center`,
            { marginBottom: verticalScale(22.5) },
          ]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.5}>
            <Image
              source={BackArrow}
              style={{ width: horizontalScale(24), height: horizontalScale(24) }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={[tw`font-bold font-dm text-black`, { fontSize: moderateScale(16.875) }]}>
            When do you want to meet?
          </Text>
          <TouchableOpacity activeOpacity={0.5}>
            <Image
              source={CalendarIcon}
              style={{ width: horizontalScale(18.75), height: horizontalScale(18.75) }}
            />
          </TouchableOpacity>
        </View>

        {/* Week Date Selector */}
        <View
          style={[
            tw`flex-row items-center justify-between`,
            { marginBottom: verticalScale(22.5) },
          ]}>
          <TouchableOpacity
            onPress={navigateToPrevWeek}
            activeOpacity={0.7}
            style={{
              width: horizontalScale(30),
              height: horizontalScale(30),
              borderRadius: 9999,
              backgroundColor: 'white',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={[tw`text-black`, { fontSize: moderateScale(16.875) }]}>‹</Text>
          </TouchableOpacity>
          <View
            style={[
              tw`flex-row justify-between flex-1`,
              { marginHorizontal: horizontalScale(3.75) },
            ]}>
            {weekDates.map((weekDay, index) => {
              const isSelected = weekDay.dateString === selectedDate;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedDate(weekDay.dateString)}
                  activeOpacity={0.7}
                  style={tw`items-center`}>
                  <Text
                    style={[
                      tw`text-grey font-dm`,
                      { fontSize: moderateScale(11.25), marginBottom: verticalScale(7.5) },
                    ]}>
                    {weekDay.dayName}
                  </Text>
                  <View
                    style={[
                      tw`items-center justify-center`,
                      { width: horizontalScale(37.5), height: horizontalScale(37.5) },
                      { borderRadius: 20 },
                      isSelected ? tw`bg-black` : tw`bg-transparent`,
                    ]}>
                    <Text
                      style={[
                        tw`font-dm ${isSelected ? 'text-white' : 'text-black'}`,
                        { fontSize: moderateScale(13) },
                      ]}>
                      {weekDay.dateNum}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            onPress={navigateToNextWeek}
            activeOpacity={0.7}
            style={{
              width: horizontalScale(30),
              height: horizontalScale(30),
              borderRadius: 9999,
              backgroundColor: 'white',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={[tw`text-black`, { fontSize: moderateScale(16.875) }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Availability Toggle */}
        <View
          style={[
            tw`flex-row bg-white rounded-full`,
            { padding: moderateScale(3.75), marginBottom: verticalScale(15) },
          ]}>
          <TouchableOpacity
            onPress={() => setAvailabilityView('scheduled')}
            activeOpacity={0.7}
            style={[
              tw`flex-1 rounded-full items-center ${availabilityView === 'scheduled' ? 'bg-[#A3CB31] shadow-sm' : ''}`,
              { paddingVertical: verticalScale(7.5), paddingHorizontal: horizontalScale(15) },
            ]}>
            <Text
              style={[
                tw`font-dm ${availabilityView === 'scheduled' ? 'text-white font-bold' : 'text-grey'}`,
                { fontSize: moderateScale(13) },
              ]}>
              Scheduled events
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAvailabilityView('full')}
            activeOpacity={0.7}
            style={[
              tw`flex-1 rounded-full items-center ${availabilityView === 'full' ? 'bg-[#A3CB31] shadow-sm' : ''}`,
              { paddingVertical: verticalScale(7.5), paddingHorizontal: horizontalScale(15) },
            ]}>
            <Text
              style={[
                tw`font-dm ${availabilityView === 'full' ? 'text-white font-bold' : 'text-grey'}`,
                { fontSize: moderateScale(13) },
              ]}>
              Full availability
            </Text>
          </TouchableOpacity>
        </View>

        {/* Username Labels for Full Availability (only when contact selected and full view) */}
        {availabilityView === 'full' && selectedContact && (
          <View style={[tw`flex-row`, { marginTop: verticalScale(15), paddingHorizontal: '4%' }]}>
            <View style={{ width: horizontalScale(60) }} />
            <View style={[tw`flex-1 flex-row`, { marginLeft: horizontalScale(7.5) }]}>
              <View style={[tw`flex-1 items-center`, { marginRight: horizontalScale(7.5) }]}>
                <Text
                  style={[tw`text-grey font-dm font-bold`, { fontSize: moderateScale(11.25) }]}
                  numberOfLines={1}>
                  {selectedContact.displayName}
                </Text>
              </View>
              <View style={[tw`flex-1 items-center`, { marginLeft: horizontalScale(7.5) }]}>
                <Text
                  style={[tw`text-grey font-dm font-bold`, { fontSize: moderateScale(11.25) }]}
                  numberOfLines={1}>
                  {user.name || 'You'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Scrollable Time Slots List */}
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={[{ paddingHorizontal: '4%' }, { paddingBottom: verticalScale(120) }]}
        showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: verticalScale(15) }}>
          {availabilityView === 'scheduled' ? scheduledViewElements : fullAvailabilityViewElements}
        </View>
      </ScrollView>

      {/* Bottom Fixed Bar */}
      <View
        style={tw`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-lg border-t border-gray-200`}>
        <View
          style={[
            {
              paddingTop: verticalScale(15),
              paddingBottom: verticalScale(Platform.OS === 'ios' ? 35 : 50),
            },
            { paddingHorizontal: '4%' },
          ]}>
          {/* Book Meeting Button */}
          <TouchableOpacity
            onPress={handleBookMeetingPress}
            activeOpacity={0.7}
            style={[
              tw`bg-[#A3CB31] rounded-2xl items-center`,
              { paddingVertical: verticalScale(11.25) },
            ]}>
            <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
              Book a meeting
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Create Appointment Modal - Only render when contact modal is not active */}
      {!showContactModal && (
        <Modal
          visible={showCreateModal && !isTransitioningModals}
          transparent
          animationType="none"
          onRequestClose={handleCloseCreateModal}
          onShow={() => {
            // Animate in when modal becomes visible
            Animated.parallel([
              Animated.timing(createModalSlideAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(createModalOpacityAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();
          }}>
          <Animated.View style={[tw`flex-1`, { opacity: createModalOpacityAnim }]}>
            <BlurView intensity={20} style={tw`flex-1`}>
              <KeyboardAvoidingView
                style={tw`flex-1`}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}>
                <TouchableOpacity
                  style={tw`flex-1`}
                  activeOpacity={1}
                  onPress={handleCloseCreateModal}>
                  <View style={tw`flex-1 justify-end`}>
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                      <Animated.View
                        style={[
                          tw`bg-white rounded-t-3xl`,
                          {
                            maxHeight: Dimensions.get('window').height * 0.85,
                            transform: [
                              {
                                translateY: createModalSlideAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [300, 0],
                                }),
                              },
                            ],
                          },
                        ]}>
                        {/* Modal Header - Fixed at top */}
                        <View
                          style={[
                            tw`flex-row justify-between items-center`,
                            { padding: moderateScale(20), paddingBottom: verticalScale(15) },
                          ]}>
                          <Text
                            style={[
                              tw`font-bold font-dm text-black`,
                              { fontSize: moderateScale(18.75) },
                            ]}>
                            Create Meeting
                          </Text>
                          <TouchableOpacity onPress={handleCloseCreateModal} activeOpacity={0.7}>
                            <Text style={[tw`text-grey`, { fontSize: moderateScale(16.875) }]}>
                              ✕
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Scrollable Content */}
                        <ScrollView
                          contentContainerStyle={{
                            paddingHorizontal: moderateScale(20),
                            paddingBottom: moderateScale(20),
                          }}
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled={true}>
                          {/* Event Name */}
                          <View style={{ marginBottom: verticalScale(15) }}>
                            <Text
                              style={[
                                tw`font-dm text-grey`,
                                {
                                  fontSize: moderateScale(13.125),
                                  marginBottom: verticalScale(7.5),
                                },
                              ]}>
                              Event Name
                            </Text>
                            <TextInput
                              style={[
                                tw`bg-gray-100 rounded-xl text-black font-dm`,
                                {
                                  paddingHorizontal: horizontalScale(15),
                                  paddingVertical: verticalScale(11.25),
                                },
                              ]}
                              placeholder="Enter event name"
                              placeholderTextColor="#999"
                              value={appointmentTitle}
                              onChangeText={setAppointmentTitle}
                            />
                          </View>

                          {/* Time Selection */}
                          <View style={{ marginBottom: verticalScale(15) }}>
                            <Text
                              style={[
                                tw`font-dm text-grey`,
                                {
                                  fontSize: moderateScale(13.125),
                                  marginBottom: verticalScale(7.5),
                                },
                              ]}>
                              Select Time
                            </Text>
                            <ScrollView
                              style={{ maxHeight: verticalScale(150) }}
                              showsVerticalScrollIndicator={false}>
                              <View style={[tw`flex-row flex-wrap`, { gap: verticalScale(7.5) }]}>
                                {allTimeSlots.map((time) => {
                                  const isSelected = appointmentTime === time;
                                  // Check if this time would conflict with existing meetings (considering duration)
                                  const hasConflict = wouldConflictWithMeetings(
                                    time,
                                    appointmentDuration
                                  );

                                  return (
                                    <TouchableOpacity
                                      key={time}
                                      onPress={() => !hasConflict && setAppointmentTime(time)}
                                      activeOpacity={hasConflict ? 1 : 0.7}
                                      disabled={hasConflict}
                                      style={[
                                        tw`rounded-full ${
                                          isSelected
                                            ? 'bg-[#A3CB31]'
                                            : hasConflict
                                              ? 'bg-gray-200'
                                              : 'bg-gray-100'
                                        }`,
                                        {
                                          paddingHorizontal: horizontalScale(15),
                                          paddingVertical: verticalScale(7.5),
                                        },
                                      ]}>
                                      <Text
                                        style={[
                                          tw`font-dm ${
                                            isSelected
                                              ? 'text-white font-bold'
                                              : hasConflict
                                                ? 'text-gray-400'
                                                : 'text-grey'
                                          }`,
                                          { fontSize: moderateScale(13.125) },
                                        ]}>
                                        {time}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </ScrollView>
                          </View>

                          {/* Duration Selection */}
                          <View style={{ marginBottom: verticalScale(22.5) }}>
                            <Text
                              style={[
                                tw`font-dm text-grey`,
                                {
                                  fontSize: moderateScale(13.125),
                                  marginBottom: verticalScale(7.5),
                                },
                              ]}>
                              Duration
                            </Text>
                            <View style={[tw`flex-row flex-wrap`, { gap: verticalScale(7.5) }]}>
                              {durationOptions.map((duration) => (
                                <TouchableOpacity
                                  key={duration}
                                  onPress={() => setAppointmentDuration(duration)}
                                  activeOpacity={0.7}
                                  style={[
                                    tw`rounded-full ${
                                      appointmentDuration === duration
                                        ? 'bg-[#A3CB31]'
                                        : 'bg-gray-100'
                                    }`,
                                    {
                                      paddingHorizontal: horizontalScale(15),
                                      paddingVertical: verticalScale(7.5),
                                    },
                                  ]}>
                                  <Text
                                    style={[
                                      tw`font-dm ${
                                        appointmentDuration === duration
                                          ? 'text-white font-bold'
                                          : 'text-grey'
                                      }`,
                                      { fontSize: moderateScale(13.125) },
                                    ]}>
                                    {duration}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>

                          {/* Meeting Type Selection */}
                          <View style={{ marginBottom: verticalScale(22.5) }}>
                            <Text
                              style={[
                                tw`font-dm text-grey`,
                                {
                                  fontSize: moderateScale(13.125),
                                  marginBottom: verticalScale(7.5),
                                },
                              ]}>
                              Meeting Type
                            </Text>
                            <View style={[tw`flex-row flex-wrap`, { gap: verticalScale(7.5) }]}>
                              {meetingTypes.map((type) => {
                                const isSelected = appointmentType === type.id;
                                return (
                                  <TouchableOpacity
                                    key={type.id}
                                    onPress={() => setAppointmentType(type.id)}
                                    activeOpacity={0.7}
                                    style={[
                                      tw`flex-row items-center rounded-full border border-white`,
                                      {
                                        paddingLeft: horizontalScale(15),
                                        paddingRight: horizontalScale(7.5),
                                        paddingVertical: verticalScale(3.75),
                                      },
                                      { backgroundColor: isSelected ? '#FFF' : 'transparent' },
                                    ]}>
                                    <Text
                                      style={[
                                        tw`font-dm text-black`,
                                        {
                                          fontSize: moderateScale(13.125),
                                          marginRight: horizontalScale(7.5),
                                        },
                                      ]}
                                      numberOfLines={1}>
                                      {type.name}
                                    </Text>
                                    <View
                                      style={[
                                        tw`items-center justify-center`,
                                        {
                                          width: horizontalScale(33.75),
                                          height: horizontalScale(33.75),
                                        },
                                        { borderRadius: 99 },
                                        { backgroundColor: isSelected ? '#A3CB31' : '#D9D9D9' },
                                      ]}>
                                      <Image
                                        source={type.icon}
                                        style={[
                                          {
                                            width: horizontalScale(18.75),
                                            height: horizontalScale(18.75),
                                          },
                                          { tintColor: isSelected ? '#FFFFFF' : '#000000' },
                                        ]}
                                        resizeMode="contain"
                                      />
                                    </View>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>

                          {/* Location Selection */}
                          <View style={{ marginBottom: verticalScale(22.5) }}>
                            <Text
                              style={[
                                tw`font-dm text-grey`,
                                {
                                  fontSize: moderateScale(13.125),
                                  marginBottom: verticalScale(7.5),
                                },
                              ]}>
                              Location
                            </Text>
                            <View
                              style={[
                                tw`flex-row`,
                                { gap: horizontalScale(7.5), marginBottom: verticalScale(10) },
                              ]}>
                              <TouchableOpacity
                                onPress={() => {
                                  setMeetingLocationType('remote');
                                  setLocationQuery('');
                                  setPlaceResults([]);
                                  setSelectedPlace(null);
                                }}
                                activeOpacity={0.7}
                                style={[
                                  tw`flex-1 rounded-full items-center`,
                                  {
                                    paddingVertical: verticalScale(9),
                                    backgroundColor:
                                      meetingLocationType === 'remote' ? '#A3CB31' : '#F3F4F6',
                                  },
                                ]}>
                                <Text
                                  style={[
                                    tw`font-dm`,
                                    {
                                      fontSize: moderateScale(12.5),
                                      color:
                                        meetingLocationType === 'remote' ? '#FFFFFF' : '#6B7280',
                                      fontWeight: meetingLocationType === 'remote' ? '700' : '500',
                                    },
                                  ]}>
                                  Remote
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setMeetingLocationType('onsite')}
                                activeOpacity={0.7}
                                style={[
                                  tw`flex-1 rounded-full items-center`,
                                  {
                                    paddingVertical: verticalScale(9),
                                    backgroundColor:
                                      meetingLocationType === 'onsite' ? '#A3CB31' : '#F3F4F6',
                                  },
                                ]}>
                                <Text
                                  style={[
                                    tw`font-dm`,
                                    {
                                      fontSize: moderateScale(12.5),
                                      color:
                                        meetingLocationType === 'onsite' ? '#FFFFFF' : '#6B7280',
                                      fontWeight: meetingLocationType === 'onsite' ? '700' : '500',
                                    },
                                  ]}>
                                  Onsite
                                </Text>
                              </TouchableOpacity>
                            </View>

                            {meetingLocationType === 'remote' ? (
                              <View
                                style={[
                                  tw`bg-gray-100 rounded-2xl`,
                                  {
                                    paddingHorizontal: horizontalScale(15),
                                    paddingVertical: verticalScale(12),
                                  },
                                ]}>
                                <Text
                                  style={[
                                    tw`font-dm text-black`,
                                    {
                                      fontSize: moderateScale(13.125),
                                      marginBottom: verticalScale(4),
                                    },
                                  ]}>
                                  Remote meeting
                                </Text>
                                <Text
                                  style={[
                                    tw`font-dm text-grey`,
                                    { fontSize: moderateScale(11.25) },
                                  ]}>
                                  This meeting will be marked as remote for both attendees.
                                </Text>
                              </View>
                            ) : (
                              <View>
                                <TextInput
                                  style={[
                                    tw`bg-gray-100 rounded-2xl text-black font-dm`,
                                    {
                                      paddingHorizontal: horizontalScale(15),
                                      paddingVertical: verticalScale(11.25),
                                    },
                                  ]}
                                  placeholder={
                                    mapApiKey
                                      ? 'Search venue or address'
                                      : 'Add Google Places API key to enable search'
                                  }
                                  placeholderTextColor="#999"
                                  editable={Boolean(mapApiKey)}
                                  value={locationQuery}
                                  onChangeText={(text) => {
                                    setLocationQuery(text);
                                    setSelectedPlace(null);
                                  }}
                                />

                                {!mapApiKey ? (
                                  <Text
                                    style={[
                                      tw`font-dm text-grey`,
                                      {
                                        fontSize: moderateScale(10.5),
                                        marginTop: verticalScale(7.5),
                                      },
                                    ]}>
                                    Set `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` to enable Google place
                                    search and map preview.
                                  </Text>
                                ) : null}

                                {selectedPlace ? (
                                  <View
                                    style={[
                                      tw`bg-white rounded-2xl border border-gray-200 overflow-hidden`,
                                      { marginTop: verticalScale(10) },
                                    ]}>
                                    <View style={{ padding: moderateScale(12) }}>
                                      <Text
                                        style={[
                                          tw`font-dm text-black font-semibold`,
                                          {
                                            fontSize: moderateScale(13.125),
                                            marginBottom: verticalScale(3),
                                          },
                                        ]}>
                                        {selectedPlace.name}
                                      </Text>
                                      {selectedPlace.formatted_address ? (
                                        <Text
                                          style={[
                                            tw`font-dm text-grey`,
                                            { fontSize: moderateScale(10.75) },
                                          ]}>
                                          {selectedPlace.formatted_address}
                                        </Text>
                                      ) : null}
                                    </View>
                                    {buildStaticMapUrl(
                                      selectedPlace.geometry?.location?.lat,
                                      selectedPlace.geometry?.location?.lng
                                    ) ? (
                                      <View style={{ width: '100%', height: verticalScale(150), borderRadius: moderateScale(12), overflow: 'hidden', marginTop: verticalScale(8) }}>
                                        <MapView
                                          style={{ flex: 1 }}
                                          initialRegion={{
                                            latitude: selectedPlace.geometry!.location!.lat,
                                            longitude: selectedPlace.geometry!.location!.lng,
                                            latitudeDelta: 0.005,
                                            longitudeDelta: 0.005,
                                          }}
                                          scrollEnabled={true}
                                          zoomEnabled={true}
                                          pitchEnabled={false}
                                          rotateEnabled={false}
                                        >
                                          <Marker
                                            coordinate={{
                                              latitude: selectedPlace.geometry!.location!.lat,
                                              longitude: selectedPlace.geometry!.location!.lng,
                                            }}
                                            pinColor="#A3CB31"
                                          />
                                        </MapView>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}

                                {isLoadingPlaces ? (
                                  <View
                                    style={[
                                      tw`items-center`,
                                      { paddingVertical: verticalScale(12) },
                                    ]}>
                                    <ActivityIndicator size="small" color="#A3CB31" />
                                  </View>
                                ) : null}

                                {placeResults.length > 0 ? (
                                  <View
                                    style={[
                                      tw`bg-white rounded-2xl border border-gray-200 overflow-hidden`,
                                      { marginTop: verticalScale(10) },
                                    ]}>
                                    {placeResults.map((place, index) => (
                                      <TouchableOpacity
                                        key={place.place_id}
                                        onPress={() => {
                                          setSelectedPlace(place);
                                          setLocationQuery(place.name);
                                          setPlaceResults([]);
                                        }}
                                        activeOpacity={0.7}
                                        style={[
                                          tw`bg-white`,
                                          {
                                            paddingHorizontal: horizontalScale(15),
                                            paddingVertical: verticalScale(12),
                                          },
                                        ]}>
                                        <Text
                                          style={[
                                            tw`font-dm text-black font-semibold`,
                                            {
                                              fontSize: moderateScale(12.5),
                                              marginBottom: verticalScale(2),
                                            },
                                          ]}>
                                          {place.name}
                                        </Text>
                                        {place.formatted_address ? (
                                          <Text
                                            style={[
                                              tw`font-dm text-grey`,
                                              { fontSize: moderateScale(10.5) },
                                            ]}>
                                            {place.formatted_address}
                                          </Text>
                                        ) : null}
                                        {index < placeResults.length - 1 ? (
                                          <View
                                            style={[
                                              tw`bg-gray-100`,
                                              {
                                                height: verticalScale(1),
                                                marginTop: verticalScale(12),
                                              },
                                            ]}
                                          />
                                        ) : null}
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                ) : meetingLocationType === 'onsite' &&
                                  mapApiKey &&
                                  locationQuery.trim().length >= 2 &&
                                  !selectedPlace &&
                                  !isLoadingPlaces ? (
                                  <Text
                                    style={[
                                      tw`font-dm text-grey`,
                                      {
                                        fontSize: moderateScale(10.5),
                                        marginTop: verticalScale(7.5),
                                      },
                                    ]}>
                                    No matching locations found yet.
                                  </Text>
                                ) : null}
                              </View>
                            )}
                          </View>

                          {/* Submit Button */}
                          <TouchableOpacity
                            onPress={handleSubmitAppointment}
                            activeOpacity={0.7}
                            disabled={isSubmitting}
                            style={[
                              tw`bg-[#A3CB31] rounded-2xl items-center ${isSubmitting ? 'opacity-50' : ''}`,
                              {
                                paddingVertical: verticalScale(11.25),
                                marginTop: verticalScale(7.5),
                              },
                            ]}>
                            {isSubmitting ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text
                                style={[
                                  tw`text-white font-bold font-dm`,
                                  { fontSize: moderateScale(15) },
                                ]}>
                                Create Meeting
                              </Text>
                            )}
                          </TouchableOpacity>
                        </ScrollView>
                      </Animated.View>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </BlurView>
          </Animated.View>
        </Modal>
      )}

      {/* Moment Request Accept/Reject Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="none"
        onRequestClose={() => {
          Animated.parallel([
            Animated.timing(requestModalSlideAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(requestModalOpacityAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShowRequestModal(false);
            setSelectedRequest(null);
          });
        }}
        onShow={() => {
          // Animate in when modal becomes visible
          Animated.parallel([
            Animated.timing(requestModalSlideAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(requestModalOpacityAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }}>
        <Animated.View style={[tw`flex-1`, { opacity: requestModalOpacityAnim }]}>
          <BlurView intensity={20} style={tw`flex-1`}>
            <TouchableOpacity
              style={tw`flex-1`}
              activeOpacity={1}
              onPress={() => {
                Animated.parallel([
                  Animated.timing(requestModalSlideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                  Animated.timing(requestModalOpacityAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  setShowRequestModal(false);
                  setSelectedRequest(null);
                });
              }}>
              <View style={tw`flex-1 justify-end`}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <Animated.View
                    style={[
                      tw`bg-white rounded-t-3xl`,
                      {
                        maxHeight: Dimensions.get('window').height * 0.85,
                        transform: [
                          {
                            translateY: requestModalSlideAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [300, 0],
                            }),
                          },
                        ],
                      },
                    ]}>
                    {selectedRequest && (
                      <>
                        {/* Modal Header with Status Badge */}
                        <View
                          style={[
                            tw`flex-row justify-between items-center`,
                            { padding: moderateScale(20), paddingBottom: verticalScale(0) },
                          ]}>
                          <View style={tw`flex-1 mr-2`}>
                            <Text
                              style={[
                                tw`font-bold font-dm text-black`,
                                { fontSize: moderateScale(22.5), marginBottom: verticalScale(7.5) },
                              ]}>
                              {(() => {
                                const title =
                                  selectedRequest.title || selectedRequest.notes || 'Meeting';
                                const otherPersonName =
                                  selectedRequest.senderId === user.id
                                    ? selectedRequest.receiver?.name
                                    : selectedRequest.sender?.name;

                                // Replace any contact name in title with the correct one from viewer's perspective
                                // Match both old "Meeting with" and new "# catch" formats
                                const titlePattern = /(.+):\s*(?:#\s*catch|Meeting\s+with)\s+(.+)/i;
                                const match = title.match(titlePattern);

                                if (match && otherPersonName) {
                                  // Title has format "Duration: Meeting with/# catch Name"
                                  // Always display as "# catch {correct contact name}"
                                  const meetingType = match[1];
                                  return `${meetingType}: # catch ${otherPersonName}`;
                                }

                                return title;
                              })()}
                            </Text>
                            <View style={tw`flex-row items-center`}>
                              {selectedRequest.status === 'pending' && (
                                <View
                                  style={[
                                    tw`bg-gray-400 rounded-full`,
                                    {
                                      paddingHorizontal: horizontalScale(11.25),
                                      paddingVertical: verticalScale(3.75),
                                      marginRight: horizontalScale(7.5),
                                    },
                                  ]}>
                                  <Text
                                    style={[
                                      tw`text-white font-dm font-semibold`,
                                      { fontSize: moderateScale(11.25) },
                                    ]}>
                                    Pending
                                  </Text>
                                </View>
                              )}
                              {selectedRequest.status === 'approved' && (
                                <View
                                  style={[
                                    tw`bg-green-500 rounded-full`,
                                    {
                                      paddingHorizontal: horizontalScale(11.25),
                                      paddingVertical: verticalScale(3.75),
                                      marginRight: horizontalScale(7.5),
                                    },
                                  ]}>
                                  <Text
                                    style={[
                                      tw`text-white font-dm font-semibold`,
                                      { fontSize: moderateScale(11.25) },
                                    ]}>
                                    Accepted
                                  </Text>
                                </View>
                              )}
                              {selectedRequest.status === 'rejected' && (
                                <View
                                  style={[
                                    tw`bg-red-500 rounded-full`,
                                    {
                                      paddingHorizontal: horizontalScale(11.25),
                                      paddingVertical: verticalScale(3.75),
                                      marginRight: horizontalScale(7.5),
                                    },
                                  ]}>
                                  <Text
                                    style={[
                                      tw`text-white font-dm font-semibold`,
                                      { fontSize: moderateScale(11.25) },
                                    ]}>
                                    Rejected
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              Animated.parallel([
                                Animated.timing(requestModalSlideAnim, {
                                  toValue: 0,
                                  duration: 300,
                                  useNativeDriver: true,
                                }),
                                Animated.timing(requestModalOpacityAnim, {
                                  toValue: 0,
                                  duration: 300,
                                  useNativeDriver: true,
                                }),
                              ]).start(() => {
                                setShowRequestModal(false);
                                setSelectedRequest(null);
                              });
                            }}
                            activeOpacity={0.7}
                            style={{
                              width: horizontalScale(30),
                              height: horizontalScale(30),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                            <Text style={[tw`text-grey`, { fontSize: moderateScale(22.5) }]}>
                              ✕
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <ScrollView
                          contentContainerStyle={{
                            paddingHorizontal: moderateScale(20),
                            paddingBottom: moderateScale(20),
                          }}
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled={true}>
                        {/* Date and Time */}
                        <View
                          style={[
                            tw`border-b border-gray-200`,
                            { marginBottom: verticalScale(15), paddingBottom: verticalScale(15) },
                          ]}>
                          <View
                            style={[
                              tw`flex-row items-center`,
                              { marginBottom: verticalScale(7.5) },
                            ]}>
                            <Image
                              source={CalendarIcon}
                              style={{
                                width: moderateScale(20),
                                height: moderateScale(20),
                                marginRight: horizontalScale(7.5),
                              }}
                              resizeMode="contain"
                              tintColor="black"
                            />
                            <View style={tw`flex-1`}>
                              <Text
                                style={[
                                  tw`font-dm text-grey`,
                                  {
                                    fontSize: moderateScale(13.125),
                                    marginBottom: verticalScale(3.75),
                                  },
                                ]}>
                                Date
                              </Text>
                              <Text
                                style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                {new Date(selectedRequest.startTime).toLocaleDateString([], {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={[
                              tw`flex-row items-center`,
                              { marginTop: verticalScale(11.25) },
                            ]}>
                            <Image
                              source={TimeIcon}
                              style={{
                                width: moderateScale(20),
                                height: moderateScale(20),
                                marginRight: horizontalScale(7.5),
                              }}
                              resizeMode="contain"
                              tintColor="black"
                            />
                            <View style={tw`flex-1`}>
                              <Text
                                style={[
                                  tw`font-dm text-grey`,
                                  {
                                    fontSize: moderateScale(13.125),
                                    marginBottom: verticalScale(3.75),
                                  },
                                ]}>
                                Time
                              </Text>
                              <Text
                                style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                {new Date(selectedRequest.startTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                -{' '}
                                {new Date(selectedRequest.endTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Location */}
                        <View
                          style={[
                            tw`border-b border-gray-200`,
                            { marginBottom: verticalScale(15), paddingBottom: verticalScale(15) },
                          ]}>
                          <View style={tw`flex-row items-center`}>
                            <Image
                              source={BusinessIcon}
                              style={{
                                width: moderateScale(20),
                                height: moderateScale(20),
                                marginRight: horizontalScale(7.5),
                              }}
                              resizeMode="contain"
                              tintColor="black"
                            />
                            <View style={tw`flex-1`}>
                              <Text
                                style={[
                                  tw`font-dm text-grey`,
                                  {
                                    fontSize: moderateScale(13.125),
                                    marginBottom: verticalScale(3.75),
                                  },
                                ]}>
                                Location
                              </Text>
                              <Text
                                style={[
                                  tw`font-dm text-black font-semibold`,
                                  { fontSize: moderateScale(15) },
                                ]}>
                                {selectedRequest.locationType === 'onsite'
                                  ? selectedRequest.locationLabel || 'Onsite meeting'
                                  : 'Remote meeting'}
                              </Text>
                              {selectedRequest.locationAddress ? (
                                <Text
                                  style={[
                                    tw`font-dm text-grey`,
                                    {
                                      fontSize: moderateScale(11.25),
                                      marginTop: verticalScale(3.75),
                                    },
                                  ]}>
                                  {selectedRequest.locationAddress}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {buildStaticMapUrl(
                            selectedRequest.locationLatitude,
                            selectedRequest.locationLongitude
                          ) ? (
                            <View style={{
                              width: '100%',
                              height: verticalScale(150),
                              marginTop: verticalScale(12),
                              borderRadius: moderateScale(16),
                              overflow: 'hidden',
                            }}>
                              <MapView
                                style={{ flex: 1 }}
                                initialRegion={{
                                  latitude: selectedRequest.locationLatitude!,
                                  longitude: selectedRequest.locationLongitude!,
                                  latitudeDelta: 0.005,
                                  longitudeDelta: 0.005,
                                }}
                                scrollEnabled={true}
                                zoomEnabled={true}
                                pitchEnabled={false}
                                rotateEnabled={false}
                              >
                                <Marker
                                  coordinate={{
                                    latitude: selectedRequest.locationLatitude!,
                                    longitude: selectedRequest.locationLongitude!,
                                  }}
                                  pinColor="#A3CB31"
                                />
                              </MapView>
                            </View>
                          ) : null}
                        </View>

                        {/* Participants */}
                        <View
                          style={[
                            tw`border-b border-gray-200`,
                            { marginBottom: verticalScale(15), paddingBottom: verticalScale(15) },
                          ]}>
                          <View style={tw`flex-row items-center`}>
                            <Image
                              source={ProfileIcon}
                              style={{
                                width: moderateScale(20),
                                height: moderateScale(20),
                                marginRight: horizontalScale(7.5),
                              }}
                              resizeMode="contain"
                              tintColor="black"
                            />
                            <View style={tw`flex-1`}>
                              <Text
                                style={[
                                  tw`font-dm text-grey`,
                                  {
                                    fontSize: moderateScale(13.125),
                                    marginBottom: verticalScale(7.5),
                                  },
                                ]}>
                                {selectedRequest.receiverId === user.id ? 'From' : 'To'}
                              </Text>
                              <Text
                                style={[
                                  tw`font-dm text-black font-semibold`,
                                  { fontSize: moderateScale(15) },
                                ]}>
                                {selectedRequest.receiverId === user.id
                                  ? selectedRequest.sender?.name ||
                                    selectedRequest.sender?.phoneNumber ||
                                    'Unknown'
                                  : selectedRequest.receiver?.name ||
                                    selectedRequest.receiver?.phoneNumber ||
                                    'Unknown'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Description/Notes */}
                        {selectedRequest.notes && (
                          <View style={{ marginBottom: verticalScale(22.5) }}>
                            <Text
                              style={[
                                tw`font-dm text-grey`,
                                {
                                  fontSize: moderateScale(13.125),
                                  marginBottom: verticalScale(7.5),
                                },
                              ]}>
                              Description
                            </Text>
                            <Text
                              style={[
                                tw`font-dm text-black leading-5`,
                                { fontSize: moderateScale(15) },
                              ]}>
                              {(() => {
                                const notes = selectedRequest.notes || '';
                                const otherPersonName =
                                  selectedRequest.senderId === user.id
                                    ? selectedRequest.receiver?.name
                                    : selectedRequest.sender?.name;

                                // Replace any contact name in description with the correct one from viewer's perspective
                                // Match both old "Meeting with" and new "# catch" formats
                                const descPattern = /(?:Meeting\s+with|#\s*catch)\s+(.+)/i;

                                if (otherPersonName && descPattern.test(notes)) {
                                  // Replace with "# catch {correct contact name}"
                                  return notes.replace(descPattern, `# catch ${otherPersonName}`);
                                }

                                return notes;
                              })()}
                            </Text>
                          </View>
                        )}

                        {/* Action Buttons */}
                        {selectedRequest.senderId === user.id ? (
                          // User is the sender - show Cancel button in any condition
                          <View style={{ marginTop: verticalScale(15) }}>
                            <TouchableOpacity
                              onPress={handleCancelMeeting}
                              activeOpacity={0.7}
                              disabled={isCanceling}
                              style={[
                                tw`bg-white rounded-2xl border-black border-[1px] items-center ${isCanceling ? 'opacity-50' : ''}`,
                                { paddingVertical: verticalScale(15) },
                              ]}>
                              {isCanceling ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text
                                  style={[
                                    tw`text-black font-bold font-dm`,
                                    { fontSize: moderateScale(15) },
                                  ]}>
                                  {selectedRequest.status === 'pending'
                                    ? 'Cancel Request'
                                    : 'Cancel Meeting'}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        ) : selectedRequest.receiverId === user.id &&
                          selectedRequest.status === 'pending' ? (
                          // Receiver + pending — show Accept/Reject buttons
                          <View
                            style={[
                              tw`flex-row`,
                              { gap: horizontalScale(11.25), marginTop: verticalScale(15) },
                            ]}>
                            <TouchableOpacity
                              onPress={handleRejectRequest}
                              activeOpacity={0.7}
                              disabled={isRejecting || isAccepting}
                              style={[
                                tw`flex-1 bg-white rounded-2xl border-[#F0F0F0] border-[1px] items-center ${isRejecting || isAccepting ? 'opacity-50' : ''}`,
                                { paddingVertical: verticalScale(15) },
                              ]}>
                              {isRejecting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text
                                  style={[
                                    tw`text-black font-bold font-dm`,
                                    { fontSize: moderateScale(15) },
                                  ]}>
                                  Reject
                                </Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={handleAcceptRequest}
                              activeOpacity={0.7}
                              disabled={isAccepting || isRejecting}
                              style={[
                                tw`flex-1 bg-black rounded-2xl items-center ${isAccepting || isRejecting ? 'opacity-50' : ''}`,
                                { paddingVertical: verticalScale(15) },
                              ]}>
                              {isAccepting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text
                                  style={[
                                    tw`text-white font-bold font-dm`,
                                    { fontSize: moderateScale(15) },
                                  ]}>
                                  Accept
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        ) : selectedRequest.receiverId === user.id &&
                          selectedRequest.status === 'approved' ? (
                          // Receiver + approved — show Cancel Meeting button
                          <View style={{ marginTop: verticalScale(15) }}>
                            <TouchableOpacity
                              onPress={handleCancelMeeting}
                              activeOpacity={0.7}
                              disabled={isCanceling}
                              style={[
                                tw`bg-white rounded-2xl border-black border-[1px] items-center ${isCanceling ? 'opacity-50' : ''}`,
                                { paddingVertical: verticalScale(15) },
                              ]}>
                              {isCanceling ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text
                                  style={[
                                    tw`text-black font-bold font-dm`,
                                    { fontSize: moderateScale(15) },
                                  ]}>
                                  Cancel Meeting
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        ) : null}
                        </ScrollView>
                      </>
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </Modal>

      {/* External Event Detail Modal */}
      <Modal
        visible={showExternalEventModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          Animated.parallel([
            Animated.timing(externalEventModalSlideAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(externalEventModalOpacityAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setShowExternalEventModal(false);
            setSelectedExternalEvent(null);
          });
        }}
        onShow={() => {
          Animated.parallel([
            Animated.timing(externalEventModalSlideAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(externalEventModalOpacityAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        }}>
        <Animated.View style={[tw`flex-1`, { opacity: externalEventModalOpacityAnim }]}>
          <BlurView intensity={20} style={tw`flex-1`}>
            <TouchableOpacity
              style={tw`flex-1`}
              activeOpacity={1}
              onPress={() => {
                Animated.parallel([
                  Animated.timing(externalEventModalSlideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                  Animated.timing(externalEventModalOpacityAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  setShowExternalEventModal(false);
                  setSelectedExternalEvent(null);
                });
              }}>
              <View style={tw`flex-1 justify-end`}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <Animated.View
                    style={[
                      tw`bg-white rounded-t-3xl`,
                      {
                        maxHeight: Dimensions.get('window').height * 0.85,
                        transform: [
                          {
                            translateY: externalEventModalSlideAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [300, 0],
                            }),
                          },
                        ],
                      },
                    ]}>
                    {selectedExternalEvent && (
                      <>
                        {/* Header */}
                        <View
                          style={[
                            tw`flex-row justify-between items-center`,
                            { padding: moderateScale(20), paddingBottom: verticalScale(0) },
                          ]}>
                          <View style={tw`flex-1 mr-2`}>
                            <View style={[tw`flex-row items-center`, { marginBottom: verticalScale(7.5) }]}>
                              <View
                                style={[
                                  tw`rounded-full`,
                                  {
                                    backgroundColor:
                                      selectedExternalEvent.source === 'google'
                                        ? '#4285F4'
                                        : selectedExternalEvent.source === 'microsoft'
                                          ? '#0078D4'
                                          : '#8E8E93',
                                    paddingHorizontal: horizontalScale(10),
                                    paddingVertical: verticalScale(3),
                                    marginRight: horizontalScale(8),
                                  },
                                ]}>
                                <Text
                                  style={[
                                    tw`text-white font-dm font-semibold`,
                                    { fontSize: moderateScale(11.25) },
                                  ]}>
                                  {sourceLabels[selectedExternalEvent.source]}
                                </Text>
                              </View>
                            </View>
                            <Text
                              style={[
                                tw`font-bold font-dm text-black`,
                                { fontSize: moderateScale(22.5) },
                              ]}>
                              {selectedExternalEvent.title}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              Animated.parallel([
                                Animated.timing(externalEventModalSlideAnim, {
                                  toValue: 0,
                                  duration: 300,
                                  useNativeDriver: true,
                                }),
                                Animated.timing(externalEventModalOpacityAnim, {
                                  toValue: 0,
                                  duration: 300,
                                  useNativeDriver: true,
                                }),
                              ]).start(() => {
                                setShowExternalEventModal(false);
                                setSelectedExternalEvent(null);
                              });
                            }}
                            activeOpacity={0.7}
                            style={{
                              width: horizontalScale(30),
                              height: horizontalScale(30),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                            <Text style={[tw`text-grey`, { fontSize: moderateScale(22.5) }]}>
                              ✕
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <ScrollView
                          contentContainerStyle={{
                            paddingHorizontal: moderateScale(20),
                            paddingBottom: moderateScale(20),
                          }}
                          showsVerticalScrollIndicator={false}
                          nestedScrollEnabled={true}>
                          {/* Date and Time */}
                          <View
                            style={[
                              tw`border-b border-gray-200`,
                              { marginBottom: verticalScale(15), paddingBottom: verticalScale(15), marginTop: verticalScale(15) },
                            ]}>
                            <View
                              style={[
                                tw`flex-row items-center`,
                                { marginBottom: verticalScale(7.5) },
                              ]}>
                              <Image
                                source={CalendarIcon}
                                style={{
                                  width: moderateScale(20),
                                  height: moderateScale(20),
                                  marginRight: horizontalScale(7.5),
                                }}
                                resizeMode="contain"
                                tintColor="black"
                              />
                              <View style={tw`flex-1`}>
                                <Text
                                  style={[
                                    tw`font-dm text-grey`,
                                    {
                                      fontSize: moderateScale(13.125),
                                      marginBottom: verticalScale(3.75),
                                    },
                                  ]}>
                                  Date
                                </Text>
                                <Text
                                  style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                  {new Date(selectedExternalEvent.startTime).toLocaleDateString([], {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={[
                                tw`flex-row items-center`,
                                { marginTop: verticalScale(11.25) },
                              ]}>
                              <Image
                                source={TimeIcon}
                                style={{
                                  width: moderateScale(20),
                                  height: moderateScale(20),
                                  marginRight: horizontalScale(7.5),
                                }}
                                resizeMode="contain"
                                tintColor="black"
                              />
                              <View style={tw`flex-1`}>
                                <Text
                                  style={[
                                    tw`font-dm text-grey`,
                                    {
                                      fontSize: moderateScale(13.125),
                                      marginBottom: verticalScale(3.75),
                                    },
                                  ]}>
                                  Time
                                </Text>
                                <Text
                                  style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                  {new Date(selectedExternalEvent.startTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  -{' '}
                                  {new Date(selectedExternalEvent.endTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Calendar Source */}
                          {selectedExternalEvent.locationLabel ? (
                            <View
                              style={[
                                tw`border-b border-gray-200`,
                                { marginBottom: verticalScale(15), paddingBottom: verticalScale(15) },
                              ]}>
                              <View style={tw`flex-row items-center`}>
                                <Image
                                  source={CalendarIcon}
                                  style={{
                                    width: moderateScale(20),
                                    height: moderateScale(20),
                                    marginRight: horizontalScale(7.5),
                                  }}
                                  resizeMode="contain"
                                  tintColor="black"
                                />
                                <View style={tw`flex-1`}>
                                  <Text
                                    style={[
                                      tw`font-dm text-grey`,
                                      {
                                        fontSize: moderateScale(13.125),
                                        marginBottom: verticalScale(3.75),
                                      },
                                    ]}>
                                    Calendar
                                  </Text>
                                  <Text
                                    style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                    {selectedExternalEvent.locationLabel}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ) : null}

                          {/* Location */}
                          {selectedExternalEvent.locationAddress ? (
                            <View
                              style={[
                                tw`border-b border-gray-200`,
                                { marginBottom: verticalScale(15), paddingBottom: verticalScale(15) },
                              ]}>
                              <View style={tw`flex-row items-center`}>
                                <Image
                                  source={BusinessIcon}
                                  style={{
                                    width: moderateScale(20),
                                    height: moderateScale(20),
                                    marginRight: horizontalScale(7.5),
                                  }}
                                  resizeMode="contain"
                                  tintColor="black"
                                />
                                <View style={tw`flex-1`}>
                                  <Text
                                    style={[
                                      tw`font-dm text-grey`,
                                      {
                                        fontSize: moderateScale(13.125),
                                        marginBottom: verticalScale(3.75),
                                      },
                                    ]}>
                                    Location
                                  </Text>
                                  <Text
                                    style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                    {selectedExternalEvent.locationAddress}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ) : null}

                          {/* Description */}
                          {selectedExternalEvent.description ? (
                            <View style={{ marginBottom: verticalScale(15) }}>
                              <Text
                                style={[
                                  tw`font-dm text-grey`,
                                  {
                                    fontSize: moderateScale(13.125),
                                    marginBottom: verticalScale(7.5),
                                  },
                                ]}>
                                Description
                              </Text>
                              <Text
                                style={[
                                  tw`font-dm text-black leading-5`,
                                  { fontSize: moderateScale(15) },
                                ]}>
                                {selectedExternalEvent.description}
                              </Text>
                            </View>
                          ) : null}
                        </ScrollView>
                      </>
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </Modal>

      {/* Contact Selection Modal - Only render when create modal is not active */}
      {!showCreateModal && !isTransitioningModals && (
        <Modal
          visible={showContactModal}
          transparent={true}
          animationType="none"
          onRequestClose={handleCloseContactModal}
          onShow={() => {
            // Animate in when modal becomes visible
            Animated.parallel([
              Animated.timing(contactModalSlideAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(contactModalOpacityAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();
          }}>
          <Animated.View style={[tw`flex-1`, { opacity: contactModalOpacityAnim }]}>
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
            <KeyboardAvoidingView
              style={tw`flex-1`}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}>
              <TouchableOpacity
                style={tw`flex-1`}
                activeOpacity={1}
                onPress={handleCloseContactModal}>
                <View
                  style={tw`flex-1 justify-end`}
                  onLayout={(e) => setContactModalContentHeight(e.nativeEvent.layout.height)}>
                  <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                    <Animated.View
                      style={[
                        tw`bg-white rounded-t-3xl`,
                        {
                          transform: [
                            {
                              translateY: contactModalSlideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [300, 0],
                              }),
                            },
                          ],
                        },
                      ]}>
                      {/* Header - Fixed */}
                      <View
                        style={[
                          tw`flex-row justify-between items-center`,
                          {
                            paddingTop: verticalScale(22.5),
                            paddingHorizontal: horizontalScale(15),
                            paddingBottom: verticalScale(15),
                          },
                        ]}>
                        <Text
                          style={[
                            tw`text-black font-bold font-dm`,
                            { fontSize: moderateScale(18.75) },
                          ]}>
                          Select Contact
                        </Text>
                        <TouchableOpacity onPress={handleCloseContactModal} activeOpacity={0.7}>
                          <Text
                            style={[tw`text-[#A3CB31] font-dm`, { fontSize: moderateScale(15) }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Search Bar - Fixed */}
                      <View
                        style={[
                          tw`bg-gray-100 rounded-2xl flex-row items-center`,
                          {
                            paddingHorizontal: horizontalScale(15),
                            paddingVertical: verticalScale(11.25),
                            marginBottom: verticalScale(15),
                            marginHorizontal: horizontalScale(15),
                          },
                        ]}>
                        <Image
                          source={Search}
                          style={{
                            width: horizontalScale(18.75),
                            height: horizontalScale(18.75),
                            marginRight: horizontalScale(7.5),
                          }}
                        />
                        <TextInput
                          style={tw`flex-1 text-black font-dm`}
                          placeholder="Search contacts"
                          placeholderTextColor="#999"
                          value={contactSearchText}
                          onChangeText={setContactSearchText}
                        />
                      </View>

                      {/* Contacts List - Scrollable */}
                      <ScrollView
                        style={{ maxHeight: contactScrollMaxHeight }}
                        contentContainerStyle={{
                          paddingHorizontal: horizontalScale(15),
                          paddingBottom: verticalScale(30),
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((contact) => {
                            const isDisabled = !contact.contactUser?.id;
                            return (
                              <TouchableOpacity
                                key={contact.id}
                                style={[
                                  tw`flex-row items-center border-b border-gray-100`,
                                  { paddingVertical: verticalScale(15) },
                                  isDisabled && tw`opacity-50`,
                                ]}
                                activeOpacity={isDisabled ? 1 : 0.7}
                                onPress={() => !isDisabled && handleContactSelect(contact)}
                                disabled={isDisabled}>
                                <View
                                  style={[
                                    tw`rounded-full bg-gray-200 items-center justify-center overflow-hidden`,
                                    {
                                      width: horizontalScale(45),
                                      height: horizontalScale(45),
                                      marginRight: horizontalScale(15),
                                    },
                                  ]}>
                                  {contact.contactUser?.avatar ? (
                                    <Image
                                      source={{ uri: contact.contactUser.avatar }}
                                      style={{
                                        width: horizontalScale(45),
                                        height: horizontalScale(45),
                                        borderRadius: 9999,
                                      }}
                                    />
                                  ) : (
                                    <Image
                                      source={Avatar}
                                      style={{
                                        width: horizontalScale(30),
                                        height: horizontalScale(30),
                                      }}
                                    />
                                  )}
                                </View>
                                <View style={tw`flex-1`}>
                                  <Text
                                    style={[
                                      tw`text-black font-bold font-dm`,
                                      { fontSize: moderateScale(15) },
                                    ]}>
                                    {contact.displayName}
                                  </Text>
                                  {contact.contactPhone && (
                                    <Text
                                      style={[
                                        tw`text-grey font-dm`,
                                        { fontSize: moderateScale(13.125) },
                                      ]}>
                                      {phoneNumberMap.get(contact.contactPhone) ||
                                        contact.contactPhone}
                                    </Text>
                                  )}
                                  {isDisabled && (
                                    <Text
                                      style={[
                                        tw`text-grey font-dm`,
                                        {
                                          fontSize: moderateScale(11.25),
                                          marginTop: verticalScale(3.75),
                                        },
                                      ]}>
                                      Not registered
                                    </Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <View
                            style={{ paddingVertical: verticalScale(37.5), alignItems: 'center' }}>
                            <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(15) }]}>
                              No contacts found
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </Animated.View>
        </Modal>
      )}

      {/* Toast notification */}
      <Toast message={toastMessage} visible={showToast} onHide={() => setShowToast(false)} />
    </View>
  );
};

export default AppStack_DateDetailScreen;
