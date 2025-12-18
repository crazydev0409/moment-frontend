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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';
import { useAtom } from 'jotai';
import tw from '../../../tailwindcss';
import { AppStackParamList } from '.';
import { Background, Notification, Avatar, AddIcon, HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, BackArrow, Search, GymIcon, FootballIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { userAtom } from '~/store';
import Toast from '~/components/Toast';
import { setupSocketEventListeners, getSocket, initializeSocket } from '~/services/socketService';

type Props = NativeStackScreenProps<
  AppStackParamList,
  'AppStack_DateDetailScreen'
>;

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
  contactUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface MeetingType {
  id: string;
  name: string;
  icon: any; // Image source
}

const AppStack_DateDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  // Get current user
  const [user, setUser] = useAtom(userAtom);

  // Get the selected date and contact from route params
  const selectedDateParam = route.params?.date || new Date().toISOString().split('T')[0];
  const routeContact = route.params?.contact;
  const routeMomentRequestId = route.params?.momentRequestId;
  const [selectedDate, setSelectedDate] = useState(selectedDateParam);
  const [availabilityView, setAvailabilityView] = useState<'scheduled' | 'full'>('scheduled');

  // Selected contact from route or state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(routeContact || null);
  const [appointmentTitle, setAppointmentTitle] = useState('30 Minute Meeting');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentDuration, setAppointmentDuration] = useState('30 min');
  const [appointmentType, setAppointmentType] = useState('meet');
  const [userMeetingTypes, setUserMeetingTypes] = useState<string[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MomentRequest | null>(null);
  
  // Contact selection modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearchText, setContactSearchText] = useState('');
  
  // Animation values for smooth modal transitions
  const createModalSlideAnim = useRef(new Animated.Value(0)).current;
  const createModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const requestModalSlideAnim = useRef(new Animated.Value(0)).current;
  const requestModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const contactModalSlideAnim = useRef(new Animated.Value(0)).current;
  const contactModalOpacityAnim = useRef(new Animated.Value(0)).current;
  
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
  const [contactAvailability, setContactAvailability] = useState<string[]>([]);
  const [contactMomentRequests, setContactMomentRequests] = useState<any[]>([]);

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

  // Get meeting types based on user's selected types
  const getMeetingTypes = (): MeetingType[] => {
    const allTypes: MeetingType[] = [
      { id: 'meet', name: 'Meet', icon: CalendarIcon },
      { id: 'gym', name: 'Gym', icon: GymIcon },
      { id: 'football', name: 'Football', icon: FootballIcon },
    ];
    
    // Filter to only show user's selected types
    if (userMeetingTypes.length > 0) {
      return allTypes.filter(type => userMeetingTypes.includes(type.id));
    }
    
    // Default to 'meet' if no types selected
    return [{ id: 'meet', name: 'Meet', icon: CalendarIcon }];
  };

  const meetingTypes = getMeetingTypes();

  const durationOptions = ['30 min', '1 hr', '1h 30min', '2hr'];

  // Sample meetings data - in real app, this would come from API
  const [meetings] = useState<Meeting[]>([
    { id: '1', title: 'Quick check in', duration: '30 min', platform: 'Zoom', date: new Date(2025, 6, 30), time: '20:00' },
    { id: '2', title: 'Quick check in', duration: '30 min', platform: 'Zoom', date: new Date(2025, 6, 30), time: '21:00' },
    { id: '3', title: 'Intro call', duration: '30 min', platform: 'Zoom', date: new Date(2025, 6, 30), time: '23:00' },
    { id: '4', title: '30 Minute Meeting', duration: '30 min', platform: 'Zoom', date: new Date(2025, 6, 30), time: '00:00' },
  ]);

  // Generate all available time slots (30-minute intervals, 24-hour format)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
  };

  const allTimeSlots = generateTimeSlots();

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
    return meetings.filter(meeting => {
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

    return momentRequests.filter(request => {
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
    const sorted = [...requests].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
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

  // Handle clicking on a moment request block
  // Handle clicking on a meeting block - show details modal
  const handleRequestBlockPress = (request: MomentRequest) => {
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
  };

  // Handle accepting a moment request
  const handleAcceptRequest = async () => {
    if (!selectedRequest || isAccepting) return;

    try {
      setIsAccepting(true);
      await http.post(`/users/moment-requests/${selectedRequest.id}/respond`, {
        approved: true,
      });

      // Refresh moment requests
      await fetchMomentRequests();

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
    const successMessage = isPending ? 'Request Canceled' : 'Meeting Canceled';
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
          style: 'cancel'
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
              if (selectedContact) {
                await fetchContactMomentRequests();
              }

              setShowRequestModal(false);
              setSelectedRequest(null);
              showToastMessage(successBody);
            } catch (error: any) {
              console.error('Error canceling meeting:', error);
              showToastMessage(error.response?.data?.error || 'Failed to cancel');
            } finally {
              setIsCanceling(false);
            }
          }
        }
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthNum - 1];
  };

  // Get the first and last day of the week for header display
  const firstDayOfWeek = weekDates[0].date;
  const lastDayOfWeek = weekDates[6].date;
  const firstMonthAbbr = getMonthAbbreviation(`${firstDayOfWeek.getFullYear()}-${String(firstDayOfWeek.getMonth() + 1).padStart(2, '0')}`);
  const lastMonthAbbr = getMonthAbbreviation(`${lastDayOfWeek.getFullYear()}-${String(lastDayOfWeek.getMonth() + 1).padStart(2, '0')}`);
  const lastYear = lastDayOfWeek.getFullYear();

  const filteredMeetings = getMeetingsForDate(selectedDate);

  // Get scheduled times for the selected date, sorted by time
  const scheduledTimes = filteredMeetings
    .map(m => m.time || '')
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

      const allRequests = [
        ...(receivedRes.data.requests || []),
        ...(sentRes.data.requests || []),
      ];

      console.log('[DateDetailScreen] All moment requests fetched:', allRequests.length, allRequests.map(r => ({ id: r.id, status: r.status })));

      // Filter requests for the selected date
      const [year, month, day] = selectedDate.split('-').map(Number);
      const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
      const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59);

      const filteredRequests = allRequests.filter((request: MomentRequest) => {
        const requestDate = new Date(request.startTime);
        // Check if request is on the selected date
        return requestDate >= selectedDateStart && requestDate <= selectedDateEnd;
      });

      console.log(`[DateDetailScreen] Filtered ${filteredRequests.length} requests for date ${selectedDate}:`, filteredRequests.map(r => ({ id: r.id, status: r.status })));

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
  }, [fetchMomentRequests]);

  // Refresh when screen comes into focus (e.g., after accepting/rejecting from notification)
  useFocusEffect(
    useCallback(() => {
      fetchMomentRequests();
    }, [fetchMomentRequests])
  );

  // Listen for notifications and refresh when receiver accepts/rejects via push notification
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      const eventType = data.eventType || data.type;
      
      console.log('[DateDetailScreen] 📬 Notification received:', { eventType, momentRequestId: data.momentRequestId });
      
      // Refresh when receiver accepts/rejects via push notification
      if (
        eventType === 'moment.request.approved' ||
        eventType === 'moment.request.rejected'
      ) {
        console.log('[DateDetailScreen] 📬 Notification received for accept/reject, updating state...');
        
        // Immediately update the request status in state if request exists
        if (data.momentRequestId) {
          const newStatus: 'approved' | 'rejected' = eventType === 'moment.request.approved' ? 'approved' : 'rejected';
          setMomentRequests(prev => {
            const updated = prev.map(request => {
              if (request.id === data.momentRequestId) {
                console.log('[DateDetailScreen] Found request in state, updating status:', request.id);
                return {
                  ...request,
                  status: newStatus
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
        }, 1000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchMomentRequests]);

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
          },
          // Meeting accepted/rejected → sender gets update
          onMomentResponse: (data) => {
            console.log('[DateDetailScreen] ✅ Meeting accepted/rejected socket event received:', {
              eventType: data.eventType,
              momentRequestId: data.momentRequestId,
              senderId: data.senderId,
              receiverId: data.receiverId,
              fullData: data
            });
            
            // Determine status from eventType
            const newStatus: 'approved' | 'rejected' = data.eventType === 'moment.request.approved' ? 'approved' : 'rejected';
            console.log('[DateDetailScreen] New status:', newStatus);
            
            // Immediately update the request status in state if request exists
            if (data.momentRequestId) {
              setMomentRequests(prev => {
                const updated = prev.map(request => {
                  if (request.id === data.momentRequestId) {
                    console.log('[DateDetailScreen] Found request in state, updating status:', request.id);
                    return {
                      ...request,
                      status: newStatus
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
            }, 1000);
          },
          // Meeting canceled → receiver gets update
          onMomentCanceled: (data) => {
            console.log('[DateDetailScreen] ❌ Meeting canceled - refreshing...', data);
            
            // Immediately remove the canceled request from state if we have the ID
            if (data.momentRequestId) {
              setMomentRequests(prev => prev.filter(req => req.id !== data.momentRequestId));
              console.log('[DateDetailScreen] Removed canceled request from state:', data.momentRequestId);
            }
            
            // Then refetch to ensure consistency
            setTimeout(() => {
              fetchMomentRequests();
            }, 1000);
          }
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

  // Auto-open modal when navigating with momentRequestId (from push notification or notification screen)
  useEffect(() => {
    if (routeMomentRequestId && momentRequests.length > 0) {
      const request = momentRequests.find(r => r.id === routeMomentRequestId);
      if (request && request.status === 'pending' && request.receiverId === user?.id) {
        // Only auto-open if user is the receiver and request is pending
        setSelectedRequest(request);
        setShowRequestModal(true);
        console.log('📬 Auto-opening moment request modal for:', routeMomentRequestId);
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
      }
    }
  }, [routeMomentRequestId, momentRequests, user?.id, requestModalSlideAnim, requestModalOpacityAnim]);

  // Fetch contact's moment requests when contact is selected
  const fetchContactMomentRequests = useCallback(async () => {
    if (!selectedContact?.contactUser?.id) {
      setContactMomentRequests([]);
      return;
    }

    try {
      // Fetch contact's moment requests for the selected date
      const [year, month, day] = selectedDate.split('-').map(Number);
      const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
      const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59);

      // Fetch all moment requests for the contact
      const response = await http.get(`/users/${selectedContact.contactUser.id}/moment-requests`);
      const allContactRequests = response.data.requests || [];

      // Filter for selected date
      const filteredContactRequests = allContactRequests.filter((request: MomentRequest) => {
        const requestDate = new Date(request.startTime);
        return requestDate >= selectedDateStart && requestDate <= selectedDateEnd;
      });

      setContactMomentRequests(filteredContactRequests);
    } catch (error) {
      console.error('Error fetching contact moment requests:', error);
      setContactMomentRequests([]);
    }
  }, [selectedContact, selectedDate]);

  useEffect(() => {
    fetchContactMomentRequests();
  }, [fetchContactMomentRequests]);

  // Get contact availability blocks (calculate from their moment requests)
  const getContactAvailableBlocks = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
    const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

    if (contactMomentRequests.length === 0) {
      // No meetings, entire day is available
      const endHour = selectedDateEnd.getHours();
      const endMin = selectedDateEnd.getMinutes();
      return [{
        start: '00:00',
        end: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
      }];
    }

    // Sort contact meetings by start time
    const sortedMeetings = [...contactMomentRequests].sort((a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Merge overlapping meetings to find busy periods
    const busyPeriods: { start: Date; end: Date }[] = [];
    let currentBusy: { start: Date; end: Date } | null = null;

    for (const meeting of sortedMeetings) {
      const meetingStart = new Date(meeting.startTime);
      const meetingEnd = new Date(meeting.endTime);

      if (!currentBusy) {
        currentBusy = { start: meetingStart, end: meetingEnd };
      } else {
        // If this meeting overlaps or touches the current busy period, extend it
        if (meetingStart <= currentBusy.end) {
          currentBusy.end = new Date(Math.max(currentBusy.end.getTime(), meetingEnd.getTime()));
        } else {
          // No overlap, save current busy period and start a new one
          busyPeriods.push(currentBusy);
          currentBusy = { start: meetingStart, end: meetingEnd };
        }
      }
    }
    if (currentBusy) {
      busyPeriods.push(currentBusy);
    }

    // Calculate availability gaps (free time between busy periods)
    const availabilityGaps: { start: string; end: string }[] = [];
    let lastEnd = selectedDateStart;

    for (const busy of busyPeriods) {
      // Add gap before this busy period (if any)
      if (busy.start > lastEnd) {
        availabilityGaps.push({
          start: `${String(lastEnd.getHours()).padStart(2, '0')}:${String(lastEnd.getMinutes()).padStart(2, '0')}`,
          end: `${String(busy.start.getHours()).padStart(2, '0')}:${String(busy.start.getMinutes()).padStart(2, '0')}`
        });
      }
      lastEnd = busy.end > lastEnd ? busy.end : lastEnd;
    }

    // Add final gap from last meeting to end of day
    if (lastEnd < selectedDateEnd) {
      const endHour = selectedDateEnd.getHours();
      const endMin = selectedDateEnd.getMinutes();
      availabilityGaps.push({
        start: `${String(lastEnd.getHours()).padStart(2, '0')}:${String(lastEnd.getMinutes()).padStart(2, '0')}`,
        end: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
      });
    }

    return availabilityGaps;
  };

  const contactAvailableBlocks = useMemo(() => {
    return selectedContact ? getContactAvailableBlocks() : [];
  }, [selectedContact, contactMomentRequests, selectedDate]);

  // Handle clicking on a time slot to create meeting
  const handleTimeSlotClick = (hour: number, minute: number) => {
    const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    setAppointmentTime(timeString);
    setAppointmentDuration('30 min');
    
    // Create pending meeting placeholder
    const [year, month, day] = selectedDate.split('-').map(Number);
    const startTime = new Date(year, month - 1, day, hour, minute);
    const durationMinutes = durationToMinutes('30 min');
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    
    setPendingMeeting({
      startTime,
      endTime,
      title: appointmentTitle || 'New Meeting'
    });
    
    // If no contact is selected, show contact selection first
    if (!selectedContact) {
      setShowContactModal(true);
      // Animate contact modal in
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
    } else {
      // If contact is already selected, show create modal directly
      setShowCreateModal(true);
      // Animate create modal in
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
    }
  };
  
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
        title: appointmentTitle || 'New Meeting'
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
  
  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, []);
  
  // Handle contact selection
  const handleContactSelect = (contact: Contact) => {
    if (!contact.contactUser?.id) {
      showToastMessage('This contact is not registered. Please select a registered contact.');
      return;
    }
    setSelectedContact(contact);
    setShowContactModal(false);
    // After selecting contact, show create meeting modal
    setShowCreateModal(true);
  };
  
  const filteredContacts = contacts.filter(contact =>
    contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase())
  );

  // Check if a specific time slot is occupied by a meeting
  const isTimeSlotOccupied = (hour: number, minute: number, meetings: MomentRequest[]) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const slotTime = new Date(year, month - 1, day, hour, minute);

    return meetings.some(meeting => {
      const meetingStart = new Date(meeting.startTime);
      const meetingEnd = new Date(meeting.endTime);
      return slotTime >= meetingStart && slotTime < meetingEnd;
    });
  };

  // Check if a time slot with given duration would conflict with existing meetings
  const wouldConflictWithMeetings = (timeString: string, durationStr: string): boolean => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const [hour, minute] = timeString.split(':').map(Number);
    const proposedStart = new Date(year, month - 1, day, hour, minute);
    const durationMins = durationToMinutes(durationStr);
    const proposedEnd = new Date(proposedStart.getTime() + durationMins * 60 * 1000);

    // Check against user's own meetings
    const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
    const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59);
    const todayMeetings = momentRequests.filter(request => {
      const requestStart = new Date(request.startTime);
      return requestStart >= selectedDateStart && requestStart <= selectedDateEnd;
    });

    const userConflict = todayMeetings.some(meeting => {
      const meetingStart = new Date(meeting.startTime);
      const meetingEnd = new Date(meeting.endTime);
      // Check if proposed meeting overlaps with existing meeting
      return (proposedStart < meetingEnd && proposedEnd > meetingStart);
    });

    // Check against contact's meetings
    let contactConflict = false;
    if (selectedContact && contactMomentRequests.length > 0) {
      contactConflict = contactMomentRequests.some(meeting => {
        const meetingStart = new Date(meeting.startTime);
        const meetingEnd = new Date(meeting.endTime);
        const meetingDate = new Date(meetingStart.toDateString());
        const proposedDate = new Date(proposedStart.toDateString());

        // Only check meetings on the same day
        if (meetingDate.getTime() !== proposedDate.getTime()) return false;

        // Check if proposed meeting overlaps with contact's existing meeting
        return (proposedStart < meetingEnd && proposedEnd > meetingStart);
      });
    }

    return userConflict || contactConflict;
  };

  // Convert duration string to minutes
  const durationToMinutes = (duration: string): number => {
    if (duration === '30 min') return 30;
    if (duration === '1 hr') return 60;
    if (duration === '1h 30min') return 90;
    if (duration === '2hr') return 120;
    return 30; // default
  };

  const handleCreateAppointment = () => {
    // Show the modal instead of directly creating
    setShowCreateModal(true);
  };

  const handleSubmitAppointment = async () => {
    if (!appointmentTime || !appointmentTitle) {
      showToastMessage('Please select a time and enter an event name');
      return;
    }

    if (!selectedContact?.contactUser?.id) {
      showToastMessage('Contact user ID is missing');
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      // Ensure calendar visibility is granted before creating the request
      try {
        await http.post('/users/visibility', {
          userId: selectedContact.contactUser.id
        });
        console.log('Calendar visibility granted');
      } catch (visibilityError: any) {
        // If error is about calendar not found, show a helpful message
        if (visibilityError.response?.data?.error?.includes('calendar not found') ||
          visibilityError.response?.data?.error?.includes('Default calendar not found')) {
          showToastMessage('The selected contact does not have a calendar set up yet. Please ask them to complete their profile first.');
          return;
        }
        // Ignore if visibility is already granted
        if (!visibilityError.response?.data?.error?.includes('already')) {
          console.warn('Could not grant calendar visibility:', visibilityError.response?.data?.error || visibilityError.message);
        }
      }

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
        title: appointmentTitle,
        description: `Meeting with ${selectedContact.displayName}`,
        meetingType: appointmentType,
      });

      // Success - refresh the calendar to show the new meeting
      await fetchMomentRequests();
      if (selectedContact) {
        await fetchContactMomentRequests();
      }

      // Remove pending meeting placeholder and close modal
      setPendingMeeting(null);
      setShowCreateModal(false);
      showToastMessage('Meeting request created successfully!');
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      showToastMessage(error.response?.data?.error || 'Failed to create meeting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get available times (all times except scheduled ones)
  const availableTimes = allTimeSlots.filter(time => !scheduledTimes.includes(time));

  // Group consecutive available times into blocks
  const getAvailableBlocks = () => {
    if (availableTimes.length === 0) return [];

    const blocks = [];
    let currentBlock = { start: availableTimes[0], end: availableTimes[0] };

    for (let i = 1; i < availableTimes.length; i++) {
      const prevTime = availableTimes[i - 1];
      const currTime = availableTimes[i];

      // Check if times are consecutive (30 min apart)
      const prevMinutes = parseInt(prevTime.split(':')[0]) * 60 + parseInt(prevTime.split(':')[1]);
      const currMinutes = parseInt(currTime.split(':')[0]) * 60 + parseInt(currTime.split(':')[1]);

      if (currMinutes - prevMinutes === 30) {
        // Consecutive, extend current block
        currentBlock.end = currTime;
      } else {
        // Not consecutive, save current block and start new one
        blocks.push({ ...currentBlock });
        currentBlock = { start: currTime, end: currTime };
      }
    }

    // Add the last block
    blocks.push(currentBlock);

    return blocks;
  };

  const availableBlocks = getAvailableBlocks();

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      {/* Fixed Header Section */}
      <View style={tw`pt-16 px-5 pb-4`}>
        {/* Header */}
        <View style={tw`flex-row justify-between items-center mb-6`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.5}
          >
            <Image source={BackArrow} />
          </TouchableOpacity>
          <Text style={tw`text-lg font-bold font-dm text-black`}>
            When do you want to meet?
          </Text>
          <TouchableOpacity activeOpacity={0.5}>
            <Image source={CalendarIcon} style={tw`w-5 h-5`} />
          </TouchableOpacity>
        </View>

        {/* Week Date Selector */}
        <View style={tw`flex-row items-center justify-between mb-6`}>
          <TouchableOpacity
            onPress={navigateToPrevWeek}
            activeOpacity={0.7}
            style={tw`w-8 h-8 rounded-full bg-white items-center justify-center`}
          >
            <Text style={tw`text-black text-lg`}>‹</Text>
          </TouchableOpacity>
          <View style={tw`flex-row justify-between flex-1 mx-1`}>
            {weekDates.map((weekDay, index) => {
              const isSelected = weekDay.dateString === selectedDate;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedDate(weekDay.dateString)}
                  activeOpacity={0.7}
                  style={tw`items-center`}
                >
                  <Text style={tw`text-xs text-grey font-dm mb-2`}>
                    {weekDay.dayName}
                  </Text>
                  <View
                    style={[
                      tw`w-10 h-10 items-center justify-center`,
                      { borderRadius: 20 },
                      isSelected ? tw`bg-black` : tw`bg-transparent`
                    ]}
                  >
                    <Text
                      style={tw`text-sm font-dm ${isSelected ? 'text-white' : 'text-black'}`}
                    >
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
            style={tw`w-8 h-8 rounded-full bg-white items-center justify-center`}
          >
            <Text style={tw`text-black text-lg`}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Availability Toggle */}
        <View style={tw`flex-row bg-white rounded-full p-1 mb-4`}>
          <TouchableOpacity
            onPress={() => setAvailabilityView('scheduled')}
            activeOpacity={0.7}
            style={tw`flex-1 rounded-full py-2 px-4 items-center ${availabilityView === 'scheduled' ? 'bg-[#A3CB31] shadow-sm' : ''}`}
          >
            <Text style={tw`font-dm text-sm ${availabilityView === 'scheduled' ? 'text-white font-bold' : 'text-grey'}`}>
              Scheduled events
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAvailabilityView('full')}
            activeOpacity={0.7}
            style={tw`flex-1 rounded-full py-2 px-4 items-center ${availabilityView === 'full' ? 'bg-[#A3CB31] shadow-sm' : ''}`}
          >
            <Text style={tw`font-dm text-sm ${availabilityView === 'full' ? 'text-white font-bold' : 'text-grey'}`}>
              Full availability
            </Text>
          </TouchableOpacity>
        </View>

        {/* Username Labels for Full Availability (only when contact selected and full view) */}
        {availabilityView === 'full' && selectedContact && (
          <View style={tw`flex-row mt-4 px-5`}>
            <View style={tw`w-16`} />
            <View style={tw`flex-1 flex-row ml-2`}>
              <View style={tw`flex-1 items-center mr-2`}>
                <Text style={tw`text-grey text-xs font-dm font-bold`} numberOfLines={1}>
                  {selectedContact.displayName}
                </Text>
              </View>
              <View style={tw`flex-1 items-center ml-2`}>
                <Text style={tw`text-grey text-xs font-dm font-bold`} numberOfLines={1}>
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
        contentContainerStyle={tw`px-5 ${selectedContact ? 'pb-32' : 'pb-16'}`}
        showsVerticalScrollIndicator={false}
      >
        <View style={tw`mt-4`}>
          {availabilityView === 'scheduled' ? (
            // Show scheduled events - simplified
            (() => {
              const rows = [];
              const [year, month, day] = selectedDate.split('-').map(Number);
              const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
              const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59);

              // Filter requests for today
              const todayRequests = momentRequests.filter(request => {
                const requestStart = new Date(request.startTime);
                return requestStart >= selectedDateStart && requestStart <= selectedDateEnd;
              });
              
              // Add pending meeting if it exists and is for today
              const allRequests = [...todayRequests];
              if (pendingMeeting) {
                const pendingStart = new Date(pendingMeeting.startTime);
                if (pendingStart >= selectedDateStart && pendingStart <= selectedDateEnd) {
                  // Create a temporary request object for the pending meeting
                  const tempRequest: MomentRequest = {
                    id: 'pending',
                    senderId: '',
                    receiverId: '',
                    startTime: pendingMeeting.startTime.toISOString(),
                    endTime: pendingMeeting.endTime.toISOString(),
                    title: pendingMeeting.title,
                    status: 'pending'
                  };
                  allRequests.push(tempRequest);
                }
              }

              // Render each hour
              for (let hour = 0; hour < 24; hour++) {
                const hourTime = `${String(hour).padStart(2, '0')}:00`;

                // Find meetings that START in this hour
                const hourMeetings = allRequests.filter(request => {
                  const start = new Date(request.startTime);
                  return start.getHours() === hour;
                });

                rows.push(
                  <View key={hour} style={tw`relative h-20`}>
                    {/* Base structure (relative positioning) */}
                    <View style={tw`flex-row`}>
                      <Text style={tw`text-black text-base font-bold font-dm w-16 -mt-3`}>
                        {hourTime}
                      </Text>
                      <View style={tw`flex-1 ml-2`}>
                        <View style={tw`h-0.5 bg-gray-300`} />
                      </View>
                    </View>

                    {/* Meeting blocks (absolute positioning, overlay on top) */}
                    {hourMeetings.length > 0 && (
                      <View style={tw`absolute top-0 left-16 right-0 h-20 z-2`}>
                        {hourMeetings.map((request, idx) => {
                          const start = new Date(request.startTime);
                          const end = new Date(request.endTime);
                          const startMin = start.getMinutes();

                          // Position from top
                          const top = startMin === 30 ? 40 : 0;

                          // Calculate height based on total meeting duration
                          const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                          const height = (durationMinutes / 30) * 40; // Each 30-min slot = 40px

                          let blockColor = 'bg-gray-400';
                          const isPending = request.id === 'pending';
                          if (isPending) blockColor = 'bg-gray-300'; // Light grey for pending placeholder
                          else if (request.status === 'approved') blockColor = 'bg-green-500';
                          else if (request.status === 'rejected') blockColor = 'bg-red-500';

                          // Calculate positioning for side-by-side blocks
                          const totalMeetings = hourMeetings.length;
                          const blockWidthPercent = (100 / totalMeetings) - 0.5; // -0.5% for gap
                          const leftPercent = idx * (100 / totalMeetings);
                          return (
                            <TouchableOpacity
                              key={request.id}
                              style={[
                                tw`${blockColor} px-2 rounded-lg absolute`,
                                {
                                  top,
                                  height,
                                  left: `${leftPercent}%`,
                                  width: `${blockWidthPercent}%`,
                                  justifyContent: 'center',
                                  opacity: isPending ? 0.6 : 1
                                }
                              ]}
                              activeOpacity={isPending ? 1 : 0.7}
                              onPress={() => !isPending && handleRequestBlockPress(request)}
                              disabled={isPending}
                            >
                              <Text
                                style={tw`${isPending ? 'text-gray-600' : 'text-white'} text-xs font-dm font-semibold`}
                                numberOfLines={2}
                              >
                                {request.title || request.notes || 'Meeting'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Clickable empty time slots */}
                    {!isTimeSlotOccupied(hour, 0, allRequests) && (
                      <TouchableOpacity
                        style={[tw`absolute`, { top: 0, left: 72, right: 0, height: 40, zIndex: 1 }]}
                        activeOpacity={0.3}
                        onPress={() => handleTimeSlotClick(hour, 0)}
                      />
                    )}
                    {!isTimeSlotOccupied(hour, 30, allRequests) && (
                      <TouchableOpacity
                        style={[tw`absolute`, { top: 40, left: 72, right: 0, height: 40, zIndex: 1 }]}
                        activeOpacity={0.3}
                        onPress={() => handleTimeSlotClick(hour, 30)}
                      />
                    )}
                  </View>
                );
              }
              return rows;
            })()
          ) : (
            // Show full availability - dual view if contact selected, single view otherwise
            selectedContact ? (
              // Dual availability: Contact (left) and User (right)
              (() => {
                const rows = [];
                const [year, month, day] = selectedDate.split('-').map(Number);
                const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
                const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

                // Get today's meetings, sorted by start time
                const todayMeetings = momentRequests
                  .filter(request => {
                    const requestStart = new Date(request.startTime);
                    return requestStart >= selectedDateStart && requestStart <= selectedDateEnd;
                  })
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                // Calculate USER availability gaps (times NOT occupied by meetings)
                type AvailabilityGap = { start: Date; end: Date };
                const userAvailabilityGaps: AvailabilityGap[] = [];

                let userLastEnd = selectedDateStart;
                todayMeetings.forEach(meeting => {
                  const meetingStart = new Date(meeting.startTime);
                  const meetingEnd = new Date(meeting.endTime);
                  if (meetingStart > userLastEnd) {
                    userAvailabilityGaps.push({ start: userLastEnd, end: meetingStart });
                  }
                  userLastEnd = meetingEnd > userLastEnd ? meetingEnd : userLastEnd;
                });
                if (userLastEnd < selectedDateEnd) {
                  userAvailabilityGaps.push({ start: userLastEnd, end: selectedDateEnd });
                }
                if (todayMeetings.length === 0) {
                  userAvailabilityGaps.push({ start: selectedDateStart, end: selectedDateEnd });
                }

                // Calculate CONTACT availability gaps from contactAvailableBlocks
                const contactAvailabilityGaps: AvailabilityGap[] = contactAvailableBlocks.map(block => {
                  const [startHour, startMin] = block.start.split(':').map(Number);
                  const [endHour, endMin] = block.end.split(':').map(Number);
                  return {
                    start: new Date(year, month - 1, day, startHour, startMin),
                    end: new Date(year, month - 1, day, endHour, endMin)
                  };
                });

                // Render each hour
                for (let hour = 0; hour < 24; hour++) {
                  const hourTime = `${String(hour).padStart(2, '0')}:00`;

                  // Find availability gaps that START in this hour
                  const userHourGaps = userAvailabilityGaps.filter(gap => gap.start.getHours() === hour);
                  const contactHourGaps = contactAvailabilityGaps.filter(gap => gap.start.getHours() === hour);

                  rows.push(
                    <View key={hour} style={tw`relative h-20`}>
                      {/* Base structure */}
                      <View style={tw`flex-row`}>
                        <Text style={tw`text-black text-base font-bold font-dm w-16 -mt-3`}>
                          {hourTime}
                        </Text>
                        <View style={tw`flex-1 ml-2`}>
                          <View style={tw`h-0.5 bg-gray-300`} />
                        </View>
                      </View>

                      {/* Contact availability blocks (left, absolute) */}
                      {contactHourGaps.length > 0 && (
                        <View style={[tw`absolute top-0`, { left: 72, width: '45%', height: 80, zIndex: 2 }]}>
                          {contactHourGaps.map((gap, idx) => {
                            const startMin = gap.start.getMinutes();
                            const top = startMin === 30 ? 40 : 0;
                            const durationMinutes = (gap.end.getTime() - gap.start.getTime()) / (1000 * 60);
                            const height = (durationMinutes / 30) * 40;

                            return (
                              <View
                                key={idx}
                                style={[
                                  tw`bg-gray-300 rounded-lg absolute`,
                                  { top, height, left: 0, right: 4 }
                                ]}
                              />
                            );
                          })}
                        </View>
                      )}

                      {/* User availability blocks (right, absolute) */}
                      {userHourGaps.length > 0 && (
                        <View style={[tw`absolute top-0`, { right: 0, width: '45%', height: 80, zIndex: 2 }]}>
                          {userHourGaps.map((gap, idx) => {
                            const startMin = gap.start.getMinutes();
                            const top = startMin === 30 ? 40 : 0;
                            const durationMinutes = (gap.end.getTime() - gap.start.getTime()) / (1000 * 60);
                            const height = (durationMinutes / 30) * 40;

                            return (
                              <TouchableOpacity
                                key={idx}
                                style={[
                                  tw`bg-gray-200 rounded-lg absolute`,
                                  { top, height, left: 4, right: 0 }
                                ]}
                                activeOpacity={0.7}
                                onPress={() => {
                                  // Set appointment time to gap start
                                  const gapTime = `${String(gap.start.getHours()).padStart(2, '0')}:${String(gap.start.getMinutes()).padStart(2, '0')}`;
                                  setAppointmentTime(gapTime);
                                }}
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                }
                return rows;
              })()
            ) : (
              // Single availability view (no contact selected)
              (() => {
                const rows = [];
                const [year, month, day] = selectedDate.split('-').map(Number);
                const selectedDateStart = new Date(year, month - 1, day, 0, 0, 0);
                const selectedDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

                // Get today's meetings, sorted by start time
                const todayMeetings = momentRequests
                  .filter(request => {
                    const requestStart = new Date(request.startTime);
                    return requestStart >= selectedDateStart && requestStart <= selectedDateEnd;
                  })
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                // Calculate availability gaps (times NOT occupied by meetings)
                type AvailabilityGap = { start: Date; end: Date };
                const availabilityGaps: AvailabilityGap[] = [];

                // Start from beginning of day
                let lastEnd = selectedDateStart;

                // For each meeting, create a gap from lastEnd to meeting start
                todayMeetings.forEach(meeting => {
                  const meetingStart = new Date(meeting.startTime);
                  const meetingEnd = new Date(meeting.endTime);

                  // Add gap before this meeting (if any)
                  if (meetingStart > lastEnd) {
                    availabilityGaps.push({ start: lastEnd, end: meetingStart });
                  }

                  lastEnd = meetingEnd;
                });

                // Add final gap from last meeting to end of day
                if (lastEnd < selectedDateEnd) {
                  availabilityGaps.push({ start: lastEnd, end: selectedDateEnd });
                }

                // If no meetings, entire day is available
                if (todayMeetings.length === 0) {
                  availabilityGaps.push({ start: selectedDateStart, end: selectedDateEnd });
                }

                // Render each hour
                for (let hour = 0; hour < 24; hour++) {
                  const hourTime = `${String(hour).padStart(2, '0')}:00`;

                  // Find availability gaps that START in this hour
                  const hourGaps = availabilityGaps.filter(gap => gap.start.getHours() === hour);

                  rows.push(
                    <View key={hour} style={tw`relative h-20`}>
                      {/* Base structure */}
                      <View style={tw`flex-row`}>
                        <Text style={tw`text-black text-base font-bold font-dm w-16 -mt-3`}>
                          {hourTime}
                        </Text>
                        <View style={tw`flex-1 ml-2`}>
                          <View style={tw`h-0.5 bg-gray-300`} />
                        </View>
                      </View>

                      {/* Availability blocks (absolute) */}
                      {hourGaps.length > 0 && (
                        <View style={[tw`absolute top-0 right-0`, { left: 72, height: 80, zIndex: 2 }]}>
                          {hourGaps.map((gap, idx) => {
                            const startMin = gap.start.getMinutes();
                            const top = startMin === 30 ? 40 : 0;
                            const durationMinutes = (gap.end.getTime() - gap.start.getTime()) / (1000 * 60);
                            const height = (durationMinutes / 30) * 40;

                            return (
                              <View
                                key={idx}
                                style={[
                                  tw`bg-gray-200 rounded-lg absolute`,
                                  { top, height, left: 0, right: 0 }
                                ]}
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                }
                return rows;
              })()
            )
          )}
        </View>
      </ScrollView>


      {/* Bottom Fixed Bar - Show when contact is selected */}
      {selectedContact && (
        <View style={tw`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-lg border-t border-gray-200`}>
          <View style={tw`px-5 pt-4 pb-8`}>
            {/* Create Button */}
            <TouchableOpacity
              onPress={handleCreateAppointment}
              activeOpacity={0.7}
              style={tw`bg-[#A3CB31] rounded-2xl py-3 items-center`}
            >
              <Text style={tw`text-white text-base font-bold font-dm`}>
                Create Meeting
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Create Appointment Modal */}
      <Modal
        visible={showCreateModal}
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
        }}
      >
        <Animated.View 
          style={[
            tw`flex-1`,
            { opacity: createModalOpacityAnim }
          ]}
        >
          <BlurView intensity={20} style={tw`flex-1`}>
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={handleCloseCreateModal}
          >
            <View style={tw`flex-1 justify-end`}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <Animated.View 
                  style={[
                    tw`bg-white rounded-t-3xl p-5`,
                    {
                      transform: [{
                        translateY: createModalSlideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [300, 0],
                        }),
                      }],
                    }
                  ]}
                >
                  {/* Modal Header */}
                  <View style={tw`flex-row justify-between items-center mb-6`}>
                    <Text style={tw`text-xl font-bold font-dm text-black`}>
                      Create Meeting
                    </Text>
                    <TouchableOpacity
                      onPress={handleCloseCreateModal}
                      activeOpacity={0.7}
                    >
                      <Text style={tw`text-grey text-lg`}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Event Name */}
                  <View style={tw`mb-4`}>
                    <Text style={tw`text-sm font-dm text-grey mb-2`}>Event Name</Text>
                    <TextInput
                      style={tw`bg-gray-100 rounded-xl px-4 py-3 text-black font-dm`}
                      placeholder="Enter event name"
                      placeholderTextColor="#999"
                      value={appointmentTitle}
                      onChangeText={setAppointmentTitle}
                    />
                  </View>

                  {/* Time Selection */}
                  <View style={tw`mb-4`}>
                    <Text style={tw`text-sm font-dm text-grey mb-2`}>Select Time</Text>
                    <ScrollView style={tw`max-h-40`} showsVerticalScrollIndicator={false}>
                      <View style={tw`flex-row flex-wrap gap-2`}>
                        {allTimeSlots.map((time) => {
                          const isSelected = appointmentTime === time;
                          // Check if this time would conflict with existing meetings (considering duration)
                          const hasConflict = wouldConflictWithMeetings(time, appointmentDuration);

                          return (
                            <TouchableOpacity
                              key={time}
                              onPress={() => !hasConflict && setAppointmentTime(time)}
                              activeOpacity={hasConflict ? 1 : 0.7}
                              disabled={hasConflict}
                              style={tw`px-4 py-2 rounded-full ${isSelected
                                  ? 'bg-[#A3CB31]'
                                  : hasConflict
                                    ? 'bg-gray-200'
                                    : 'bg-gray-100'
                                }`}
                            >
                              <Text
                                style={tw`font-dm text-sm ${isSelected
                                    ? 'text-white font-bold'
                                    : hasConflict
                                      ? 'text-gray-400'
                                      : 'text-grey'
                                  }`}
                              >
                                {time}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Duration Selection */}
                  <View style={tw`mb-6`}>
                    <Text style={tw`text-sm font-dm text-grey mb-2`}>Duration</Text>
                    <View style={tw`flex-row flex-wrap gap-2`}>
                      {durationOptions.map((duration) => (
                        <TouchableOpacity
                          key={duration}
                          onPress={() => setAppointmentDuration(duration)}
                          activeOpacity={0.7}
                          style={tw`px-4 py-2 rounded-full ${appointmentDuration === duration
                            ? 'bg-[#A3CB31]'
                            : 'bg-gray-100'
                            }`}
                        >
                          <Text
                            style={tw`font-dm text-sm ${appointmentDuration === duration
                              ? 'text-white font-bold'
                              : 'text-grey'
                              }`}
                          >
                            {duration}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Meeting Type Selection */}
                  <View style={tw`mb-6`}>
                    <Text style={tw`text-sm font-dm text-grey mb-2`}>Meeting Type</Text>
                    <View style={tw`flex-row flex-wrap gap-2`}>
                      {meetingTypes.map((type) => {
                        const isSelected = appointmentType === type.id;
                        return (
                          <TouchableOpacity
                            key={type.id}
                            onPress={() => setAppointmentType(type.id)}
                            activeOpacity={0.7}
                            style={[
                              tw`flex-row items-center pl-4 pr-2 py-1 rounded-full border border-white`,
                              { backgroundColor: isSelected ? '#FFF' : 'transparent' }
                            ]}
                          >
                            <Text
                              style={tw`font-dm text-sm text-black mr-2`}
                              numberOfLines={1}
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
                    </View>
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    onPress={handleSubmitAppointment}
                    activeOpacity={0.7}
                    disabled={isSubmitting}
                    style={tw`bg-[#A3CB31] rounded-2xl py-3 items-center ${isSubmitting ? 'opacity-50' : ''}`}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={tw`text-white text-base font-bold font-dm`}>
                        Create Meeting
                      </Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </BlurView>
        </Animated.View>
      </Modal>

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
        }}
      >
        <Animated.View 
          style={[
            tw`flex-1`,
            { opacity: requestModalOpacityAnim }
          ]}
        >
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
              }}
            >
              <View style={tw`flex-1 justify-end`}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <Animated.View 
                    style={[
                      tw`bg-white rounded-t-3xl p-5`,
                      {
                        transform: [{
                          translateY: requestModalSlideAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [300, 0],
                          }),
                        }],
                      }
                    ]}
                  >
                  {selectedRequest && (
                    <>
                      {/* Modal Header with Status Badge */}
                      <View style={tw`flex-row justify-between items-center mb-6`}>
                        <View style={tw`flex-1`}>
                          <Text style={tw`text-2xl font-bold font-dm text-black mb-2`}>
                            {selectedRequest.title || selectedRequest.notes || 'Meeting'}
                          </Text>
                          <View style={tw`flex-row items-center`}>
                            {selectedRequest.status === 'pending' && (
                              <View style={tw`bg-gray-400 px-3 py-1 rounded-full mr-2`}>
                                <Text style={tw`text-white text-xs font-dm font-semibold`}>
                                  Pending
                                </Text>
                              </View>
                            )}
                            {selectedRequest.status === 'approved' && (
                              <View style={tw`bg-green-500 px-3 py-1 rounded-full mr-2`}>
                                <Text style={tw`text-white text-xs font-dm font-semibold`}>
                                  Accepted
                                </Text>
                              </View>
                            )}
                            {selectedRequest.status === 'rejected' && (
                              <View style={tw`bg-red-500 px-3 py-1 rounded-full mr-2`}>
                                <Text style={tw`text-white text-xs font-dm font-semibold`}>
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
                          style={tw`w-8 h-8 items-center justify-center`}
                        >
                          <Text style={tw`text-grey text-2xl`}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Date and Time */}
                      <View style={tw`mb-4 pb-4 border-b border-gray-200`}>
                        <View style={tw`flex-row items-center mb-2`}>
                          <Text style={tw`text-lg font-bold font-dm text-black mr-2`}>
                            📅
                          </Text>
                          <View style={tw`flex-1`}>
                            <Text style={tw`text-sm font-dm text-grey mb-1`}>Date</Text>
                            <Text style={tw`text-base font-dm text-black`}>
                              {new Date(selectedRequest.startTime).toLocaleDateString([], {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </Text>
                          </View>
                        </View>
                        <View style={tw`flex-row items-center mt-3`}>
                          <Text style={tw`text-lg font-bold font-dm text-black mr-2`}>
                            🕐
                          </Text>
                          <View style={tw`flex-1`}>
                            <Text style={tw`text-sm font-dm text-grey mb-1`}>Time</Text>
                            <Text style={tw`text-base font-dm text-black`}>
                              {new Date(selectedRequest.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedRequest.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Participants */}
                      <View style={tw`mb-4 pb-4 border-b border-gray-200`}>
                        <View style={tw`flex-row items-center`}>
                          <Text style={tw`text-lg font-bold font-dm text-black mr-2`}>
                            👤
                          </Text>
                          <View style={tw`flex-1`}>
                            <Text style={tw`text-sm font-dm text-grey mb-2`}>
                              {selectedRequest.receiverId === user.id ? 'From' : 'To'}
                            </Text>
                            <Text style={tw`text-base font-dm text-black font-semibold`}>
                              {selectedRequest.receiverId === user.id
                                ? (selectedRequest.sender?.name || selectedRequest.sender?.phoneNumber || 'Unknown')
                                : (selectedRequest.receiver?.name || selectedRequest.receiver?.phoneNumber || 'Unknown')}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Description/Notes */}
                      {selectedRequest.notes && (
                        <View style={tw`mb-6`}>
                          <Text style={tw`text-sm font-dm text-grey mb-2`}>Description</Text>
                          <Text style={tw`text-base font-dm text-black leading-5`}>
                            {selectedRequest.notes}
                          </Text>
                        </View>
                      )}

                      {/* Action Buttons */}
                      {selectedRequest.senderId === user.id ? (
                        // User is the sender - show Cancel button in any condition
                        <View style={tw`mt-4`}>
                          <TouchableOpacity
                            onPress={handleCancelMeeting}
                            activeOpacity={0.7}
                            disabled={isCanceling}
                            style={tw`bg-red-500 rounded-2xl py-4 items-center ${isCanceling ? 'opacity-50' : ''}`}
                          >
                            {isCanceling ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={tw`text-white text-base font-bold font-dm`}>
                                {selectedRequest.status === 'pending' ? 'Cancel Request' : 'Cancel Meeting'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : selectedRequest.receiverId === user.id && selectedRequest.status === 'pending' ? (
                        // User is the receiver and status is pending - show Accept/Reject buttons
                        <View style={tw`flex-row gap-3 mt-4`}>
                          <TouchableOpacity
                            onPress={handleRejectRequest}
                            activeOpacity={0.7}
                            disabled={isRejecting || isAccepting}
                            style={tw`flex-1 bg-red-500 rounded-2xl py-4 items-center ${isRejecting || isAccepting ? 'opacity-50' : ''}`}
                          >
                            {isRejecting ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={tw`text-white text-base font-bold font-dm`}>
                                Reject
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleAcceptRequest}
                            activeOpacity={0.7}
                            disabled={isAccepting || isRejecting}
                            style={tw`flex-1 bg-[#A3CB31] rounded-2xl py-4 items-center ${isAccepting || isRejecting ? 'opacity-50' : ''}`}
                          >
                            {isAccepting ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={tw`text-white text-base font-bold font-dm`}>
                                Accept
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </>
                  )}
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </Modal>

      {/* Contact Selection Modal */}
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
        }}
      >
        <Animated.View 
          style={[
            tw`flex-1`,
            { opacity: contactModalOpacityAnim }
          ]}
        >
          <View style={tw`flex-1`}>
            <TouchableOpacity
              style={tw`flex-1`}
              activeOpacity={1}
              onPress={handleCloseContactModal}
            >
              <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
                <View style={tw`flex-1 bg-black opacity-40`} />
              </BlurView>
            </TouchableOpacity>

            <Animated.View 
              style={[
                tw`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl`,
                {
                  transform: [{
                    translateY: contactModalSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  }],
                }
              ]}
            >
            <View style={tw`px-5 pt-6 pb-8`}>
              {/* Header */}
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <Text style={tw`text-black text-xl font-bold font-dm`}>Select Contact</Text>
                <TouchableOpacity
                  onPress={handleCloseContactModal}
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
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => {
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
                  })
                ) : (
                  <View style={tw`py-10 items-center`}>
                    <Text style={tw`text-grey text-base font-dm`}>No contacts found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
        </Animated.View>
      </Modal>

      {/* Toast notification */}
      <Toast
        message={toastMessage}
        visible={showToast}
        onHide={() => setShowToast(false)}
      />
    </View>
  );
};

export default AppStack_DateDetailScreen;

