import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import Svg, { Circle, Path } from 'react-native-svg';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Avatar, UpcomingIcon, CalendarIcon, LocationIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { formatPrice } from '~/helpers/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_MeetingHistoryScreen'>;

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
  senderId: string;
  receiverId: string;
  participants?: Array<{ user?: { avatar?: string | null } | null }>;
}

const GlobeIcon = ({ size = 13, color = '#6F7780' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
    <Path d="M12 3C9.5 6.5 9.5 17.5 12 21M12 3C14.5 6.5 14.5 17.5 12 21M3.5 9h17M3.5 15h17" stroke={color} strokeWidth="1.5" />
  </Svg>
);

const AppStack_MeetingHistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contactUserId, contactName } = route.params;

  const [pastMeetings, setPastMeetings] = useState<MeetingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const [receivedRes, sentRes] = await Promise.all([
        http.get('/users/moment-requests/received').catch(() => ({ data: { requests: [] } })),
        http.get('/users/moment-requests/sent').catch(() => ({ data: { requests: [] } })),
      ]);

      const all: MeetingRequest[] = [
        ...(receivedRes.data.requests || []),
        ...(sentRes.data.requests || []),
      ];

      const deduped = Array.from(new Map(all.map((m) => [m.id, m])).values());
      const now = new Date();

      const past = deduped.filter((m) => {
        const isContactInvolved = m.senderId === contactUserId || m.receiverId === contactUserId;
        const isPast = new Date(m.endTime) < now;
        return isContactInvolved && isPast;
      });

      past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setPastMeetings(past);
    } catch (err) {
      console.error('MeetingHistory load error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setIsRefreshing(true); load(false); };

  const formatTimeRange = (startTime: string, endTime: string) => {
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

  const formatDate = (startTime: string) => {
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
                width: horizontalScale(30),
                height: horizontalScale(30),
                marginLeft: i === 0 ? 0 : -horizontalScale(8),
                borderWidth: 1.5,
                borderColor: colors.card,
                backgroundColor: colors.field,
              },
            ]}>
            {p.user?.avatar ? (
              <Image source={{ uri: p.user.avatar }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Image source={Avatar} style={{ width: horizontalScale(18), height: horizontalScale(18) }} />
            )}
          </View>
        ))}
        {extra > 0 && (
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              {
                width: horizontalScale(30),
                height: horizontalScale(30),
                marginLeft: -horizontalScale(8),
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
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
            Meeting history
          </Text>
        </View>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(40) }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.green} />}>
          {pastMeetings.length === 0 ? (
            <View style={{ paddingTop: verticalScale(60), alignItems: 'center' }}>
              <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(14) }]}>
                No past meetings with {contactName}
              </Text>
            </View>
          ) : (
            pastMeetings.map((m) => (
              <View
                key={m.id}
                style={[
                  tw`rounded-3xl`,
                  { backgroundColor: colors.card, padding: moderateScale(16), marginBottom: verticalScale(12) },
                ]}>
                <View
                  style={[
                    tw`self-start rounded-full`,
                    {
                      backgroundColor: m.isPaid ? colors.ink : colors.greenTint,
                      paddingHorizontal: horizontalScale(12),
                      paddingVertical: verticalScale(4),
                      marginBottom: verticalScale(8),
                    },
                  ]}>
                  <Text
                    style={[
                      tw`font-associate-bold`,
                      { color: m.isPaid ? colors.white : colors.greenText, fontSize: moderateScale(12) },
                    ]}>
                    {m.isPaid ? formatPrice(m.priceCents, m.currency) : 'Free'}
                  </Text>
                </View>

                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(17) }]}>
                  {m.title}
                </Text>

                <View style={{ marginTop: verticalScale(8), gap: verticalScale(4) }}>
                  {[
                    { icon: <Image source={UpcomingIcon} style={{ width: horizontalScale(13), height: horizontalScale(13) }} tintColor={colors.grey} />, label: formatTimeRange(m.startTime, m.endTime) },
                    { icon: <Image source={CalendarIcon} style={{ width: horizontalScale(13), height: horizontalScale(13) }} tintColor={colors.grey} />, label: formatDate(m.startTime) },
                    { icon: <GlobeIcon size={horizontalScale(13)} color={colors.grey} />, label: m.locationType === 'in_person' ? 'In-person' : 'Remote' },
                    ...(m.locationLabel ? [{ icon: <Image source={LocationIcon} style={{ width: horizontalScale(13), height: horizontalScale(13) }} tintColor={colors.grey} />, label: m.locationLabel }] : []),
                  ].map((row, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: horizontalScale(6) }}>
                      {row.icon}
                      <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>{row.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ marginTop: verticalScale(10) }}>
                  {renderAvatarStack(m.participants)}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AppStack_MeetingHistoryScreen;
