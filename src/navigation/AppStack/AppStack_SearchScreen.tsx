import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Contacts from 'expo-contacts';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppStackParamList } from '.';

import { http } from '~/helpers/http';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import { Avatar, SearchIcon } from '~/lib/images';
import { hashPhoneNumber } from '~/utils/phoneHash';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_SearchScreen'>;

const COLORS = {
  background: '#F3F6FA',
  ink: '#171927',
  muted: '#6F7780',
  pale: '#AEB9C4',
  line: '#E8EDF2',
  green: '#9AC51F',
  lightGreen: '#EAF4CE',
  orange: '#E99023',
  purple: '#7A52FF',
  white: '#FFFFFF',
};

const h = (size: number) => horizontalScale(size);
const v = (size: number) => verticalScale(size);
const ms = (size: number) => moderateScale(size, 0.2);

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

const hashToProgress = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const normalized = Math.abs(hash) / 2147483647;
  return 0.25 + normalized * 0.75;
};

const BackGlyph = ({ size = 31, color = COLORS.ink }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M20 7 11 16l9 9"
      stroke={color}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ClockGlyph = ({ size = 15, color = COLORS.pale }) => (
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

const GlobeGlyph = ({ size = 16, color = COLORS.pale }) => (
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

const PinGlyph = ({ size = 16, color = COLORS.pale }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path
      d="M8 14s4.5-4.1 4.5-7.2A4.5 4.5 0 0 0 3.5 6.8C3.5 9.9 8 14 8 14Z"
      stroke={color}
      strokeWidth="1.8"
    />
    <Circle cx="8" cy="6.8" r="1.4" stroke={color} strokeWidth="1.8" />
  </Svg>
);

const AppStack_SearchScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [meetings, setMeetings] = useState<MomentRequest[]>([]);
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
      if (response.data?.id) {
        setUserId(response.data.id);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const [receivedResponse, sentResponse] = await Promise.all([
        http.get('/users/moment-requests/received'),
        http.get('/users/moment-requests/sent'),
      ]);

      const received = Array.isArray(receivedResponse.data.requests)
        ? receivedResponse.data.requests
        : [];
      const sent = Array.isArray(sentResponse.data.requests) ? sentResponse.data.requests : [];
      setMeetings([...received, ...sent]);
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
          fields: [Contacts.Fields.Name, Contacts.Fields.Image, Contacts.Fields.PhoneNumbers],
        });

        const phoneToAvatarMap = new Map<string, string>();

        await Promise.all(
          data.map(async (contact) => {
            if (contact.phoneNumbers && contact.phoneNumbers.length > 0 && contact.image?.uri) {
              const avatarUri = contact.image.uri;
              await Promise.all(
                contact.phoneNumbers.map(async (phone) => {
                  const normalized = phone.number?.replace(/[\s\-()]/g, '') || '';
                  if (normalized && avatarUri) {
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

  const getLocalAvatar = (phoneNumber?: string) => {
    if (!phoneNumber) return null;
    return localAvatars.get(phoneNumber) || null;
  };

  const getConfidence = (meeting: MomentRequest) =>
    Math.max(0.25, Math.min(0.99, hashToProgress(meeting.id))).toFixed(2);

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

  const navigateToMeetingDate = (meeting: MomentRequest) => {
    const meetingDate = new Date(meeting.startTime);
    const year = meetingDate.getFullYear();
    const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
    const day = String(meetingDate.getDate()).padStart(2, '0');
    navigation.navigate('AppStack_CalendarScreen', { date: `${year}-${month}-${day}` });
  };

  const filteredMeetings = useMemo(() => {
    const searchableMeetings = meetings.filter((meeting) => {
      const status = meeting.status?.toLowerCase();
      return status === 'approved' || status === 'pending';
    });

    if (!searchText.trim()) return searchableMeetings;

    const term = searchText.toLowerCase();
    return searchableMeetings.filter((meeting) => {
      const otherPerson = getOtherPerson(meeting);
      const haystack = [
        getMeetingDisplayTitle(meeting),
        meeting.meetingType,
        meeting.status,
        otherPerson?.name,
        getMeetingLocation(meeting),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [meetings, searchText, userId]);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={[styles.content, { paddingTop: Math.max(insets.top + v(25), v(58)) }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.75}
              style={styles.backButton}>
              <BackGlyph />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Search</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search your meetings"
              placeholderTextColor="#A8B3BF"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              returnKeyType="search"
            />
            <Image source={SearchIcon} style={styles.searchIcon} resizeMode="contain" />
          </View>

          <Text style={styles.sectionTitle}>Your Meetings</Text>

          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + v(28), v(48)) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
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
                      <ClockGlyph />
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
                        <PinGlyph />
                        <Text style={styles.meetingDetailText}>{getMeetingLocation(meeting)}</Text>
                      </View>
                    )}

                    <View style={styles.attendeeRow}>
                      {Array.from({ length: isPaid ? 1 : 4 }).map((_, index) => (
                        <View
                          key={`${meeting.id}-avatar-${index}`}
                          style={[styles.smallAvatar, { marginLeft: index === 0 ? 0 : -h(8) }]}>
                          {index === 0 && localAvatar ? (
                            <Image source={{ uri: localAvatar }} style={styles.smallAvatarImage} />
                          ) : (
                            <Image source={Avatar} style={styles.smallAvatarImage} />
                          )}
                        </View>
                      ))}
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {searchText.trim() ? 'No meetings found' : 'Start typing to search'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: h(16),
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: v(24),
  },
  backButton: {
    alignItems: 'center',
    height: h(44),
    justifyContent: 'center',
    width: h(44),
  },
  headerTitle: {
    color: COLORS.ink,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(28),
    lineHeight: ms(34),
  },
  headerSpacer: {
    width: h(44),
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderColor: '#CBE985',
    borderRadius: h(28),
    borderWidth: 1,
    flexDirection: 'row',
    height: v(58),
    paddingHorizontal: h(19),
  },
  searchInput: {
    color: COLORS.ink,
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(20),
    height: '100%',
    padding: 0,
  },
  searchIcon: {
    height: h(26),
    tintColor: '#9EACBA',
    width: h(26),
  },
  sectionTitle: {
    color: COLORS.muted,
    fontFamily: 'Inter_700Bold',
    fontSize: ms(16),
    marginBottom: v(15),
    marginTop: v(32),
  },
  resultsScroll: {
    flex: 1,
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
    marginBottom: v(13),
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
    fontSize: ms(21),
    lineHeight: ms(27),
  },
  meetingBadges: {
    flexDirection: 'row',
    gap: h(7),
  },
  statusBadge: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(15),
    paddingHorizontal: h(11),
    paddingVertical: v(5),
  },
  pendingBadge: {
    backgroundColor: '#FFF3E3',
  },
  statusBadgeText: {
    color: '#65840E',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
  },
  pendingBadgeText: {
    color: COLORS.orange,
  },
  priceBadge: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: h(15),
    paddingHorizontal: h(11),
    paddingVertical: v(5),
  },
  paidBadge: {
    backgroundColor: '#F0E8FF',
  },
  priceBadgeText: {
    color: '#65840E',
    fontFamily: 'Inter_400Regular',
    fontSize: ms(14),
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
    fontSize: ms(16),
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: v(-22),
    minHeight: h(32),
  },
  smallAvatar: {
    borderColor: COLORS.white,
    borderRadius: h(16),
    borderWidth: 2,
    height: h(32),
    overflow: 'hidden',
    width: h(32),
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
  confidenceLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceLabel: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(18),
  },
  confidenceValue: {
    color: '#6F8E13',
    fontFamily: 'Inter_700Bold',
    fontSize: ms(17),
  },
  progressTrack: {
    backgroundColor: '#EDF1F4',
    borderRadius: h(6),
    height: v(9),
    marginTop: v(10),
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: COLORS.green,
    borderRadius: h(6),
    height: '100%',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: v(44),
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: 'Inter_400Regular',
    fontSize: ms(16),
  },
});

export default AppStack_SearchScreen;
