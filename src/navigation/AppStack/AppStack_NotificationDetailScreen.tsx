import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import {
  Avatar,
  BackArrow,
  CalendarIcon,
  CheckIcon,
  CrossIcon,
  LocationIcon,
  UpcomingIcon,
} from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { formatPrice } from '~/helpers/hooks';
import { resolveContactAvatarUri, useDeviceContactAvatarMap } from '~/helpers/contactAvatars';

const h = horizontalScale;
const v = verticalScale;
const ms = (n: number) => moderateScale(n, 0.2);

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_NotificationDetailScreen'>;

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

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
  sender?: { id: string; name?: string | null; avatar?: string | null; phoneNumber?: string | null };
  participants?: Array<{ user?: { id: string; name?: string | null; avatar?: string | null; phoneNumber?: string | null } | null }>;
}

interface Participant {
  id?: string;
  name?: string | null;
  avatar?: string | null;
  phoneNumber?: string | null;
}

// ===== SVG Icons =====

const CheckCircleSvg = ({ size = 16 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="12" fill={colors.green} />
    <Path d="M7 12l3.5 3.5L17 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CrossCircleSvg = ({ size = 16 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="12" fill={colors.danger} />
    <Path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// ===== Helpers =====

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => {
    let hh = d.getHours();
    const mm = d.getMinutes();
    const p = hh >= 12 ? 'pm' : 'am';
    hh = hh % 12 || 12;
    return `${hh}:${String(mm).padStart(2, '0')} ${p}`;
  };
  return `${fmt(s)}-${fmt(e)}`;
}

function formatDate(start: string): string {
  return new Date(start).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// ===== Invitee pill (for added/removed sections) =====

const InviteePill: React.FC<{ p: Participant; strikethrough?: boolean }> = ({
  p,
  strikethrough,
}) => {
  const { avatarMap } = useDeviceContactAvatarMap();
  const uri = resolveContactAvatarUri(avatarMap, p.phoneNumber, p.avatar);
  return (
  <View
    style={[
      tw`flex-row items-center rounded-full`,
      {
        backgroundColor: colors.field,
        paddingHorizontal: h(12),
        paddingVertical: v(8),
        marginBottom: v(8),
        alignSelf: 'flex-start',
      },
    ]}>
    <View
      style={[
        tw`rounded-full overflow-hidden items-center justify-center`,
        { width: h(28), height: h(28), backgroundColor: colors.border, marginRight: h(8) },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: h(28), height: h(28) }} />
      ) : (
        <Image source={Avatar} style={{ width: h(18), height: h(18) }} tintColor={colors.grey} />
      )}
    </View>
    <Text
      style={{
        fontFamily: 'AssociateSansRegular',
        color: strikethrough ? colors.grey : colors.ink,
        fontSize: ms(14),
        textDecorationLine: strikethrough ? 'line-through' : 'none',
      }}>
      {p.name || 'Unknown'}
    </Text>
  </View>
  );
};

// ===== Invitee avatar (for "Other invitees" horizontal scroll) =====

const InviteeAvatar: React.FC<{ p: Participant }> = ({ p }) => {
  const { avatarMap } = useDeviceContactAvatarMap();
  const uri = resolveContactAvatarUri(avatarMap, p.phoneNumber, p.avatar);
  return (
  <View style={[tw`items-center`, { marginRight: h(16) }]}>
    <View style={{ position: 'relative', marginBottom: v(6) }}>
      <View
        style={[
          tw`rounded-full overflow-hidden items-center justify-center`,
          { width: h(52), height: h(52), backgroundColor: colors.field },
        ]}>
        {uri ? (
          <Image source={{ uri }} style={{ width: h(52), height: h(52) }} />
        ) : (
          <Image source={Avatar} style={{ width: h(30), height: h(30) }} tintColor={colors.grey} />
        )}
      </View>
      {/* Blue check badge */}
      <View
        style={[
          tw`absolute rounded-full items-center justify-center`,
          {
            bottom: 0,
            right: 0,
            width: h(18),
            height: h(18),
            backgroundColor: '#2D7FF9',
            borderWidth: 1.5,
            borderColor: colors.card,
          },
        ]}>
        <Image
          source={CheckIcon}
          style={{ width: h(9), height: h(9) }}
          tintColor={colors.white}
        />
      </View>
    </View>
    {p.name && (
      <Text
        numberOfLines={2}
        style={{
          fontFamily: 'AssociateSansRegular',
          color: colors.ink,
          fontSize: ms(11),
          textAlign: 'center',
          maxWidth: h(60),
        }}>
        {p.name.split(' ')[0]}
        {p.name.split(' ').length > 1 ? '\n' + p.name.split(' ').slice(1).join(' ') : ''}
      </Text>
    )}
  </View>
  );
};

// ===== Main Screen =====

const AppStack_NotificationDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { notificationId } = route.params;

  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [meeting, setMeeting] = useState<MeetingRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const { avatarMap } = useDeviceContactAvatarMap();

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get('/users/notifications');
        const all: AppNotification[] = res.data.notifications || [];
        const found = all.find((n) => n.id === notificationId) || null;
        setNotification(found);

        if (found?.data) {
          const d = typeof found.data === 'string' ? JSON.parse(found.data) : found.data;
          if (d?.momentRequestId) {
            const [recRes, sentRes] = await Promise.all([
              http.get('/users/moment-requests/received').catch(() => ({ data: { requests: [] } })),
              http.get('/users/moment-requests/sent').catch(() => ({ data: { requests: [] } })),
            ]);
            const all: MeetingRequest[] = [
              ...(recRes.data.requests || []),
              ...(sentRes.data.requests || []),
            ];
            setMeeting(all.find((r) => r.id === d.momentRequestId) || null);
          }
        }
      } catch (err) {
        console.error('NotifDetail load error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [notificationId]);

  const handleRespond = async (accept: boolean) => {
    if (!meeting) return;
    try {
      setIsResponding(true);
      // Backend expects { approved: boolean } — a previous { status: 'confirmed' | 'rejected' }
      // body doesn't match that contract, so every accept/decline tap 400'd silently.
      await http.post(`/users/moment-requests/${meeting.id}/respond`, {
        approved: accept,
      });
      navigation.goBack();
    } catch (err: any) {
      console.error('respond error', err);
      Alert.alert(
        'Something went wrong',
        err.response?.data?.error || 'Could not respond to this meeting request. Please try again.'
      );
    } finally {
      setIsResponding(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
        <NotifHeader onBack={() => navigation.goBack()} />
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </View>
    );
  }

  if (!notification) {
    return (
      <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
        <NotifHeader onBack={() => navigation.goBack()} />
        <View style={tw`flex-1 items-center justify-center`}>
          <Text style={{ fontFamily: 'AssociateSansRegular', color: colors.grey, fontSize: ms(14) }}>
            Notification not found
          </Text>
        </View>
      </View>
    );
  }

  const type = notification.type;
  const isInviteType = type === 'moment_request_created';
  const isAcceptedType = type === 'moment_request_accepted';
  const isDeclinedType =
    type === 'moment_request_rejected' || type === 'moment_request_canceled';
  const isMomentRequestType = isInviteType || isAcceptedType || isDeclinedType || type === 'moment_request_rescheduled';
  const isParticipantAddType = type.includes('added') || type.includes('participant_add');
  const isParticipantRemoveType = type.includes('removed') || type.includes('participant_remov');

  // Parse extra participant data from notification.data
  const parsedData = (() => {
    try {
      return typeof notification.data === 'string'
        ? JSON.parse(notification.data)
        : notification.data || {};
    } catch {
      return {};
    }
  })();

  const addedParticipants: Participant[] = parsedData.addedParticipants || [];
  const removedParticipants: Participant[] = parsedData.removedParticipants || [];
  const otherInvitees: Participant[] =
    (meeting?.participants || [])
      .map((p) => p.user)
      .filter((u): u is NonNullable<typeof u> => !!u) || [];

  const showInviteesSection =
    otherInvitees.length > 0 || addedParticipants.length > 0 || removedParticipants.length > 0;

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <NotifHeader onBack={() => navigation.goBack()} />

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{
          paddingHorizontal: '8%',
          paddingBottom: v(isInviteType && meeting ? 120 : 40),
        }}
        showsVerticalScrollIndicator={false}>
        {/* Main detail card — tapping it jumps to the exact day/time this
            meeting is scheduled for in the Calendar screen (reusing the same
            momentRequestId deep-link the Home screen's toast already uses,
            which scrolls to and opens that specific event). */}
        <TouchableOpacity
          activeOpacity={meeting ? 0.85 : 1}
          disabled={!meeting}
          onPress={() => {
            if (!meeting) return;
            const start = new Date(meeting.startTime);
            const year = start.getFullYear();
            const month = String(start.getMonth() + 1).padStart(2, '0');
            const day = String(start.getDate()).padStart(2, '0');
            navigation.navigate('AppStack_CalendarScreen', {
              date: `${year}-${month}-${day}`,
              momentRequestId: meeting.id,
            });
          }}
          style={[
            tw`rounded-3xl`,
            {
              backgroundColor: colors.card,
              padding: h(16),
              marginBottom: v(16),
            },
          ]}>
          {/* Header row: avatar + title + badge */}
          <View style={[tw`flex-row items-start`, { marginBottom: v(12) }]}>
            {/* Show avatar for moment-request types only */}
            {(isMomentRequestType) && (
              <View style={{ position: 'relative', marginRight: h(12) }}>
                <View
                  style={[
                    tw`rounded-full overflow-hidden items-center justify-center`,
                    { width: h(46), height: h(46), backgroundColor: colors.field },
                  ]}>
                  {resolveContactAvatarUri(avatarMap, meeting?.sender?.phoneNumber, meeting?.sender?.avatar) ? (
                    <Image
                      source={{ uri: resolveContactAvatarUri(avatarMap, meeting?.sender?.phoneNumber, meeting?.sender?.avatar)! }}
                      style={{ width: h(46), height: h(46) }}
                    />
                  ) : (
                    <Image
                      source={Avatar}
                      style={{ width: h(28), height: h(28) }}
                      tintColor={colors.grey}
                    />
                  )}
                </View>
                {/* Status badge */}
                {isAcceptedType && (
                  <View style={{ position: 'absolute', bottom: 0, right: 0 }}>
                    <CheckCircleSvg size={h(18)} />
                  </View>
                )}
                {isDeclinedType && (
                  <View style={{ position: 'absolute', bottom: 0, right: 0 }}>
                    <CrossCircleSvg size={h(18)} />
                  </View>
                )}
              </View>
            )}

            <View style={tw`flex-1`}>
              <Text
                style={{
                  fontFamily: 'AssociateSansBold',
                  color: colors.ink,
                  fontSize: ms(14.5),
                  marginBottom: v(6),
                }}>
                {notification.title}
              </Text>
              {/* Price badge */}
              <View
                style={[
                  tw`self-start rounded-full`,
                  {
                    backgroundColor: meeting?.isPaid ? colors.ink : colors.greenTint,
                    paddingHorizontal: h(10),
                    paddingVertical: v(3),
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: 'AssociateSansBold',
                    color: meeting?.isPaid ? colors.white : colors.greenText,
                    fontSize: ms(11),
                  }}>
                  {meeting?.isPaid
                    ? formatPrice(meeting.priceCents, meeting.currency)
                    : 'Free'}
                </Text>
              </View>
            </View>
          </View>

          {/* Meeting detail rows */}
          {meeting && (
            <View style={{ gap: v(6), marginBottom: showInviteesSection ? v(16) : 0 }}>
              <View style={[tw`flex-row items-center`, { gap: h(8) }]}>
                <Image
                  source={UpcomingIcon}
                  style={{ width: h(14), height: h(14) }}
                  tintColor={colors.grey}
                />
                <Text
                  style={{
                    fontFamily: 'AssociateSansRegular',
                    color: colors.grey,
                    fontSize: ms(13),
                  }}>
                  {formatTimeRange(meeting.startTime, meeting.endTime)}
                </Text>
              </View>
              <View style={[tw`flex-row items-center`, { gap: h(8) }]}>
                <Image
                  source={CalendarIcon}
                  style={{ width: h(14), height: h(14) }}
                  tintColor={colors.grey}
                />
                <Text
                  style={{
                    fontFamily: 'AssociateSansRegular',
                    color: colors.grey,
                    fontSize: ms(13),
                  }}>
                  {formatDate(meeting.startTime)}
                </Text>
              </View>
              {meeting.locationLabel && (
                <View style={[tw`flex-row items-center`, { gap: h(8) }]}>
                  <Image
                    source={LocationIcon}
                    style={{ width: h(14), height: h(14) }}
                    tintColor={colors.grey}
                  />
                  <Text
                    style={{
                      fontFamily: 'AssociateSansRegular',
                      color: colors.grey,
                      fontSize: ms(13),
                    }}>
                    {meeting.locationLabel}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Added invitees section (participant-add notifications) */}
          {addedParticipants.length > 0 && (
            <View style={{ marginBottom: v(14) }}>
              <Text
                style={{
                  fontFamily: 'AssociateSansBold',
                  color: colors.ink,
                  fontSize: ms(14),
                  marginBottom: v(8),
                }}>
                Added invitees
              </Text>
              {addedParticipants.map((p, i) => (
                <InviteePill key={p.id || i} p={p} />
              ))}
            </View>
          )}

          {/* Removed invitees section (participant-remove notifications) */}
          {removedParticipants.length > 0 && (
            <View style={{ marginBottom: v(14) }}>
              <Text
                style={{
                  fontFamily: 'AssociateSansBold',
                  color: colors.ink,
                  fontSize: ms(14),
                  marginBottom: v(8),
                }}>
                Removed invitees
              </Text>
              {removedParticipants.map((p, i) => (
                <InviteePill key={p.id || i} p={p} strikethrough />
              ))}
            </View>
          )}

          {/* Other invitees horizontal scroll */}
          {otherInvitees.length > 0 && (
            <View>
              <Text
                style={{
                  fontFamily: 'AssociateSansBold',
                  color: colors.ink,
                  fontSize: ms(14),
                  marginBottom: v(12),
                }}>
                Other invitees
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {otherInvitees.map((p, i) => (
                  <InviteeAvatar key={p.id || i} p={p} />
                ))}
              </ScrollView>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Accept / Decline buttons — invite type only */}
      {isInviteType && meeting && (
        <View
          style={[
            tw`absolute left-0 right-0 flex-row`,
            {
              bottom: 0,
              paddingHorizontal: '8%',
              paddingTop: v(12),
              paddingBottom: v(34),
              gap: h(12),
              backgroundColor: colors.pageBg,
            },
          ]}>
          <TouchableOpacity
            onPress={() => handleRespond(false)}
            activeOpacity={0.85}
            disabled={isResponding}
            style={[
              tw`flex-1 rounded-full flex-row items-center justify-center`,
              { backgroundColor: colors.field, paddingVertical: v(12) },
            ]}>
            <Image
              source={CrossIcon}
              style={{ width: h(14), height: h(14), marginRight: h(6) }}
              tintColor={colors.ink}
            />
            <Text
              style={{
                fontFamily: 'AssociateSansBold',
                color: colors.ink,
                fontSize: ms(14),
              }}>
              Decline Invite
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRespond(true)}
            activeOpacity={0.85}
            disabled={isResponding}
            style={[
              tw`flex-1 rounded-full flex-row items-center justify-center`,
              { backgroundColor: colors.green, paddingVertical: v(12) },
            ]}>
            {isResponding ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Image
                  source={CheckIcon}
                  style={{ width: h(14), height: h(14), marginRight: h(6) }}
                  tintColor={colors.white}
                />
                <Text
                  style={{
                    fontFamily: 'AssociateSansBold',
                    color: colors.white,
                    fontSize: ms(14),
                  }}>
                  Accept Invite
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ===== Shared header =====

const NotifHeader: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <View
    style={[
      tw`flex-row items-center`,
      {
        marginTop: verticalScale(55),
        paddingHorizontal: '8%',
        marginBottom: verticalScale(16),
      },
    ]}>
    <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
      <Image
        source={BackArrow}
        style={{ width: horizontalScale(24), height: horizontalScale(24) }}
        resizeMode="contain"
      />
    </TouchableOpacity>
    <View style={tw`flex-1 items-center`}>
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: moderateScale(18.75),
        }}>
        Notification details
      </Text>
    </View>
    <View style={{ width: horizontalScale(24) }} />
  </View>
);

export default AppStack_NotificationDetailScreen;
