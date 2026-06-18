import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Avatar } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors, accessBadge, priceBadge } from '~/lib/theme';
import { Hook, formatDuration, formatPrice } from '~/helpers/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ContactProfileScreen'>;

type TabKey = 'upcoming' | 'hooks';

interface MeetingRequest {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  locationType: string;
  locationLabel?: string | null;
  isPaid?: boolean;
  priceCents?: number | null;
  currency?: string;
  participants?: Array<{ user?: { avatar?: string | null } | null }>;
}

interface ContactDetail {
  id: string;
  displayName: string;
  autoConfirm: boolean;
  contactUser?: { id: string; name?: string | null; avatar?: string | null; bio?: string | null } | null;
  contactUserId?: string | null;
}

const AppStack_ContactProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contactId, contactUserId, contactName } = route.params;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState<MeetingRequest[]>([]);
  const [contactHooks, setContactHooks] = useState<Hook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [isBlocked, setIsBlocked] = useState(false);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [expandedHooks, setExpandedHooks] = useState<Record<string, boolean>>({});

  const load = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);

      const [contactsRes, receivedRes, sentRes] = await Promise.all([
        http.get('/users/contacts'),
        http.get('/users/moment-requests/received').catch(() => ({ data: { requests: [] } })),
        http.get('/users/moment-requests/sent').catch(() => ({ data: { requests: [] } })),
      ]);

      const allContacts: ContactDetail[] = contactsRes.data.contacts || [];
      const found = allContacts.find((c) => c.id === contactId) || null;
      if (found) {
        setContact(found);
        setAutoConfirm(found.autoConfirm ?? false);
      }

      const contactUid = contactUserId || found?.contactUserId || found?.contactUser?.id;

      // Gather meetings that involve this contact's user id
      const now = new Date();
      const allMeetings: MeetingRequest[] = [
        ...(receivedRes.data.requests || []),
        ...(sentRes.data.requests || []),
      ];
      const deduped = Array.from(new Map(allMeetings.map((m) => [m.id, m])).values());
      const upcoming = deduped.filter((m) => {
        if (m.status === 'cancelled' || m.status === 'rejected') return false;
        return new Date(m.startTime) >= now;
      });
      setUpcomingMeetings(upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));

      // Load the contact's open hooks
      if (contactUid) {
        try {
          const hooksRes = await http.get(`/hooks/user/${contactUid}`);
          setContactHooks(hooksRes.data.hooks || []);
        } catch {
          setContactHooks([]);
        }
      }

      // Check if blocked
      const blockedRes = await http.get('/users/blocked').catch(() => ({ data: { blockedUsers: [] } }));
      const blockedIds: string[] = (blockedRes.data.blockedUsers || []).map((u: any) => u.id);
      if (contactUid) setIsBlocked(blockedIds.includes(contactUid));
    } catch (err) {
      console.error('ContactProfile load error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [contactId, contactUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(() => { setIsRefreshing(true); load(false); }, [load]);

  const handleToggleBlock = async (val: boolean) => {
    const uid = contactUserId || contact?.contactUserId || contact?.contactUser?.id;
    if (!uid) return;
    setIsBlocked(val);
    try {
      if (val) {
        await http.post('/users/block', { userId: uid });
      } else {
        await http.delete(`/users/unblock/${uid}`);
      }
    } catch {
      setIsBlocked(!val);
      Alert.alert('Error', 'Could not update block setting.');
    }
  };

  const handleToggleAutoConfirm = async (val: boolean) => {
    setAutoConfirm(val);
    try {
      await http.patch(`/users/contacts/${contactId}`, { autoConfirm: val });
    } catch {
      setAutoConfirm(!val);
      Alert.alert('Error', 'Could not update auto-confirm setting.');
    }
  };

  const formatMeetingTime = (startTime: string, endTime: string) => {
    const s = new Date(startTime);
    const e = new Date(endTime);
    const fmt = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes();
      const p = h >= 12 ? 'pm' : 'am';
      h = h % 12 || 12;
      return `${h}:${String(m).padStart(2, '0')} ${p}`;
    };
    return `${fmt(s)}-${fmt(e)}`;
  };

  const formatMeetingDate = (startTime: string) => {
    const d = new Date(startTime);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const renderAvatarStack = (participants?: Array<{ user?: { avatar?: string | null } | null }>) => {
    if (!participants || participants.length === 0) return null;
    const shown = participants.slice(0, 4);
    const extra = participants.length - shown.length;
    return (
      <View style={tw`flex-row items-center`}>
        {shown.map((p, i) => (
          <View
            key={i}
            style={[
              tw`rounded-full overflow-hidden items-center justify-center`,
              {
                width: horizontalScale(28),
                height: horizontalScale(28),
                marginLeft: i === 0 ? 0 : -horizontalScale(7),
                borderWidth: 1.5,
                borderColor: colors.card,
                backgroundColor: colors.field,
              },
            ]}>
            {p.user?.avatar ? (
              <Image source={{ uri: p.user.avatar }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Image source={Avatar} style={{ width: horizontalScale(16), height: horizontalScale(16) }} />
            )}
          </View>
        ))}
        {extra > 0 && (
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              {
                width: horizontalScale(28),
                height: horizontalScale(28),
                marginLeft: -horizontalScale(7),
                backgroundColor: colors.field,
                borderWidth: 1.5,
                borderColor: colors.card,
              },
            ]}>
            <Text style={[tw`font-dm font-bold`, { fontSize: moderateScale(9), color: colors.grey }]}>+{extra}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderMeetingCard = (m: MeetingRequest) => {
    const statusLabel = m.status === 'confirmed' ? 'Confirmed' : m.status === 'pending' ? 'Pending' : m.status;
    return (
      <View
        key={m.id}
        style={[
          tw`rounded-3xl`,
          { backgroundColor: colors.card, padding: moderateScale(16), marginBottom: verticalScale(12) },
        ]}>
        <View style={tw`flex-row items-center`} >
          <View
            style={[
              tw`rounded-full`,
              {
                backgroundColor: m.status === 'confirmed' ? colors.greenTint : colors.field,
                paddingHorizontal: horizontalScale(10),
                paddingVertical: verticalScale(4),
                marginRight: horizontalScale(8),
              },
            ]}>
            <Text
              style={[
                tw`font-dm font-bold`,
                { color: m.status === 'confirmed' ? colors.greenText : colors.grey, fontSize: moderateScale(11) },
              ]}>
              {statusLabel}
            </Text>
          </View>
          <View
            style={[
              tw`rounded-full`,
              {
                backgroundColor: m.isPaid ? colors.ink : colors.greenTint,
                paddingHorizontal: horizontalScale(10),
                paddingVertical: verticalScale(4),
              },
            ]}>
            <Text
              style={[
                tw`font-dm font-bold`,
                { color: m.isPaid ? colors.white : colors.greenText, fontSize: moderateScale(11) },
              ]}>
              {m.isPaid ? formatPrice(m.priceCents, m.currency) : 'Free'}
            </Text>
          </View>
        </View>

        <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(16), marginTop: verticalScale(8) }]}>
          {m.title}
        </Text>

        <View style={{ marginTop: verticalScale(8) }}>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
            🕐 {formatMeetingTime(m.startTime, m.endTime)}
          </Text>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
            📅 {formatMeetingDate(m.startTime)}
          </Text>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
            🌐 {m.locationType === 'in_person' ? 'In-person' : 'Remote'}
          </Text>
          {m.locationLabel && (
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
              📍 {m.locationLabel}
            </Text>
          )}
        </View>

        <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(10) }]}>
          {renderAvatarStack(m.participants)}
          <View style={tw`flex-row`}>
            <TouchableOpacity
              onPress={() => navigation.navigate('AppStack_CalendarScreen', { momentRequestId: m.id })}
              style={[
                tw`rounded-full items-center justify-center`,
                {
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: horizontalScale(12),
                  paddingVertical: verticalScale(6),
                  marginRight: horizontalScale(8),
                },
              ]}>
              <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12) }]}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                tw`rounded-full items-center justify-center`,
                {
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: horizontalScale(12),
                  paddingVertical: verticalScale(6),
                },
              ]}>
              <Text style={[tw`font-dm`, { color: colors.danger, fontSize: moderateScale(12) }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderHookCard = (hook: Hook) => {
    const isExpanded = !!expandedHooks[hook.id];
    const access = accessBadge[hook.accessLevel] || accessBadge.personal;
    return (
      <View
        key={hook.id}
        style={[
          tw`rounded-3xl`,
          { backgroundColor: colors.card, padding: moderateScale(16), marginBottom: verticalScale(12) },
        ]}>
        <View style={tw`flex-row items-start justify-between`}>
          <Text
            numberOfLines={1}
            style={[tw`font-dm font-bold flex-1`, { color: colors.ink, fontSize: moderateScale(16), marginRight: horizontalScale(8) }]}>
            {hook.icon ? `${hook.icon} ` : ''}{hook.title}
          </Text>
          <View style={tw`flex-row items-center`}>
            <View
              style={[
                tw`rounded-full`,
                { backgroundColor: access.bg, paddingHorizontal: horizontalScale(10), paddingVertical: verticalScale(4), marginRight: horizontalScale(6) },
              ]}>
              <Text style={[tw`font-dm font-bold`, { color: access.fg, fontSize: moderateScale(11) }]}>{access.label}</Text>
            </View>
            <View
              style={[
                tw`rounded-full`,
                {
                  backgroundColor: hook.isPaid ? colors.ink : colors.greenTint,
                  paddingHorizontal: horizontalScale(10),
                  paddingVertical: verticalScale(4),
                },
              ]}>
              <Text style={[tw`font-dm font-bold`, { color: hook.isPaid ? colors.white : colors.greenText, fontSize: moderateScale(11) }]}>
                {hook.isPaid ? formatPrice(hook.priceCents, hook.currency) : 'Free'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginTop: verticalScale(8) }}>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
            🕐 {formatDuration(hook.durationMinutes)}
          </Text>
          {hook.locationType === 'in_person' && hook.locationLabel && (
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
              📍 {hook.locationLabel}
            </Text>
          )}
        </View>

        {isExpanded && !!hook.description && (
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5), marginTop: verticalScale(8) }]}>
            {hook.description}
          </Text>
        )}

        <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(12) }]}>
          <TouchableOpacity
            onPress={() => setExpandedHooks((p) => ({ ...p, [hook.id]: !p[hook.id] }))}
            activeOpacity={0.7}>
            <Text style={[tw`font-dm font-bold`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
              {isExpanded ? 'Less details ⌃' : 'More details ⌄'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const uid = contactUserId || contact?.contactUserId || contact?.contactUser?.id;
              if (uid) {
                navigation.navigate('AppStack_AvailableTimesScreen', {
                  contactId,
                  contactUserId: uid,
                  contactName: contactName || contact?.displayName || 'Contact',
                });
              }
            }}
            activeOpacity={0.85}
            style={[
              tw`rounded-full items-center`,
              {
                borderWidth: 1.5,
                borderColor: colors.green,
                paddingHorizontal: horizontalScale(18),
                paddingVertical: verticalScale(6),
              },
            ]}>
            <Text style={[tw`font-dm font-bold`, { color: colors.green, fontSize: moderateScale(13) }]}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const contactUser = contact?.contactUser;
  const displayName = contactName || contact?.displayName || 'Contact';

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center justify-between`,
          { marginTop: verticalScale(55), paddingHorizontal: '8%', marginBottom: verticalScale(12) },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
          Contact profile
        </Text>
        <TouchableOpacity
          onPress={() => {
            const uid = contactUserId || contact?.contactUserId || contact?.contactUser?.id;
            if (uid) {
              navigation.navigate('AppStack_MeetingHistoryScreen', {
                contactUserId: uid,
                contactName: displayName,
              });
            }
          }}
          activeOpacity={0.7}>
          <Text style={{ fontSize: moderateScale(22) }}>🕐</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(120) }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.green} />}>

          {/* Contact avatar + name + categories */}
          <View style={[tw`flex-row items-center`, { marginBottom: verticalScale(14) }]}>
            <View
              style={[
                tw`rounded-full overflow-hidden items-center justify-center`,
                { width: horizontalScale(64), height: horizontalScale(64), backgroundColor: colors.field, marginRight: horizontalScale(14) },
              ]}>
              {contactUser?.avatar ? (
                <Image source={{ uri: contactUser.avatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Image source={Avatar} style={{ width: horizontalScale(38), height: horizontalScale(38) }} />
              )}
            </View>
            <View style={tw`flex-1`}>
              <View style={tw`flex-row items-center`}>
                <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18) }]}>
                  {displayName}
                </Text>
                <View
                  style={[
                    tw`rounded-full items-center justify-center`,
                    { width: horizontalScale(18), height: horizontalScale(18), backgroundColor: '#2D7FF9', marginLeft: horizontalScale(6) },
                  ]}>
                  <Text style={{ color: colors.white, fontSize: moderateScale(10), fontWeight: 'bold' }}>✓</Text>
                </View>
              </View>
              {/* Hook category pills from hook titles */}
              {contactHooks.length > 0 && (
                <View style={[tw`flex-row flex-wrap`, { marginTop: verticalScale(6), gap: 4 }]}>
                  {contactHooks.slice(0, 3).map((h) => (
                    <View
                      key={h.id}
                      style={[
                        tw`rounded-full`,
                        {
                          backgroundColor: colors.greenTint,
                          paddingHorizontal: horizontalScale(10),
                          paddingVertical: verticalScale(3),
                        },
                      ]}>
                      <Text style={[tw`font-dm`, { color: colors.greenText, fontSize: moderateScale(11) }]}>{h.title}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Bio */}
          {contactUser?.bio && (
            <Text
              style={[
                tw`font-dm`,
                { color: colors.inkSoft, fontSize: moderateScale(13.5), fontStyle: 'italic', marginBottom: verticalScale(14) },
              ]}>
              "{contactUser.bio}"
            </Text>
          )}

          {/* Block / Auto-Confirm toggles */}
          <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, marginBottom: verticalScale(10) }]}>
            <View style={[tw`flex-row items-center justify-between`, { padding: moderateScale(16) }]}>
              <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(15) }]}>Block</Text>
              <Switch
                value={isBlocked}
                onValueChange={handleToggleBlock}
                trackColor={{ true: colors.danger, false: colors.border }}
              />
            </View>
          </View>
          <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, marginBottom: verticalScale(18) }]}>
            <View style={[tw`flex-row items-center justify-between`, { padding: moderateScale(16) }]}>
              <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(15) }]}>Auto-Confirm</Text>
              <Switch
                value={autoConfirm}
                onValueChange={handleToggleAutoConfirm}
                trackColor={{ true: colors.green, false: colors.border }}
              />
            </View>
          </View>

          {/* Tabs */}
          <View style={[tw`flex-row`, { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: verticalScale(16) }]}>
            {(['upcoming', 'hooks'] as TabKey[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
                style={[
                  {
                    flex: 1,
                    paddingBottom: verticalScale(10),
                    borderBottomWidth: 2,
                    borderBottomColor: activeTab === tab ? colors.green : 'transparent',
                    alignItems: 'center',
                  },
                ]}>
                <Text
                  style={[
                    tw`font-dm font-bold`,
                    {
                      color: activeTab === tab ? colors.green : colors.grey,
                      fontSize: moderateScale(14.5),
                    },
                  ]}>
                  {tab === 'upcoming' ? 'Upcoming meetings' : 'Hooks'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'upcoming' ? (
            upcomingMeetings.length === 0 ? (
              <Text style={[tw`text-center font-dm`, { color: colors.grey, paddingVertical: verticalScale(30), fontSize: moderateScale(14) }]}>
                No upcoming meetings
              </Text>
            ) : (
              upcomingMeetings.map(renderMeetingCard)
            )
          ) : (
            contactHooks.length === 0 ? (
              <Text style={[tw`text-center font-dm`, { color: colors.grey, paddingVertical: verticalScale(30), fontSize: moderateScale(14) }]}>
                No open hooks
              </Text>
            ) : (
              contactHooks.map(renderHookCard)
            )
          )}
        </ScrollView>
      )}

      {/* View available times CTA */}
      <View
        style={[
          tw`absolute left-0 right-0`,
          {
            bottom: 0,
            paddingHorizontal: '8%',
            paddingTop: verticalScale(12),
            paddingBottom: verticalScale(30),
          },
        ]}>
        <TouchableOpacity
          onPress={() => {
            const uid = contactUserId || contact?.contactUserId || contact?.contactUser?.id;
            if (!uid) {
              Alert.alert('Not available', 'This contact has not joined Catch yet.');
              return;
            }
            navigation.navigate('AppStack_AvailableTimesScreen', {
              contactId,
              contactUserId: uid,
              contactName: displayName,
            });
          }}
          activeOpacity={0.85}
          style={[tw`rounded-full flex-row items-center justify-center`, { backgroundColor: colors.green, paddingVertical: verticalScale(15) }]}>
          <Text style={{ fontSize: moderateScale(16), marginRight: horizontalScale(8) }}>🪝</Text>
          <Text style={[tw`font-dm font-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>
            View available times
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AppStack_ContactProfileScreen;
