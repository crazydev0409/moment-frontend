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
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { Background, Notification, Avatar, AddIcon, HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, Search } from '~/lib/images';
import { http } from '~/helpers/http';

import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<
  AppStackParamList,
  'AppStack_CalendarScreen'
>;

const AppStack_CalendarScreen: React.FC<Props> = ({ navigation, route }) => {


  // Initialize with current month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentMonthString = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const [visibleMonth, setVisibleMonth] = useState(currentMonthString);
  const [selectedDate, setSelectedDate] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);


  // Meetings data
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    fetchMeetings();
  }, []);



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
        paddingHorizontal: '2.5%', // Use percentage instead of fixed 10
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
      <View style={[{ paddingTop: verticalScale(37.5), paddingBottom: verticalScale(15) }, { paddingHorizontal: '8%' }]}>
        <View style={tw`flex-row justify-between items-center`}>
          <Text style={[tw`font-bold font-dm text-black`, { fontSize: moderateScale(16.875) }]}>
            {getMonthAbbreviation(visibleMonth)} - {getMonthAbbreviation(nextMonth)} {getYear(nextMonth)}
          </Text>
          <TouchableOpacity
            activeOpacity={0.5}
            onPress={() => navigation.navigate('AppStack_NotificationScreen')}
          >
            <Image source={Notification} style={{ width: horizontalScale(48.75), height: horizontalScale(48.75) }} />
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


    </View>
  );
};

export default AppStack_CalendarScreen;

