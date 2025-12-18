import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Text, Image, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import * as Contacts from 'expo-contacts';
import { AppStackParamList } from '.';
import tw from 'tailwindcss';
import { Background, Search, BackArrow, Avatar } from '~/lib/images';
import { http } from '~/helpers/http';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_SearchScreen'>;

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

const AppStack_SearchScreen: React.FC<Props> = ({ navigation, route }) => {
  const [searchText, setSearchText] = useState('');
  const [meetings, setMeetings] = useState<MomentRequest[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<MomentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [localAvatars, setLocalAvatars] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchUserData();
    fetchMeetings();
    loadLocalContactAvatars();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await http.get('/users/profile');
      if (response.data && response.data.id) {
        setUserId(response.data.id);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    filterMeetings();
  }, [searchText, meetings]);

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
      
      setMeetings(allMeetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    } finally {
      setLoading(false);
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

        const phoneToAvatarMap = new Map<string, string>();
        data.forEach(contact => {
          if (contact.phoneNumbers && contact.phoneNumbers.length > 0 && contact.image?.uri) {
            const avatarUri = contact.image.uri;
            contact.phoneNumbers.forEach(phone => {
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

  const getLocalAvatar = (phoneNumber?: string) => {
    if (!phoneNumber) return null;
    const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
    return localAvatars.get(normalized) || null;
  };

  const filterMeetings = () => {
    if (!searchText.trim()) {
      setFilteredMeetings(meetings);
      return;
    }

    const lowercaseSearch = searchText.toLowerCase();
    const filtered = meetings.filter((meeting) => {
      const otherPerson = meeting.senderId === userId ? meeting.receiver : meeting.sender;
      const meetingType = meeting.meetingType?.toLowerCase() || '';
      const personName = otherPerson?.name?.toLowerCase() || '';
      const status = meeting.status.toLowerCase();
      
      return (
        personName.includes(lowercaseSearch) ||
        meetingType.includes(lowercaseSearch) ||
        status.includes(lowercaseSearch)
      );
    });

    setFilteredMeetings(filtered);
  };

  const formatDateTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Format date: MMM d, yyyy
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
    
    // Format time: h:mm a
    const formatTime = (date: Date) => {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      return `${displayHours}:${displayMinutes} ${ampm}`;
    };
    
    const timeStr = `${formatTime(start)} - ${formatTime(end)}`;
    return { dateStr, timeStr };
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

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      
      <View style={tw`flex-1 mt-16 px-5`}>
        {/* Header */}
        <View style={tw`flex-row items-center mb-6`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={tw`mr-4`}
          >
            <Image source={BackArrow} style={tw`w-6 h-6`} />
          </TouchableOpacity>
          <View style={tw`flex-1`}>
            <Text style={tw`text-black text-2xl font-bold font-dm`}>Search Meetings</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={tw`mb-6`}>
          <View style={tw`flex-row items-center bg-white rounded-full px-4 py-3 shadow-sm`}>
            <TextInput
              style={tw`flex-1 font-dm text-sm text-black`}
              placeholder="Search your meetings"
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus={true}
            />
            <Image source={Search} style={tw`w-5 h-5`} />
          </View>
        </View>

        {/* Results */}
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={tw`pb-6`}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={tw`py-10 items-center`}>
              <ActivityIndicator size="large" color="#A3CB31" />
            </View>
          ) : filteredMeetings.length > 0 ? (
            <>
              <Text style={tw`text-grey text-sm font-dm mb-3`}>
                {filteredMeetings.length} {filteredMeetings.length === 1 ? 'meeting' : 'meetings'} found
              </Text>
              {filteredMeetings.map((meeting) => {
                const otherPerson = meeting.senderId === userId ? meeting.receiver : meeting.sender;
                const localAvatar = getLocalAvatar(otherPerson?.phoneNumber);
                const { dateStr, timeStr } = formatDateTime(meeting.startTime, meeting.endTime);
                const statusColor = 
                  meeting.status === 'approved' ? 'text-green-600' :
                  meeting.status === 'pending' ? 'text-yellow-600' :
                  'text-grey';

                return (
                  <TouchableOpacity
                    key={meeting.id}
                    style={tw`bg-white rounded-2xl p-4 mb-3 shadow-sm`}
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
                    <View style={tw`flex-row items-start`}>
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
                        <View style={tw`flex-row items-center justify-between mb-1`}>
                          <Text style={tw`text-black text-base font-bold font-dm`}>
                            {meeting.title || meeting.notes || 'Untitled Meeting'}
                          </Text>
                          <Text style={tw`text-xs font-dm ${statusColor} capitalize`}>
                            {meeting.status}
                          </Text>
                        </View>
                        <Text style={tw`text-grey text-sm font-dm mb-1`}>{dateStr}</Text>
                        <Text style={tw`text-grey text-sm font-dm`}>{timeStr}</Text>
                        <View style={tw`flex-row items-center gap-2 mt-1`}>
                          <Text style={tw`text-xs font-dm text-grey`}>With {otherPerson?.name || 'Unknown'}</Text>
                          {meeting.meetingType && (
                            <>
                              <Text style={tw`text-grey`}>•</Text>
                              <Text style={tw`text-xs font-dm text-grey`}>{getMeetingTypeIcon(meeting.meetingType)} {meeting.meetingType}</Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View style={tw`py-10 items-center`}>
              <Text style={tw`text-grey text-base font-dm`}>
                {searchText ? 'No meetings found' : 'Start typing to search'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

export default AppStack_SearchScreen;

