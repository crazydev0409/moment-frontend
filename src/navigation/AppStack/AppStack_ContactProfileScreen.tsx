import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Avatar, RescheduleIcon, UpcomingIcon, CalendarIcon, LocationIcon, HookIcon, TrashIcon, ChevronIcon, CheckIcon, BrainIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
const horizontalScale = h, verticalScale = v, moderateScale = ms;
import { colors, accessBadge } from '~/lib/theme';
import { Hook, formatDuration, formatPrice } from '~/helpers/hooks';

const GlobeIcon = ({ size = 13, color = colors.grey }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
    <Path d="M12 3C9.5 6.5 9.5 17.5 12 21M12 3C14.5 6.5 14.5 17.5 12 21M3.5 9h17M3.5 15h17" stroke={color} strokeWidth="1.5" />
  </Svg>
);

const MetaRow = ({ icon, label, globe }: { icon?: number; label: string; globe?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: h(6) }}>
    {globe ? (
      <GlobeIcon size={h(13)} color={colors.grey} />
    ) : icon ? (
      <Image source={icon} style={{ width: h(13), height: h(13) }} tintColor={colors.grey} />
    ) : null}
    <Text style={{ fontFamily: 'AssociateSansRegular', color: colors.grey, fontSize: ms(12) }}>{label}</Text>
  </View>
);

const ACTION_WIDTH = h(80);
// Closed = card visible, actions off-screen. Translatex of the whole row:
//   closed:           -ACTION_WIDTH  (card fills the container)
//   reschedule open:   0             (row shifted right, reschedule bar visible)
//   cancel open:      -ACTION_WIDTH*2 (row shifted left, cancel bar visible)
const POS_CLOSED = -ACTION_WIDTH;
const POS_RESCHEDULE = 0;
const POS_CANCEL = -ACTION_WIDTH * 2;
const SNAP_THRESHOLD = ACTION_WIDTH * 0.35;

const SwipeableRow: React.FC<{
  onReschedule: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}> = ({ onReschedule, onCancel, children }) => {
  // Measure the container so the card occupies exactly the right width in the row
  const [cardWidth, setCardWidth] = useState(
    Math.round(Dimensions.get('window').width * 0.84),
  );
  const translateX = useRef(new Animated.Value(POS_CLOSED)).current;
  const posRef = useRef(POS_CLOSED);

  const snapTo = (toValue: number, callback?: () => void) => {
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      overshootClamping: true,
      tension: 80,
      friction: 10,
    }).start(() => {
      posRef.current = toValue;
      callback?.();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        translateX.setOffset(posRef.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        const min = POS_CANCEL - posRef.current;
        const max = POS_RESCHEDULE - posRef.current;
        translateX.setValue(Math.max(min, Math.min(max, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        translateX.flattenOffset();
        const finalX = Math.max(POS_CANCEL, Math.min(POS_RESCHEDULE, posRef.current + g.dx));
        if (finalX > POS_CLOSED + SNAP_THRESHOLD || g.vx > 0.5) {
          snapTo(POS_RESCHEDULE);
        } else if (finalX < POS_CLOSED - SNAP_THRESHOLD || g.vx < -0.5) {
          snapTo(POS_CANCEL);
        } else {
          snapTo(POS_CLOSED);
        }
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        snapTo(POS_CLOSED);
      },
    }),
  ).current;

  const handleReschedule = () => snapTo(POS_CLOSED, onReschedule);
  const handleCancel = () => snapTo(POS_CLOSED, onCancel);

  return (
    <View
      style={{ marginBottom: v(12), overflow: 'hidden' }}
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
      {/* Single animated row: [Reschedule | Card | Cancel] — all three slide together */}
      <Animated.View
        style={{
          flexDirection: 'row',
          width: cardWidth + ACTION_WIDTH * 2,
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}>

        {/* Left: Reschedule — gap on right side */}
        <View style={{ width: ACTION_WIDTH, paddingRight: h(8) }}>
          <TouchableOpacity
            onPress={handleReschedule}
            activeOpacity={0.75}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.white,
              borderRadius: h(24),
            }}>
            <Image source={RescheduleIcon} style={{ width: h(22), height: h(22) }} tintColor={colors.grey} />
            <Text style={{ fontFamily: 'AssociateSansRegular', color: colors.grey, fontSize: ms(11), marginTop: v(4) }}>
              Reschedule
            </Text>
          </TouchableOpacity>
        </View>

        {/* Center: the card itself — rounded corners on all sides */}
        <View style={{ width: cardWidth }}>
          {children}
        </View>

        {/* Right: Cancel — gap on left side */}
        <View style={{ width: ACTION_WIDTH, paddingLeft: h(8) }}>
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.75}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.white,
              borderRadius: h(24),
            }}>
            <Image source={TrashIcon} style={{ width: h(20), height: h(20) }} tintColor={colors.danger} />
            <Text style={{ fontFamily: 'AssociateSansRegular', color: colors.danger, fontSize: ms(11), marginTop: v(4) }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

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
  confidenceScore?: number | null;
  participants?: Array<{ user?: { avatar?: string | null } | null }>;
}

interface ContactDetail {
  id: string;
  displayName: string;
  autoConfirm: boolean;
  contactUser?: { id: string; name?: string | null; avatar?: string | null; bio?: string | null; accountType?: string | null } | null;
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

  const handleCancelMeeting = (meetingId: string) => {
    Alert.alert('Cancel meeting', 'Are you sure you want to cancel this meeting?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await http.delete(`/users/moment-requests/${meetingId}`);
            setUpcomingMeetings((prev) => prev.filter((m) => m.id !== meetingId));
          } catch {
            Alert.alert('Error', 'Failed to cancel the meeting. Please try again.');
          }
        },
      },
    ]);
  };

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
            <Text style={[tw`font-associate-bold`, { fontSize: moderateScale(9), color: colors.grey }]}>+{extra}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderMeetingCard = (m: MeetingRequest) => {
    const statusLabel = m.status === 'confirmed' ? 'Confirmed' : m.status === 'pending' ? 'Pending' : m.status;
    const isConfirmed = m.status === 'confirmed';
    const score = typeof m.confidenceScore === 'number' ? m.confidenceScore : null;

    return (
      <SwipeableRow
        key={m.id}
        onReschedule={() => navigation.navigate('AppStack_CalendarScreen', { momentRequestId: m.id })}
        onCancel={() => handleCancelMeeting(m.id)}>
        <View style={[tw`rounded-3xl`, { backgroundColor: colors.card, padding: ms(14) }]}>
          {/* Status + price badges */}
          <View style={[tw`flex-row`, { marginBottom: v(6) }]}>
            <View
              style={[
                tw`rounded-full`,
                {
                  backgroundColor: isConfirmed ? colors.greenTint : colors.field,
                  paddingHorizontal: h(10),
                  paddingVertical: v(3),
                  marginRight: h(6),
                },
              ]}>
              <Text style={[tw`font-associate-bold`, { color: isConfirmed ? colors.greenText : colors.grey, fontSize: ms(11) }]}>
                {statusLabel}
              </Text>
            </View>
            <View
              style={[
                tw`rounded-full`,
                {
                  backgroundColor: m.isPaid ? colors.ink : colors.greenTint,
                  paddingHorizontal: h(10),
                  paddingVertical: v(3),
                },
              ]}>
              <Text style={[tw`font-associate-bold`, { color: m.isPaid ? colors.white : colors.greenText, fontSize: ms(11) }]}>
                {m.isPaid ? formatPrice(m.priceCents, m.currency) : 'Free'}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(15), marginBottom: v(8) }]}>
            {m.title}
          </Text>

          {/* Meta rows */}
          <View style={{ gap: v(4) }}>
            <MetaRow icon={UpcomingIcon} label={formatMeetingTime(m.startTime, m.endTime)} />
            <MetaRow icon={CalendarIcon} label={formatMeetingDate(m.startTime)} />
            <MetaRow globe label={m.locationType === 'in_person' ? 'In-person' : 'Remote'} />
            {m.locationLabel && <MetaRow icon={LocationIcon} label={m.locationLabel} />}
          </View>

          {/* Confidence Score */}
          {score !== null && (
            <View style={{ marginTop: v(10) }}>
              <View style={[tw`flex-row items-center justify-between`, { marginBottom: v(4) }]}>
                <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(12) }]}>Confidence Score:</Text>
                <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: ms(12) }]}>
                  {score.toFixed(2)}
                </Text>
              </View>
              <View style={{ height: v(6), backgroundColor: colors.field, borderRadius: h(3), overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(score * 100)}%`, height: '100%', backgroundColor: colors.green, borderRadius: h(3) }} />
              </View>
            </View>
          )}

          {/* Avatar stack */}
          <View style={[tw`flex-row items-center`, { marginTop: v(10) }]}>
            {renderAvatarStack(m.participants)}
          </View>
        </View>
      </SwipeableRow>
    );
  };

  const renderHookCard = (hook: Hook) => {
    const isExpanded = !!expandedHooks[hook.id];
    const access = accessBadge[hook.accessLevel] || accessBadge.personal;
    const hookParticipants = hook.participants
      ?.filter((p) => p.status === 'accepted')
      .map((p) => ({ user: p.user ? { avatar: p.user.avatar } : undefined }));

    return (
      <View
        key={hook.id}
        style={[
          tw`rounded-3xl`,
          { backgroundColor: colors.card, padding: ms(16), marginBottom: v(12) },
        ]}>
        {/* Title + badges row */}
        <View style={[tw`flex-row items-start justify-between`, { marginBottom: v(8) }]}>
          <Text
            numberOfLines={1}
            style={[tw`font-associate-bold flex-1`, { color: colors.ink, fontSize: ms(16), marginRight: h(8) }]}>
            {hook.title}
          </Text>
          <View style={tw`flex-row items-center`}>
            <View
              style={[
                tw`rounded-full`,
                { backgroundColor: access.bg, paddingHorizontal: h(10), paddingVertical: v(3), marginRight: h(6) },
              ]}>
              <Text style={[tw`font-associate-bold`, { color: access.fg, fontSize: ms(11) }]}>{access.label}</Text>
            </View>
            <View
              style={[
                tw`rounded-full`,
                { backgroundColor: hook.isPaid ? colors.ink : colors.greenTint, paddingHorizontal: h(10), paddingVertical: v(3) },
              ]}>
              <Text style={[tw`font-associate-bold`, { color: hook.isPaid ? colors.white : colors.greenText, fontSize: ms(11) }]}>
                {hook.isPaid ? formatPrice(hook.priceCents, hook.currency) : 'Free'}
              </Text>
            </View>
          </View>
        </View>

        {/* Meta rows */}
        <View style={{ gap: v(4) }}>
          <MetaRow icon={UpcomingIcon} label={formatDuration(hook.durationMinutes)} />
          {hook.locationType === 'in_person' && hook.locationLabel && (
            <MetaRow icon={LocationIcon} label={hook.locationLabel} />
          )}
        </View>

        {/* Description when expanded */}
        {isExpanded && !!hook.description && (
          <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(12.5), marginTop: v(8) }]}>
            {hook.description}
          </Text>
        )}

        {/* Bottom: avatar stack + actions */}
        <View style={[tw`flex-row items-center justify-between`, { marginTop: v(12) }]}>
          <View style={tw`flex-row items-center`}>
            <TouchableOpacity
              onPress={() => setExpandedHooks((p) => ({ ...p, [hook.id]: !p[hook.id] }))}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: h(4), marginRight: h(12) }}>
              <Text style={[tw`font-associate-bold`, { color: colors.grey, fontSize: ms(12.5) }]}>
                {isExpanded ? 'Less details' : 'More details'}
              </Text>
              <Image
                source={ChevronIcon}
                style={{ width: h(12), height: h(12), transform: [{ rotate: isExpanded ? '270deg' : '90deg' }] }}
                tintColor={colors.grey}
              />
            </TouchableOpacity>
            {hookParticipants && hookParticipants.length > 0 && renderAvatarStack(hookParticipants)}
          </View>
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
              { borderWidth: 1.5, borderColor: colors.green, paddingHorizontal: h(18), paddingVertical: v(6) },
            ]}>
            <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: ms(13) }]}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const contactUser = contact?.contactUser;
  const displayName = contactName || contact?.displayName || 'Contact';
  const isDeletedAccount = contactUser?.accountType === 'deleted';

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
        <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
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
          <Image source={UpcomingIcon} style={{ width: h(24), height: h(24) }} tintColor={colors.ink} />
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
          directionalLockEnabled
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
                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(18) }]}>
                  {displayName}
                </Text>
                {!isDeletedAccount && (
                  <View
                    style={[
                      tw`rounded-full items-center justify-center`,
                      {
                        width: horizontalScale(18),
                        height: horizontalScale(18),
                        backgroundColor: contactUser?.accountType === 'agent' ? colors.ink : '#2D7FF9',
                        marginLeft: horizontalScale(6),
                      },
                    ]}>
                    <Image
                      source={contactUser?.accountType === 'agent' ? BrainIcon : CheckIcon}
                      style={{ width: h(10), height: h(10) }}
                      tintColor={colors.white}
                    />
                  </View>
                )}
              </View>
              {isDeletedAccount && (
                <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(12.5), marginTop: 2 }]}>
                  This account has been deleted
                </Text>
              )}
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
                      <Text style={[tw`font-associate`, { color: colors.greenText, fontSize: moderateScale(11) }]}>{h.title}</Text>
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
                tw`font-associate`,
                { color: colors.inkSoft, fontSize: moderateScale(13.5), fontStyle: 'italic', marginBottom: verticalScale(14) },
              ]}>
              "{contactUser.bio}"
            </Text>
          )}

          {/* Block / Auto-Confirm toggles */}
          <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, marginBottom: verticalScale(10) }]}>
            <View style={[tw`flex-row items-center justify-between`, { padding: moderateScale(16) }]}>
              <Text style={[tw`font-associate`, { color: colors.ink, fontSize: moderateScale(15) }]}>Block</Text>
              <Switch
                value={isBlocked}
                onValueChange={handleToggleBlock}
                trackColor={{ true: colors.danger, false: colors.border }}
              />
            </View>
          </View>
          <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, marginBottom: verticalScale(18) }]}>
            <View style={[tw`flex-row items-center justify-between`, { padding: moderateScale(16) }]}>
              <Text style={[tw`font-associate`, { color: colors.ink, fontSize: moderateScale(15) }]}>Auto-Confirm</Text>
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
                    tw`font-associate-bold`,
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
              <Text style={[tw`text-center font-associate`, { color: colors.grey, paddingVertical: verticalScale(30), fontSize: moderateScale(14) }]}>
                No upcoming meetings
              </Text>
            ) : (
              upcomingMeetings.map(renderMeetingCard)
            )
          ) : (
            contactHooks.length === 0 ? (
              <Text style={[tw`text-center font-associate`, { color: colors.grey, paddingVertical: verticalScale(30), fontSize: moderateScale(14) }]}>
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
            if (isDeletedAccount) {
              Alert.alert('Account deleted', 'This person has deleted their Catch account and can no longer be booked.');
              return;
            }
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
          style={[
            tw`rounded-full flex-row items-center justify-center`,
            { backgroundColor: isDeletedAccount ? colors.border : colors.green, paddingVertical: verticalScale(15) },
          ]}>
          <Image
            source={HookIcon}
            style={{ width: h(20), height: h(20), marginRight: h(8) }}
            tintColor={isDeletedAccount ? colors.grey : colors.white}
          />
          <Text style={[tw`font-associate-bold`, { color: isDeletedAccount ? colors.grey : colors.white, fontSize: ms(16) }]}>
            {isDeletedAccount ? 'No longer available' : 'View available times'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AppStack_ContactProfileScreen;
