import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { CalendarList } from 'react-native-calendars';
import tw from '../../../tailwindcss';
import { AppStackParamList } from '.';
import { Background, Notification, Avatar, AddIcon, HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, Search } from '~/lib/images';
import { http } from '~/helpers/http';
import { useAddButton } from '~/contexts/AddButtonContext';

type Props = NativeStackScreenProps<
  AppStackParamList,
  'AppStack_CalendarScreen'
>;

const AppStack_CalendarScreen: React.FC<Props> = ({ navigation, route }) => {
  const { setOnAddPress } = useAddButton();
  
  // Initialize with current month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentMonthString = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const [visibleMonth, setVisibleMonth] = useState(currentMonthString);
  const [selectedDate, setSelectedDate] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  // Contact selection
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearchText, setContactSearchText] = useState('');
  
  // Meetings data
  const [meetings, setMeetings] = useState<any[]>([]);

  // Load contacts when modal opens
  useEffect(() => {
    fetchMeetings();
  }, []);

  useEffect(() => {
    if (showContactModal) {
      loadContacts();
    }
  }, [showContactModal]);

  // Register add button handler
  useEffect(() => {
    setOnAddPress(() => () => setShowAddMenu(true));
    
    // Cleanup on unmount
    return () => {
      setOnAddPress(undefined);
    };
  }, [setOnAddPress]);

  const fetchMeetings = async () => {
    try {
      // Fetch both received and sent moment requests using existing endpoints
      const [receivedResponse, sentResponse] = await Promise.all([
        http.get('/users/moment-requests/received'),
        http.get('/users/moment-requests/sent')
      ]);
      
      // Backend returns { requests: [...] } for both endpoints
      const received = Array.isArray(receivedResponse.data.requests) ? receivedResponse.data.requests : [];
      const sent = Array.isArray(sentResponse.data.requests) ? sentResponse.data.requests : [];
      const allMeetings = [...received, ...sent];
      
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await http.get('/users/contacts');
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase())
  );

  const handleBookMeeting = () => {
    setShowAddMenu(false);
    setShowContactModal(true);
  };

  const handleContactSelect = (contact: any) => {
    setShowContactModal(false);
    // Navigate to DateDetailScreen with selected date and contact
    navigation.navigate('AppStack_DateDetailScreen', {
      date: selectedDate,
      contact: contact
    });
  };

  const getMonthAbbreviation = (dateString: string) => {
    // dateString is in format "YYYY-MM", extract month directly
    const monthNum = parseInt(dateString.split('-')[1], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthNum - 1]; // monthNum is 1-12, array index is 0-11
  };

  const getYear = (dateString: string) => {
    // dateString is in format "YYYY-MM", extract year directly
    return parseInt(dateString.split('-')[0], 10);
  };

  // Handle visible months change to update header
  const handleVisibleMonthsChange = useCallback((months: any[]) => {
    if (months && months.length > 0) {
      const firstVisibleMonth = months[0];
      if (firstVisibleMonth && firstVisibleMonth.dateString) {
        const monthString = firstVisibleMonth.dateString.substring(0, 7); // Get YYYY-MM format
        setVisibleMonth(monthString);
      }
    }
  }, []);
  const nextMonth = useMemo(() => {
    const [year, month] = visibleMonth.split('-').map(Number);
    const nextMonthNum = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonthNum).padStart(2, '0')}`;
  }, [visibleMonth]);

  // Memoized Calendar theme to prevent recreation on every render
  const calendarTheme = useMemo(() => ({
    backgroundColor: 'transparent',
    calendarBackground: 'transparent',
    textSectionTitleColor: '#9CA3AF',
    selectedDayBackgroundColor: '#000000',
    selectedDayTextColor: '#FFFFFF',
    todayTextColor: '#000000',
    dayTextColor: '#000000',
    textDisabledColor: '#E5E7EB',
    dotColor: '#000000',
    selectedDotColor: '#FFFFFF',
    arrowColor: 'transparent',
    monthTextColor: '#000000',
    textDayFontFamily: 'DMSans',
    textMonthFontFamily: 'DMSans',
    textDayHeaderFontFamily: 'DMSans',
    textDayFontSize: 14,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 12,
    'stylesheet.calendar.header': {
      week: {
        marginTop: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
      },
    },
    'stylesheet.day.basic': {
      today: {
        backgroundColor: 'transparent',
      },
    },
  } as any), []);

  // Create marked dates for selected date
  const markedDates = useMemo(() => {
    const marked: any = {};
    
    // Add dots for dates with meetings
    meetings.forEach(meeting => {
      if (meeting.status === 'approved') {
        const meetingDate = new Date(meeting.startTime);
        // Use local date instead of UTC to avoid timezone issues
        const year = meetingDate.getFullYear();
        const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
        const day = String(meetingDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        if (!marked[dateString]) {
          marked[dateString] = { dots: [] };
        }
        
        if (!marked[dateString].dots) {
          marked[dateString].dots = [];
        }
        
        // Add a dot (limit to 3 dots per day)
        if (marked[dateString].dots.length < 3) {
          marked[dateString].dots.push({
            key: meeting.id,
            color: '#A3CB31',
          });
        }
      }
    });
    
    // Mark selected date
    if (selectedDate) {
      if (marked[selectedDate]) {
        marked[selectedDate] = {
          ...marked[selectedDate],
          selected: true,
          selectedColor: '#000000',
          selectedTextColor: '#FFFFFF',
        };
      } else {
        marked[selectedDate] = {
          selected: true,
          selectedColor: '#000000',
          selectedTextColor: '#FFFFFF',
        };
      }
    }
    
    return marked;
  }, [selectedDate, meetings]);

  // Handle day press - navigate to detail screen
  const handleDayPress = useCallback((day: any) => {
    navigation.navigate('AppStack_DateDetailScreen', { date: day.dateString });
  }, [navigation]);


  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      {/* Fixed Header */}
      <View style={[tw`pt-10 pb-4`, { paddingHorizontal: '8%' }]}>
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={tw`text-lg font-bold font-dm text-black`}>
            {getMonthAbbreviation(visibleMonth)} - {getMonthAbbreviation(nextMonth)} {getYear(nextMonth)}
          </Text>
          <TouchableOpacity 
            activeOpacity={0.5}
            onPress={() => navigation.navigate('AppStack_NotificationScreen')}
          >
            <Image source={Notification} style={tw`w-13 h-13`} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Infinite Scrolling Calendar using CalendarList */}
      <CalendarList
        current={currentMonthString + '-01'}
        markedDates={markedDates}
        markingType="multi-dot"
        onDayPress={handleDayPress}
        onVisibleMonthsChange={handleVisibleMonthsChange}
        hideExtraDays={false}
        enableSwipeMonths={false}
        hideArrows={true}
        firstDay={1}
        disableMonthChange={true}
        disableAllTouchEventsForDisabledDays={true}
        disableAllTouchEventsForInactiveDays={false}
        minDate="2000-01-01"
        maxDate="2099-12-31"
        pastScrollRange={1200}
        futureScrollRange={1200}
        scrollEnabled={true}
        showScrollIndicator={false}
        theme={calendarTheme}
        calendarStyle={{ paddingHorizontal: '8%' }}
      />

      {/* Add Menu Popup Modal */}
      <Modal
        visible={showAddMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <View style={tw`flex-1`}>
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={() => setShowAddMenu(false)}
          >
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
          </TouchableOpacity>

          <View style={tw`absolute bottom-0 left-0 right-0 items-center pb-24`}>
            <View style={tw`bg-white rounded-3xl w-11/12 overflow-hidden`}>
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
              <View style={tw`h-px bg-gray-200 mx-6`} />
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
              <View style={tw`h-px bg-gray-200 mx-6`} />
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
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_CalendarScreen;

