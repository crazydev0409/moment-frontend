import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Text, Image, View, TouchableOpacity, ScrollView, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as Notifications from 'expo-notifications';
import { AppStackParamList } from '.';
import tw from '~/tailwindcss';
import { Avatar, Background, Notification, Search, HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, AddIcon, GymIcon, FootballIcon, TrafficJam, WeClearSky, WeFoggy, WePartlyCloudy, WeRainy, WeSnowy, WeRainShower, WeSnowShower, WeThunderstorm } from '~/lib/images';
import { http } from '~/helpers/http';

import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { hashPhoneNumber } from '~/utils/phoneHash';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_HomePageScreen'>;

interface DateItem {
  day: string;
  date: number;
  fullDate: Date;
}

interface MeetingType {
  id: string;
  name: string;
  icon: any; // Image source
  selected: boolean;
}

interface Contact {
  id: string;
  displayName: string;
  contactPhone?: string;
  contactUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
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

const formatDate = (date: Date, formatStr: string): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const getOrdinalSuffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
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

const AppStack_HomePageScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dates, setDates] = useState<DateItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedMeetingType, setSelectedMeetingType] = useState('meet');

  const [phoneNumberMap, setPhoneNumberMap] = useState<Map<string, string>>(new Map());

  // Meetings data
  const [allMeetings, setAllMeetings] = useState<MomentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [userMeetingTypes, setUserMeetingTypes] = useState<string[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([
    { id: 'meet', name: 'Meet', icon: CalendarIcon, selected: true },
    { id: 'gym', name: 'Gym', icon: GymIcon, selected: false },
    { id: 'football', name: 'Football', icon: FootballIcon, selected: false },
  ]);

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
  }, []);

  useEffect(() => {
    fetchUserData();
    fetchMeetings();
    fetchUnreadNotificationCount();
    requestLocationAndFetchWeather();
    loadLocalContactAvatars();
    loadPhoneNumberMapping();
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
          },
          // Meeting accepted/rejected → sender gets update
          onMomentResponse: (data) => {
            console.log('[HomePage] ✅ Meeting accepted/rejected socket event received:', {
              eventType: data.eventType,
              momentRequestId: data.momentRequestId,
              senderId: data.senderId,
              receiverId: data.receiverId,
              fullData: data
            });

            // Determine status from eventType
            const newStatus = data.eventType === 'moment.request.approved' ? 'approved' : 'rejected';
            console.log('[HomePage] New status:', newStatus);

            // Immediately update the request status in state if request exists
            if (data.momentRequestId) {
              setAllMeetings(prev => {
                const updated = prev.map(meeting => {
                  if (meeting.id === data.momentRequestId) {
                    console.log('[HomePage] Found request in state, updating status:', meeting.id);
                    return {
                      ...meeting,
                      status: newStatus
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
          },
          // Meeting canceled → receiver gets update
          onMomentCanceled: (data) => {
            console.log('[HomePage] ❌ Meeting canceled - refreshing...');
            fetchMeetings();
            fetchUnreadNotificationCount();
          }
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
        const meetingTypesArray = response.data.meetingTypes || [];
        setUserMeetingTypes(meetingTypesArray);

        // Update meetingTypes based on user's selected types
        const allTypes: MeetingType[] = [
          { id: 'meet', name: 'Meet', icon: CalendarIcon, selected: false },
          { id: 'gym', name: 'Gym', icon: GymIcon, selected: false },
          { id: 'football', name: 'Football', icon: FootballIcon, selected: false },
        ];

        // Filter to only show user's selected types
        const filteredTypes = allTypes.filter(type => meetingTypesArray.includes(type.id));
        if (filteredTypes.length > 0) {
          filteredTypes[0].selected = true;
          setMeetingTypes(filteredTypes);
        } else {
          // Default to 'meet' if no types selected
          setMeetingTypes([{ id: 'meet', name: 'Meet', icon: CalendarIcon, selected: true }]);
        }
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
        http.get('/users/moment-requests/sent')
      ]);

      // Backend returns { requests: [...] } for both endpoints
      const received = Array.isArray(receivedResponse.data.requests) ? receivedResponse.data.requests : [];
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
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.Image,
            Contacts.Fields.PhoneNumbers
          ],
        });

        // Create a map of hashed phone numbers to local contact avatars
        const phoneToAvatarMap = new Map<string, string>();

        // Process contacts sequentially or in parallel? Parallel is faster.
        await Promise.all(data.map(async (contact) => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0 && contact.image?.uri) {
            const avatarUri = contact.image.uri;
            await Promise.all(contact.phoneNumbers.map(async (phone) => {
              // Normalize phone number
              const normalized = phone.number?.replace(/[\s\-\(\)]/g, '') || '';
              if (normalized && avatarUri) {
                // Determine if it already looks like a hash or needs hashing
                // During transition, some might be raw, some might be hashed
                // But specifically for local contacts, we ALWAYS hash them to match backend hashes
                const hashed = await hashPhoneNumber(normalized);
                phoneToAvatarMap.set(hashed, avatarUri);
              }
            }));
          }
        }));

        setLocalAvatars(phoneToAvatarMap);
      }
    } catch (error) {
      console.error('Error loading local contact avatars:', error);
    }
  };

  // Load local contacts to create a mapping from hashed to original phone numbers
  const loadPhoneNumberMapping = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });

        const mapping = new Map<string, string>();
        await Promise.all(data.map(async (contact) => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
            await Promise.all(contact.phoneNumbers.map(async (phone) => {
              const normalized = phone.number?.replace(/[\s\-\(\)]/g, '') || '';
              if (normalized) {
                const hashed = await hashPhoneNumber(normalized);
                mapping.set(hashed, phone.number || normalized);
              }
            }));
          }
        }));

        setPhoneNumberMap(mapping);
      }
    } catch (error) {
      console.error('Error loading phone number mapping:', error);
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

  // Filter meetings by selected date and meeting type
  const getFilteredMeetings = () => {
    if (!allMeetings || !Array.isArray(allMeetings)) return [];
    return allMeetings.filter((meeting) => {
      const meetingDate = new Date(meeting.startTime);
      const dateMatch = isSameDay(meetingDate, selectedDate);
      const typeMatch = selectedMeetingType === 'meet' || meeting.meetingType?.toLowerCase() === selectedMeetingType;
      return dateMatch && typeMatch && meeting.status === 'approved';
    });
  };

  // Get next upcoming meeting
  const getUpcomingMeeting = () => {
    if (!allMeetings || !Array.isArray(allMeetings)) return null;
    const now = new Date();
    const upcoming = allMeetings
      .filter((meeting) => {
        const meetingDate = new Date(meeting.startTime);
        return isAfter(meetingDate, now) && meeting.status === 'approved';
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return upcoming.length > 0 ? upcoming[0] : null;
  };

  const filteredMeetings = getFilteredMeetings();
  const upcomingMeeting = getUpcomingMeeting();

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const getMeetingTypeIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'gym':
        return '🏋️';
      case 'football':
        return '⚽';
      default:
        return '📅';
    }
  };

  const formatMeetingDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    return `${durationMinutes} min`;
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
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ paddingBottom: verticalScale(75), paddingTop: Math.max(insets.top, 40) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flex: 1, paddingHorizontal: '8%' }}>
          {/* Header */}
          <View style={[tw`flex-row justify-between items-center`, { marginVertical: verticalScale(7.5) }]}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AppStack_ProfileScreen')}
              activeOpacity={0.5}
            >
              <Image source={Avatar} style={{ width: horizontalScale(48.75), height: horizontalScale(48.75) }} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('AppStack_NotificationScreen')}
              activeOpacity={0.5}
              style={tw`relative`}
            >
              <Image source={Notification} style={{ width: horizontalScale(48.75), height: horizontalScale(48.75) }} />
              {unreadNotificationCount > 0 && (
                <View style={[tw`absolute bg-red-500 rounded-full items-center justify-center`, { top: -verticalScale(3.75), right: -horizontalScale(3.75), width: horizontalScale(18.75), height: horizontalScale(18.75) }]}>
                  <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(11.25) }]}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Date Selector */}
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: horizontalScale(7.5) }}
            >
              {dates.map((item, index) => {
                const selected = isSelected(item.fullDate);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedDate(item.fullDate)}
                    activeOpacity={0.7}
                    style={[tw`flex-col items-center justify-center rounded-full ${selected ? 'bg-black' : 'bg-white'
                      }`, { paddingTop: verticalScale(11.25) }]}
                  >
                    <Text style={[tw`font-dm ${selected ? 'text-white' : 'text-grey'}`, { fontSize: moderateScale(13) }]}>
                      {item.day}
                    </Text>
                    <View style={[tw`rounded-full ${selected ? 'bg-white' : 'bg-gray-200'} flex-row items-center justify-center`, { margin: moderateScale(3.75), width: horizontalScale(37.5), height: horizontalScale(37.5) }]}>
                      <Text style={[tw`font-dm`, { fontSize: moderateScale(15) }]}>{item.date.toString().padStart(2, '0')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Bar */}
          <View style={{ marginVertical: verticalScale(15) }}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => navigation.navigate('AppStack_SearchScreen')}
            >
              <View style={[tw`flex-row items-center bg-white rounded-full`, { paddingHorizontal: horizontalScale(15), paddingVertical: verticalScale(11.25) }]}>
                <Text style={[tw`flex-1 font-dm text-grey`, { fontSize: moderateScale(13) }]}>
                  Search your meeting types
                </Text>
                <Image source={Search} style={{ width: horizontalScale(18.75), height: horizontalScale(18.75) }} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Information Cards */}
          <View style={{ flexDirection: 'row', gap: horizontalScale(7.5), marginBottom: verticalScale(7.5), height: verticalScale(150) }}>
            {/* Today's Date Card */}
            <View style={[tw`bg-[#A3CB31] rounded-2xl items-center justify-center`, { padding: moderateScale(7.5), width: horizontalScale(131.25) }]}>
              <Text style={[tw`text-white font-dm`, { fontSize: moderateScale(13), marginBottom: verticalScale(3.75) }]}>Last</Text>
              <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(37.5), marginBottom: verticalScale(3.75) }]}>
                {formatDate(new Date(), 'd')}
              </Text>
              <Text style={[tw`text-white font-dm`, { fontSize: moderateScale(13) }]}>
                {formatDate(new Date(), 'MMMM')}
              </Text>
            </View>

            {/* Upcoming Meeting Card - flex: 6 */}
            <View style={[tw`bg-white rounded-2xl shadow-sm justify-center`, { flex: 6, padding: moderateScale(9.375) }]}>
              {upcomingMeeting ? (
                <>
                  <Text style={[tw`text-black font-bold font-dm`, { fontSize: moderateScale(13), marginBottom: verticalScale(1.875) }]} numberOfLines={1}>
                    {upcomingMeeting.title || upcomingMeeting.notes || 'Untitled Meeting'}
                  </Text>
                  <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(9.375), marginBottom: verticalScale(1.875) }]} numberOfLines={1}>
                    {upcomingMeeting.sender?.id === userId
                      ? upcomingMeeting.receiver?.name
                      : upcomingMeeting.sender?.name}
                  </Text>
                  <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(13) }]}>
                    {formatDate(new Date(upcomingMeeting.startTime), 'MMM do')} from{' '}
                    {formatDate(new Date(upcomingMeeting.startTime), 'h:mm')} -{' '}
                    {formatDate(new Date(upcomingMeeting.endTime), 'h:mm a')}
                  </Text>
                </>
              ) : (
                <Text style={[tw`text-grey font-dm text-center`, { fontSize: moderateScale(13) }]}>
                  No Upcoming Appointment
                </Text>
              )}
            </View>
          </View>

          {/* Heavy Traffic Card - flex: 3 */}
          <View style={{ marginBottom: verticalScale(7.5), height: verticalScale(90) }}>
            <View style={[tw`bg-black rounded-2xl flex-row items-center justify-between`, { padding: moderateScale(9.375), flex: 1 }]}>
              <View style={tw`flex-1`}>
                <Text style={[tw`text-white font-dm`, { fontSize: moderateScale(11.25), marginBottom: verticalScale(1.875) }]}>Heavy traffic</Text>
                <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(22.5), marginBottom: verticalScale(1.875) }]}>1.2 km away</Text>
                <Text style={[tw`text-white font-dm text-gray-400`, { fontSize: moderateScale(9.375), marginBottom: verticalScale(1.875) }]}>
                  Gardiner Expressway Near CN Tower
                </Text>
                <Text style={[tw`text-white font-dm text-gray-500`, { fontSize: moderateScale(8.25) }]}>
                  4 min ago by OneLoner
                </Text>
              </View>
              <View style={[tw`rounded-full bg-white items-center justify-center border border-white`, { width: horizontalScale(45), height: horizontalScale(45) }]}>
                <Image source={TrafficJam} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} />
              </View>
            </View>
          </View>

          {/* Weather Card - flex: 1 */}
          <View style={{ marginBottom: verticalScale(15), height: verticalScale(50) }}>
            {weatherLoading ? (
              <View style={[tw`bg-white rounded-2xl items-center justify-center`, { padding: moderateScale(9.375), flex: 1 }]}>
                <ActivityIndicator size="small" color="#000000" />
              </View>
            ) : weather ? (
              <View style={[tw`bg-white rounded-2xl flex-row items-center justify-between`, { padding: moderateScale(9.375), flex: 1 }]}>
                <Text style={[tw`text-black font-dm`, { fontSize: moderateScale(26.25) }]}>{weather.temperature}°</Text>
                <View style={[tw`flex-1`, { marginLeft: horizontalScale(11.25) }]}>
                  <Text style={[tw`text-black font-dm`, { fontSize: moderateScale(13) }]}>{weather.description}</Text>
                  <Text style={[tw`text-gray-500 font-dm`, { fontSize: moderateScale(9.375) }]}>
                    {formatDate(selectedDate, 'MMM do')}
                  </Text>
                </View>
                <Image source={weather.icon} style={{ width: horizontalScale(30), height: horizontalScale(30) }} resizeMode="contain" />
              </View>
            ) : null}
          </View>

          {/* Meeting Type Filters */}
          <View style={{ marginBottom: verticalScale(15) }}>
            <Text style={[tw`text-black font-bold font-dm`, { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) }]}>Your meeting types</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: horizontalScale(11.25) }}
            >
              {meetingTypes.map((type) => {
                const isSelected = selectedMeetingType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setSelectedMeetingType(type.id)}
                    activeOpacity={0.7}
                    style={[
                      tw`flex-row items-center rounded-full border border-white`,
                      { paddingLeft: horizontalScale(10), paddingRight: horizontalScale(7.5), paddingVertical: verticalScale(3.75) },
                      { minWidth: '25%' },
                      { backgroundColor: isSelected ? '#000' : '#FFF' }
                    ]}
                  >
                    <Text
                      style={[tw`font-dm flex-1`, { fontSize: moderateScale(13), marginRight: horizontalScale(5) }, { color: isSelected ? "#FFF" : "#000" }]}
                    >
                      {type.name}
                    </Text>
                    <View
                      style={[
                        tw`items-center justify-center ${isSelected ? 'bg-white' : 'bg-gray-200'}`,
                        { width: horizontalScale(33.75), height: horizontalScale(33.75) },
                        { borderRadius: 99 },
                      ]}
                    >
                      <Image
                        source={type.icon}
                        style={[
                          { width: horizontalScale(18.75), height: horizontalScale(18.75) },
                          { tintColor: '#000000' }
                        ]}
                        resizeMode="contain"
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Meeting List */}
          <View style={{ marginBottom: verticalScale(15) }}>
            {loading ? (
              <View style={{ paddingVertical: verticalScale(37.5), alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#A3CB31" />
              </View>
            ) : filteredMeetings.length > 0 ? (
              filteredMeetings.map((meeting) => {
                const otherPerson = meeting.senderId === userId ? meeting.receiver : meeting.sender;
                const localAvatar = getLocalAvatar(otherPerson?.phoneNumber);

                return (
                  <TouchableOpacity
                    key={meeting.id}
                    style={[tw`bg-white rounded-2xl flex-row items-center shadow-sm`, { padding: moderateScale(15), marginBottom: verticalScale(11.25) }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      // Use local date components to avoid timezone issues
                      const meetingDate = new Date(meeting.startTime);
                      const year = meetingDate.getFullYear();
                      const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
                      const day = String(meetingDate.getDate()).padStart(2, '0');
                      const dateParam = `${year}-${month}-${day}`;
                      navigation.navigate('AppStack_DateDetailScreen', { date: dateParam });
                    }}
                  >
                    <View style={[tw`rounded-full bg-gray-200 items-center justify-center overflow-hidden`, { width: horizontalScale(45), height: horizontalScale(45), marginRight: horizontalScale(15) }]}>
                      {localAvatar ? (
                        <Image
                          source={{ uri: localAvatar }}
                          style={{ width: horizontalScale(45), height: horizontalScale(45), borderRadius: 9999 }}
                        />
                      ) : (
                        <Image source={Avatar} style={{ width: horizontalScale(30), height: horizontalScale(30) }} />
                      )}
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`text-black font-bold font-dm`, { fontSize: moderateScale(13), marginBottom: verticalScale(3.75) }]}>
                        {meeting.title || meeting.notes || 'Untitled Meeting'}
                      </Text>
                      <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25) }]}>
                        {formatMeetingDuration(meeting.startTime, meeting.endTime)} •{' '}
                        {formatDate(new Date(meeting.startTime), 'h:mm a')}
                      </Text>
                    </View>
                    <View style={tw`items-center justify-center`}>
                      <View style={[tw`rounded-full bg-gray-400`, { width: horizontalScale(3.75), height: horizontalScale(3.75), marginBottom: verticalScale(3.75) }]} />
                      <View style={[tw`rounded-full bg-gray-400`, { width: horizontalScale(3.75), height: horizontalScale(3.75) }]} />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{ paddingVertical: verticalScale(37.5), alignItems: 'center' }}>
                <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(15) }]}>No meetings scheduled</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Menu Popup Modal */}

    </View>
  );
};

export default AppStack_HomePageScreen;
