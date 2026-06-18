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

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Avatar } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { formatPrice } from '~/helpers/hooks';

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
  sender?: { id: string; name?: string | null; avatar?: string | null };
  participants?: Array<{ user?: { id: string; name?: string | null; avatar?: string | null } | null }>;
}

const AppStack_NotificationDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { notificationId } = route.params;

  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [meeting, setMeeting] = useState<MeetingRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get('/users/notifications');
        const all: AppNotification[] = res.data.notifications || [];
        const found = all.find((n) => n.id === notificationId) || null;
        setNotification(found);

        if (found?.data) {
          const d = typeof found.data === 'string' ? JSON.parse(found.data) : found.data;
          if (d.momentRequestId) {
            const [recRes, sentRes] = await Promise.all([
              http.get('/users/moment-requests/received').catch(() => ({ data: { requests: [] } })),
              http.get('/users/moment-requests/sent').catch(() => ({ data: { requests: [] } })),
            ]);
            const all: MeetingRequest[] = [
              ...(recRes.data.requests || []),
              ...(sentRes.data.requests || []),
            ];
            const m = all.find((r) => r.id === d.momentRequestId) || null;
            setMeeting(m);
          }
        }
      } catch (err) {
        console.error('NotifDetail load error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [notificationId]);

  const isInviteType = notification?.type === 'moment_request_created';

  const handleRespond = async (accept: boolean) => {
    if (!meeting) return;
    try {
      setIsResponding(true);
      await http.post(`/users/moment-requests/${meeting.id}/respond`, {
        status: accept ? 'confirmed' : 'rejected',
      });
      Alert.alert(accept ? 'Accepted' : 'Declined', accept ? 'Meeting confirmed.' : 'Meeting declined.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not respond to request.');
    } finally {
      setIsResponding(false);
    }
  };

  const formatTimeRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) => {
      let h = d.getHours();
      const m = d.getMinutes();
      const p = h >= 12 ? 'pm' : 'am';
      h = h % 12 || 12;
      return `${h}:${String(m).padStart(2, '0')} ${p}`;
    };
    return `${fmt(s)}-${fmt(e)}`;
  };

  const formatDate = (start: string) =>
    new Date(start).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: verticalScale(55), paddingHorizontal: '8%', marginBottom: verticalScale(16) },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
            Notification details
          </Text>
        </View>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : !notification ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(14) }]}>Notification not found</Text>
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(120) }}
          showsVerticalScrollIndicator={false}>
          {/* Main card */}
          <View
            style={[
              tw`rounded-3xl`,
              { backgroundColor: colors.card, padding: moderateScale(16), marginBottom: verticalScale(16) },
            ]}>
            {/* Sender row */}
            <View style={[tw`flex-row items-center`, { marginBottom: verticalScale(10) }]}>
              <View
                style={[
                  tw`rounded-full overflow-hidden items-center justify-center`,
                  { width: horizontalScale(46), height: horizontalScale(46), backgroundColor: colors.field, marginRight: horizontalScale(12) },
                ]}>
                {meeting?.sender?.avatar ? (
                  <Image source={{ uri: meeting.sender.avatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Image source={Avatar} style={{ width: horizontalScale(28), height: horizontalScale(28) }} />
                )}
              </View>
              <View style={tw`flex-1`}>
                <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(14.5) }]}>
                  {notification.title}
                </Text>
                <View
                  style={[
                    tw`self-start rounded-full`,
                    {
                      backgroundColor: meeting?.isPaid ? colors.ink : colors.greenTint,
                      paddingHorizontal: horizontalScale(10),
                      paddingVertical: verticalScale(3),
                      marginTop: verticalScale(4),
                    },
                  ]}>
                  <Text style={[tw`font-dm font-bold`, { color: meeting?.isPaid ? colors.white : colors.greenText, fontSize: moderateScale(11) }]}>
                    {meeting?.isPaid ? formatPrice(meeting.priceCents, meeting.currency) : 'Free'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Meeting details */}
            {meeting && (
              <View>
                <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(13) }]}>
                  🕐 {formatTimeRange(meeting.startTime, meeting.endTime)}
                </Text>
                <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(13) }]}>
                  📅 {formatDate(meeting.startTime)}
                </Text>
                {meeting.locationLabel && (
                  <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(13) }]}>
                    📍 {meeting.locationLabel}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Other invitees (for invite-type notifications) */}
          {isInviteType && meeting?.participants && meeting.participants.length > 0 && (
            <View style={{ marginBottom: verticalScale(16) }}>
              <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(15), marginBottom: verticalScale(10) }]}>
                Other invitees
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {meeting.participants.map((p, idx) => (
                  <View
                    key={idx}
                    style={[tw`items-center`, { marginRight: horizontalScale(16) }]}>
                    <View
                      style={[
                        tw`rounded-full overflow-hidden items-center justify-center`,
                        { width: horizontalScale(52), height: horizontalScale(52), backgroundColor: colors.field, marginBottom: verticalScale(6), position: 'relative' },
                      ]}>
                      {p.user?.avatar ? (
                        <Image source={{ uri: p.user.avatar }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Image source={Avatar} style={{ width: horizontalScale(30), height: horizontalScale(30) }} />
                      )}
                    </View>
                    <View
                      style={[
                        tw`absolute rounded-full items-center justify-center`,
                        {
                          bottom: verticalScale(22),
                          right: horizontalScale(2),
                          width: horizontalScale(16),
                          height: horizontalScale(16),
                          backgroundColor: '#2D7FF9',
                          borderWidth: 1.5,
                          borderColor: colors.card,
                        },
                      ]}>
                      <Text style={{ color: colors.white, fontSize: moderateScale(8), fontWeight: 'bold' }}>✓</Text>
                    </View>
                    {p.user?.name && (
                      <Text
                        numberOfLines={1}
                        style={[
                          tw`font-dm text-center`,
                          { color: colors.ink, fontSize: moderateScale(11), maxWidth: horizontalScale(60) },
                        ]}>
                        {p.user.name.split(' ')[0]}
                        {'\n'}
                        {p.user.name.split(' ').slice(1).join(' ')}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {/* Accept / Decline buttons (only for invite notifications) */}
      {isInviteType && meeting && (
        <View
          style={[
            tw`absolute left-0 right-0 flex-row`,
            {
              bottom: 0,
              paddingHorizontal: '8%',
              paddingTop: verticalScale(12),
              paddingBottom: verticalScale(30),
              gap: horizontalScale(12),
            },
          ]}>
          <TouchableOpacity
            onPress={() => handleRespond(false)}
            activeOpacity={0.85}
            disabled={isResponding}
            style={[
              tw`flex-1 rounded-full flex-row items-center justify-center`,
              { backgroundColor: colors.field, paddingVertical: verticalScale(15) },
            ]}>
            <Text style={{ fontSize: moderateScale(14), marginRight: horizontalScale(6) }}>✕</Text>
            <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(15) }]}>
              Decline Invite
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRespond(true)}
            activeOpacity={0.85}
            disabled={isResponding}
            style={[
              tw`flex-1 rounded-full flex-row items-center justify-center`,
              { backgroundColor: colors.green, paddingVertical: verticalScale(15) },
            ]}>
            {isResponding ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={{ fontSize: moderateScale(14), marginRight: horizontalScale(6), color: colors.white }}>✓</Text>
                <Text style={[tw`font-dm font-bold`, { color: colors.white, fontSize: moderateScale(15) }]}>
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

export default AppStack_NotificationDetailScreen;
