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
import tw from 'tailwindcss';
import { Avatar, Background, Notification, Search, HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, AddIcon, GymIcon, FootballIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { useAddButton } from '~/contexts/AddButtonContext';
import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';

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
  const { setOnAddPress } = useAddButton();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dates, setDates] = useState<DateItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedMeetingType, setSelectedMeetingType] = useState('meet');
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Contact selection
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearchText, setContactSearchText] = useState('');

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
    icon: string;
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

  // Register add button handler
  useEffect(() => {
    setOnAddPress(() => () => setShowAddMenu(true));

    // Cleanup on unmount
    return () => {
      setOnAddPress(undefined);
    };
  }, [setOnAddPress]);

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

        // Create a map of phone numbers to local contact avatars
        const phoneToAvatarMap = new Map<string, string>();
        data.forEach(contact => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0 && contact.image?.uri) {
            const avatarUri = contact.image.uri;
            contact.phoneNumbers.forEach(phone => {
              // Normalize phone number (remove spaces, dashes, parentheses)
              const normalized = phone.number?.replace(/[\s\-\(\)]/g, '') || '';
              if (normalized && avatarUri) {
                phoneToAvatarMap.set(normalized, avatarUri);
              }
            });
          }
        });

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
          if (code === 0) return { description: 'Clear sky', icon: '☀️' };
          if (code <= 3) return { description: 'Partly cloudy', icon: '⛅' };
          if (code <= 48) return { description: 'Foggy', icon: '🌫️' };
          if (code <= 67) return { description: 'Rainy', icon: '🌧️' };
          if (code <= 77) return { description: 'Snowy', icon: '❄️' };
          if (code <= 82) return { description: 'Rain showers', icon: '🌦️' };
          if (code <= 86) return { description: 'Snow showers', icon: '🌨️' };
          if (code <= 99) return { description: 'Thunderstorm', icon: '⛈️' };
          return { description: 'Cloudy', icon: '☁️' };
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
        icon: '☁️☀️',
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

  // Load contacts when modal opens
  useEffect(() => {
    if (showContactModal) {
      loadContacts();
    }
  }, [showContactModal]);

  const loadContacts = async () => {
    try {
      const response = await http.get('/users/contacts');
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  // Calculate recent contacts based on meeting frequency
  const getRecentContacts = () => {
    if (!allMeetings || !Array.isArray(allMeetings)) return [];
    const contactFrequency: Record<string, number> = {};

    // Count meetings per contact
    allMeetings.forEach(meeting => {
      const otherPersonId = meeting.sender?.id === userId ? meeting.receiver?.id : meeting.sender?.id;
      if (otherPersonId) {
        contactFrequency[otherPersonId] = (contactFrequency[otherPersonId] || 0) + 1;
      }
    });

    // Sort contacts by frequency and get top 3
    const recentContacts = contacts
      .filter(contact => contactFrequency[contact.contactUser?.id || ''] > 0)
      .sort((a, b) => {
        const freqA = contactFrequency[a.contactUser?.id || ''] || 0;
        const freqB = contactFrequency[b.contactUser?.id || ''] || 0;
        return freqB - freqA;
      })
      .slice(0, 3);

    return recentContacts;
  };

  const recentContacts = getRecentContacts();
  const recentContactIds = new Set(recentContacts.map(c => c.id));

  // Filter out recent contacts from main list
  const filteredContacts = contacts
    .filter(contact => !recentContactIds.has(contact.id))
    .filter(contact => contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase()));
  const handleBookMeeting = () => {
    setShowAddMenu(false);
    // Close menu first, then navigate after a brief delay to ensure modal closes
    setTimeout(() => {
      const today = new Date().toISOString().split('T')[0];
      navigation.navigate('AppStack_DateDetailScreen', {
        date: today
      });
    }, 100);
  };

  const handleContactSelect = (contact: Contact) => {
    setShowContactModal(false);
    // Navigate to DateDetailScreen with selected contact
    const today = new Date().toISOString().split('T')[0];
    navigation.navigate('AppStack_DateDetailScreen', {
      date: today,
      contact: contact
    });
  };

  // Get local avatar for a phone number
  const getLocalAvatar = (phoneNumber?: string) => {
    if (!phoneNumber) return null;
    const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
    return localAvatars.get(normalized) || null;
  };


  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={[tw`pb-24`, { paddingTop: Math.max(insets.top, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[tw`flex-1`, { paddingHorizontal: '8%' }]}>
          {/* Header */}
          <View style={tw`flex-row justify-between items-center my-2`}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AppStack_ProfileScreen')}
              activeOpacity={0.5}
            >
              <Image source={Avatar} style={tw`w-13 h-13`} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('AppStack_NotificationScreen')}
              activeOpacity={0.5}
              style={tw`relative`}
            >
              <Image source={Notification} style={tw`w-13 h-13`} />
              {unreadNotificationCount > 0 && (
                <View style={tw`absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center`}>
                  <Text style={tw`text-white text-xs font-bold`}>
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
              contentContainerStyle={tw`flex-row gap-2`}
            >
              {dates.map((item, index) => {
                const selected = isSelected(item.fullDate);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedDate(item.fullDate)}
                    activeOpacity={0.7}
                    style={tw`flex-col items-center justify-center rounded-full pt-3 ${selected ? 'bg-black' : 'bg-white'
                      }`}
                  >
                    <Text style={tw`text-sm font-dm ${selected ? 'text-white' : 'text-grey'}`}>
                      {item.day}
                    </Text>
                    <View style={tw`rounded-full ${selected ? 'bg-white' : 'bg-gray-200'} m-1 flex-row items-center justify-center w-10 h-10`}>
                      <Text style={tw`text-base font-dm`}>{item.date.toString().padStart(2, '0')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Bar */}
          <View style={tw`mt-4 mb-4`}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => navigation.navigate('AppStack_SearchScreen')}
            >
              <View style={tw`flex-row items-center bg-white rounded-full px-4 py-3`}>
                <Text style={tw`flex-1 font-dm text-sm text-grey`}>
                  Search your meeting types
                </Text>
                <Image source={Search} style={tw`w-5 h-5`} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Information Cards */}
          <View style={tw`flex-row gap-2 mb-2`}>
            {/* Today's Date Card */}
            <View style={tw`bg-[#A3CB31] rounded-2xl py-2 px-2 items-center justify-center w-[35%]`}>
              <Text style={tw`text-white text-[14px] font-dm mb-1`}>Last</Text>
              <Text style={tw`text-white text-[40px] font-bold font-dm mb-1`}>
                {formatDate(new Date(), 'd')}
              </Text>
              <Text style={tw`text-white text-[14px] font-dm`}>
                {formatDate(new Date(), 'MMMM')}
              </Text>
            </View>

            {/* Upcoming Meeting Card */}
            <View style={tw`flex-1 bg-white rounded-2xl p-2.5 shadow-sm justify-center`}>
              {upcomingMeeting ? (
                <>
                  <Text style={tw`text-black text-sm font-bold font-dm mb-0.5`} numberOfLines={1}>
                    {upcomingMeeting.title || upcomingMeeting.notes || 'Untitled Meeting'}
                  </Text>
                  <Text style={tw`text-grey text-[10px] font-dm mb-0.5`} numberOfLines={1}>
                    {upcomingMeeting.sender?.id === userId
                      ? upcomingMeeting.receiver?.name
                      : upcomingMeeting.sender?.name}
                  </Text>
                  <Text style={tw`text-grey text-[14px] font-dm`}>
                    {formatDate(new Date(upcomingMeeting.startTime), 'MMM do')} from{' '}
                    {formatDate(new Date(upcomingMeeting.startTime), 'h:mm')} -{' '}
                    {formatDate(new Date(upcomingMeeting.endTime), 'h:mm a')}
                  </Text>
                </>
              ) : (
                <Text style={tw`text-grey text-[14px] font-dm text-center`}>
                  No Upcoming Appointment
                </Text>
              )}
            </View>
          </View>

          {/* Heavy Traffic Card */}
          <View style={tw`mb-2`}>
            <View style={tw`bg-black rounded-2xl p-2.5 flex-row items-center justify-between`}>
              <View style={tw`flex-1`}>
                <Text style={tw`text-white text-xs font-dm mb-0.5`}>Heavy traffic</Text>
                <Text style={tw`text-white text-[24px] font-bold font-dm mb-0.5`}>1.2 km away</Text>
                <Text style={tw`text-white text-[10px] font-dm text-gray-400 mb-0.5`}>
                  Gardiner Expressway Near CN Tower
                </Text>
                <Text style={tw`text-white text-[9px] font-dm text-gray-500`}>
                  4 min ago by OneLoner
                </Text>
              </View>
              <View style={tw`w-12 h-12 rounded-full bg-orange-500 items-center justify-center border border-white`}>
                {/* Three cars in diagonal queue representation */}
                <View style={tw`relative w-8 h-8`}>
                  {/* First car (red, front) */}
                  <View style={tw`absolute top-0 left-0 w-3 h-2 bg-red-500 rounded-sm`} />
                  {/* Second car (orange, middle) */}
                  <View style={tw`absolute top-1.5 left-1.5 w-3 h-2 bg-orange-300 rounded-sm`} />
                  {/* Third car (yellow, back) */}
                  <View style={tw`absolute top-3 left-3 w-3 h-2 bg-yellow-300 rounded-sm`} />
                </View>
              </View>
            </View>
          </View>

          {/* Weather Card */}
          <View style={tw`mb-4`}>
            {weatherLoading ? (
              <View style={tw`bg-black rounded-2xl p-2.5 items-center justify-center`}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : weather ? (
              <View style={tw`bg-black rounded-2xl p-2.5 flex-row items-center justify-between`}>
                <Text style={tw`text-white text-[28px] font-dm`}>{weather.temperature}°</Text>
                <View style={tw`flex-1 ml-3`}>
                  <Text style={tw`text-white text-sm font-dm`}>{weather.description}</Text>
                  <Text style={tw`text-white text-[10px] font-dm text-gray-400`}>
                    {formatDate(selectedDate, 'MMM do')}
                  </Text>
                </View>
                <Text style={tw`text-white text-2xl`}>{weather.icon}</Text>
              </View>
            ) : null}
          </View>

          {/* Meeting Type Filters */}
          <View style={tw`mb-4`}>
            <Text style={tw`text-black text-lg font-bold font-dm mb-3`}>Your meeting types</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={tw`flex-row gap-3`}
            >
              {meetingTypes.map((type) => {
                const isSelected = selectedMeetingType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setSelectedMeetingType(type.id)}
                    activeOpacity={0.7}
                    style={[
                      tw`flex-row items-center pl-4 pr-2 py-1 rounded-full border border-white`,
                      { minWidth: 100 },
                      { backgroundColor: isSelected ? '#FFF' : 'transparent' }
                    ]}
                  >
                    <Text
                      style={tw`font-dm text-sm text-black flex-1`}
                    >
                      {type.name}
                    </Text>
                    <View
                      style={[
                        tw`w-9 h-9 items-center justify-center`,
                        { borderRadius: 99 },
                        { backgroundColor: isSelected ? '#A3CB31' : '#D9D9D9' }
                      ]}
                    >
                      <Image
                        source={type.icon}
                        style={[
                          tw`w-5 h-5`,
                          { tintColor: isSelected ? '#FFFFFF' : '#000000' }
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
          <View style={tw`mb-4`}>
            {loading ? (
              <View style={tw`py-10 items-center`}>
                <ActivityIndicator size="large" color="#A3CB31" />
              </View>
            ) : filteredMeetings.length > 0 ? (
              filteredMeetings.map((meeting) => {
                const otherPerson = meeting.senderId === userId ? meeting.receiver : meeting.sender;
                const localAvatar = getLocalAvatar(otherPerson?.phoneNumber);

                return (
                  <TouchableOpacity
                    key={meeting.id}
                    style={tw`bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm`}
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
                    <View style={tw`w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-4 overflow-hidden`}>
                      {localAvatar ? (
                        <Image
                          source={{ uri: localAvatar }}
                          style={tw`w-12 h-12 rounded-full`}
                        />
                      ) : (
                        <Image source={Avatar} style={tw`w-8 h-8`} />
                      )}
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={tw`text-black text-sm font-bold font-dm mb-1`}>
                        {meeting.title || meeting.notes || 'Untitled Meeting'}
                      </Text>
                      <Text style={tw`text-grey text-xs font-dm`}>
                        {formatMeetingDuration(meeting.startTime, meeting.endTime)} •{' '}
                        {formatDate(new Date(meeting.startTime), 'h:mm a')}
                      </Text>
                    </View>
                    <View style={tw`items-center justify-center`}>
                      <View style={tw`w-1 h-1 rounded-full bg-gray-400 mb-1`} />
                      <View style={tw`w-1 h-1 rounded-full bg-gray-400`} />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={tw`py-10 items-center`}>
                <Text style={tw`text-grey text-base font-dm`}>No meetings scheduled</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Menu Popup Modal */}
      <Modal
        visible={showAddMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <View style={tw`flex-1`}>
          {/* Blurred and Darkened Background */}
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={() => setShowAddMenu(false)}
          >
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
          </TouchableOpacity>

          {/* Popup Menu */}
          <View style={tw`absolute bottom-0 left-0 right-0 items-center pb-24`}>
            <View style={tw`bg-white rounded-3xl w-5/6 overflow-hidden p-4`}>
              {/* Book a meeting */}
              <TouchableOpacity
                style={tw`flex-row items-center px-6 py-4`}
                activeOpacity={0.7}
                onPress={handleBookMeeting}
              >
                <View style={tw`w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-4`}>
                  <Text style={tw`text-black text-xl font-bold`}>+</Text>
                </View>
                <Text style={tw`text-black text-base font-dm flex-1`}>Book a meeting</Text>
              </TouchableOpacity>

              {/* Separator */}
              <View style={tw`h-px bg-gray-200 mx-6`} />

              {/* Create meeting type */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center px-6 py-4`,
                  tw`opacity-50`
                ]}
                activeOpacity={1}
                disabled={true}
              >
                <View style={tw`w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-4`}>
                  <Text style={tw`text-black text-xl font-bold`}>+</Text>
                </View>
                <Text style={tw`text-black text-base font-dm flex-1`}>Create meeting type</Text>
              </TouchableOpacity>

              {/* Separator */}
              <View style={tw`h-px bg-gray-200 mx-6`} />

              {/* Manage availability */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center px-6 py-4`,
                  tw`opacity-50`
                ]}
                activeOpacity={1}
                disabled={true}
              >
                <View style={tw`w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-4`}>
                  <Text style={tw`text-black text-xl font-bold`}>+</Text>
                </View>
                <Text style={tw`text-black text-base font-dm flex-1`}>Manage availability</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Selection Modal */}
      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={tw`flex-1`}>
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={() => setShowContactModal(false)}
          >
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
          </TouchableOpacity>

          <View style={tw`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl`}>
            <View style={[tw`pt-6 pb-8`, { paddingHorizontal: '4%' }]}>
              {/* Header */}
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={tw`text-black text-xl font-bold font-dm`}>Select Contact</Text>
                <TouchableOpacity
                  onPress={() => setShowContactModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={tw`text-[#A3CB31] text-base font-dm`}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={tw`bg-gray-100 rounded-2xl px-4 py-3 flex-row items-center mb-4`}>
                <Image source={Search} style={tw`w-5 h-5 mr-2`} />
                <TextInput
                  style={tw`flex-1 text-black font-dm`}
                  placeholder="Search contacts"
                  placeholderTextColor="#999"
                  value={contactSearchText}
                  onChangeText={setContactSearchText}
                />
              </View>

              {/* Contacts List */}
              <ScrollView style={tw`max-h-96`} showsVerticalScrollIndicator={false}>
                {/* Recent Contacts Section */}
                {recentContacts.length > 0 && !contactSearchText && (
                  <View style={tw`mb-2`}>
                    <Text style={tw`text-grey text-xs font-bold font-dm mb-2 px-1`}>RECENT</Text>
                    {recentContacts.map((contact) => {
                      const isDisabled = !contact.contactUser?.id;
                      return (
                        <TouchableOpacity
                          key={contact.id}
                          style={[
                            tw`flex-row items-center py-4 border-b border-gray-100`,
                            isDisabled && tw`opacity-50`
                          ]}
                          activeOpacity={isDisabled ? 1 : 0.7}
                          onPress={() => !isDisabled && handleContactSelect(contact)}
                          disabled={isDisabled}
                        >
                          <View style={tw`w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-4 overflow-hidden`}>
                            {contact.contactUser?.avatar ? (
                              <Image
                                source={{ uri: contact.contactUser.avatar }}
                                style={tw`w-12 h-12 rounded-full`}
                              />
                            ) : (
                              <Image source={Avatar} style={tw`w-8 h-8`} />
                            )}
                          </View>
                          <View style={tw`flex-1`}>
                            <Text style={tw`text-black text-base font-bold font-dm`}>
                              {contact.displayName}
                            </Text>
                            {contact.contactPhone && (
                              <Text style={tw`text-grey text-sm font-dm`}>
                                {contact.contactPhone}
                              </Text>
                            )}
                            {isDisabled && (
                              <Text style={tw`text-grey text-xs font-dm mt-1`}>
                                Not registered
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* All Contacts Section */}
                {filteredContacts.length > 0 && (
                  <View>
                    {recentContacts.length > 0 && !contactSearchText && (
                      <Text style={tw`text-grey text-xs font-bold font-dm mb-2 px-1 mt-2`}>ALL CONTACTS</Text>
                    )}
                    {filteredContacts.map((contact) => {
                      const isDisabled = !contact.contactUser?.id;
                      return (
                        <TouchableOpacity
                          key={contact.id}
                          style={[
                            tw`flex-row items-center py-4 border-b border-gray-100`,
                            isDisabled && tw`opacity-50`
                          ]}
                          activeOpacity={isDisabled ? 1 : 0.7}
                          onPress={() => !isDisabled && handleContactSelect(contact)}
                          disabled={isDisabled}
                        >
                          <View style={tw`w-12 h-12 rounded-full bg-gray-200 items-center justify-center mr-4 overflow-hidden`}>
                            {contact.contactUser?.avatar ? (
                              <Image
                                source={{ uri: contact.contactUser.avatar }}
                                style={tw`w-12 h-12 rounded-full`}
                              />
                            ) : (
                              <Image source={Avatar} style={tw`w-8 h-8`} />
                            )}
                          </View>
                          <View style={tw`flex-1`}>
                            <Text style={tw`text-black text-base font-bold font-dm`}>
                              {contact.displayName}
                            </Text>
                            {contact.contactPhone && (
                              <Text style={tw`text-grey text-sm font-dm`}>
                                {contact.contactPhone}
                              </Text>
                            )}
                            {isDisabled && (
                              <Text style={tw`text-grey text-xs font-dm mt-1`}>
                                Not registered
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* No Contacts Message */}
                {filteredContacts.length === 0 && recentContacts.length === 0 && (
                  <View style={tw`py-10 items-center`}>
                    <Text style={tw`text-grey text-base font-dm`}>No contacts found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_HomePageScreen;
