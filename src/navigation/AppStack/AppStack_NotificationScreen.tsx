import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import {
  BackArrow,
  UpcomingIcon,
  CheckIcon,
  CrossIcon,
  RescheduleIcon,
  UserIcon,
  UserXIcon,
  NotificationsIcon,
} from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_NotificationScreen'>;

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

type NotifGroup = { label: string; items: AppNotification[] };

function groupNotifications(notifications: AppNotification[]): NotifGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  const todayItems: AppNotification[] = [];
  const weekItems: AppNotification[] = [];
  const earlierItems: AppNotification[] = [];

  notifications.forEach((n) => {
    const d = new Date(n.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) {
      todayItems.push(n);
    } else if (d >= weekAgo) {
      weekItems.push(n);
    } else {
      earlierItems.push(n);
    }
  });

  const groups: NotifGroup[] = [];
  if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
  if (weekItems.length) groups.push({ label: 'This Week', items: weekItems });
  if (earlierItems.length) groups.push({ label: 'Earlier', items: earlierItems });
  return groups;
}

function getNotifIconMeta(type: string): { icon: number; bg: string; positive: boolean } {
  switch (type) {
    case 'moment_request_created':
      return { icon: UpcomingIcon, bg: colors.greenTint, positive: true };
    case 'moment_request_accepted':
      return { icon: CheckIcon, bg: colors.greenTint, positive: true };
    case 'moment_request_rejected':
    case 'moment_request_canceled':
      return { icon: CrossIcon, bg: colors.field, positive: false };
    case 'moment_request_rescheduled':
      return { icon: RescheduleIcon, bg: colors.greenTint, positive: true };
    case 'meeting_reminder':
      return { icon: UpcomingIcon, bg: colors.greenTint, positive: true };
    default:
      if (type.includes('invit') || type.includes('added')) {
        return { icon: UserIcon, bg: colors.greenTint, positive: true };
      }
      if (type.includes('removed')) {
        return { icon: UserXIcon, bg: colors.field, positive: false };
      }
      return { icon: NotificationsIcon, bg: colors.field, positive: false };
  }
}

function formatNotifTime(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return `Today • ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AppStack_NotificationScreen: React.FC<Props> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await http.get('/users/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('fetchNotifications error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchNotifications(false); }, [fetchNotifications]);

  const handlePress = async (n: AppNotification) => {
    if (!n.isRead) {
      try {
        await http.post('/users/notifications/read', { notificationIds: [n.id] });
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        );
      } catch {}
    }
    navigation.navigate('AppStack_NotificationDetailScreen', { notificationId: n.id });
  };

  const groups = groupNotifications(notifications);

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
            Notifications
          </Text>
        </View>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <Text style={{ fontSize: moderateScale(80), marginBottom: verticalScale(8) }}>😑</Text>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(16) }]}>
            No notifications yet
          </Text>
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(40) }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}>
          {groups.map((group) => (
            <View key={group.label}>
              <Text
                style={[
                  tw`font-dm`,
                  {
                    color: colors.grey,
                    fontSize: moderateScale(13),
                    marginBottom: verticalScale(8),
                    marginTop: verticalScale(4),
                  },
                ]}>
                {group.label}
              </Text>
              {group.items.map((n) => {
                const { icon, bg, positive } = getNotifIconMeta(n.type);
                return (
                  <TouchableOpacity
                    key={n.id}
                    activeOpacity={0.7}
                    onPress={() => handlePress(n)}
                    style={[
                      tw`flex-row items-center rounded-2xl`,
                      {
                        backgroundColor: colors.card,
                        padding: horizontalScale(14),
                        marginBottom: verticalScale(8),
                      },
                    ]}>
                    {/* Icon circle */}
                    <View
                      style={[
                        tw`rounded-full items-center justify-center`,
                        {
                          width: horizontalScale(42),
                          height: horizontalScale(42),
                          backgroundColor: bg,
                          marginRight: horizontalScale(12),
                        },
                      ]}>
                      <Image
                        source={icon}
                        tintColor={positive ? colors.green : colors.grey}
                        style={{ width: horizontalScale(20), height: horizontalScale(20) }}
                        resizeMode="contain"
                      />
                    </View>

                    {/* Content */}
                    <View style={tw`flex-1`}>
                      <Text
                        numberOfLines={1}
                        style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(13.5) }]}>
                        {n.title}
                      </Text>
                      <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12) }]}>
                        {formatNotifTime(n.createdAt)}
                      </Text>
                    </View>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <View
                        style={[
                          tw`rounded-full`,
                          { width: horizontalScale(8), height: horizontalScale(8), backgroundColor: colors.green, marginLeft: horizontalScale(8) },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default AppStack_NotificationScreen;
