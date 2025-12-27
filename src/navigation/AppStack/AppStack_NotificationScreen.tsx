import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { AppStackParamList } from '.';
import tw from '~/tailwindcss';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_NotificationScreen'>;

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

const AppStack_NotificationScreen: React.FC<Props> = ({ navigation }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await http.get('/users/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await http.post('/users/notifications/read', { notificationIds });
      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notificationIds.includes(notif.id) ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (isMarkingAllRead) return;

    try {
      setIsMarkingAllRead(true);
      await http.post('/users/notifications/read-all');
      setNotifications(prev => prev.map(notif => ({ ...notif, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      await markAsRead([notification.id]);
    }

    // Handle navigation based on notification type
    if (notification.data) {
      const data = typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data;
      const eventType = data.eventType || notification.type;

      // For moment request created, navigate to DateDetailScreen with momentRequestId
      if (eventType === 'moment.request.created' && data.momentRequestId) {
        // Extract date from startTime if available
        let dateParam: string;
        if (data.startTime) {
          const meetingDate = new Date(data.startTime);
          const year = meetingDate.getFullYear();
          const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
          const day = String(meetingDate.getDate()).padStart(2, '0');
          dateParam = `${year}-${month}-${day}`;
        } else {
          dateParam = new Date().toISOString().split('T')[0];
        }

        // Navigate to date detail screen with momentRequestId to auto-open modal
        navigation.navigate('AppStack_DateDetailScreen', {
          date: dateParam,
          momentRequestId: data.momentRequestId
        });
        console.log('📬 Navigating to DateDetailScreen with momentRequestId:', data.momentRequestId);
      } else if (data.momentRequestId) {
        // For other moment request events, also navigate but modal may not open
        let dateParam: string;
        if (data.startTime) {
          const meetingDate = new Date(data.startTime);
          const year = meetingDate.getFullYear();
          const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
          const day = String(meetingDate.getDate()).padStart(2, '0');
          dateParam = `${year}-${month}-${day}`;
        } else {
          dateParam = new Date().toISOString().split('T')[0];
        }

        navigation.navigate('AppStack_DateDetailScreen', {
          date: dateParam,
          momentRequestId: data.momentRequestId
        });
      }
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'moment_request_created':
        return '📅';
      case 'moment_request_accepted':
        return '✅';
      case 'moment_request_rejected':
        return '❌';
      case 'moment_request_canceled':
        return '🚫';
      case 'moment_request_rescheduled':
        return '🔄';
      default:
        return '🔔';
    }
  };

  return (
    <View style={tw`flex-1 bg-white`}>
      {/* Header */}
      <View style={[tw`border-b border-gray-200`, { marginTop: verticalScale(45), paddingBottom: verticalScale(15), paddingHorizontal: '4%' }]}>
        <View style={tw`flex-row justify-between items-center`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={[tw`items-center justify-center`, { width: horizontalScale(37.5), height: horizontalScale(37.5) }]}
          >
            <Text style={[tw``, { fontSize: moderateScale(22.5) }]}>←</Text>
          </TouchableOpacity>
          <Text style={[tw`text-black font-bold font-dm flex-1 text-center`, { fontSize: moderateScale(18.75) }]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              activeOpacity={0.7}
              disabled={isMarkingAllRead}
            >
              {isMarkingAllRead ? (
                <ActivityIndicator size="small" color="#A3CB31" />
              ) : (
                <Text style={[tw`text-[#A3CB31] font-dm`, { fontSize: moderateScale(13) }]}>Mark all read</Text>
              )}
            </TouchableOpacity>
          )}
          {unreadCount === 0 && <View style={{ width: horizontalScale(37.5) }} />}
        </View>
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color="#A3CB31" />
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingBottom: verticalScale(22.5) }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#A3CB31"
            />
          }
        >
          {notifications.length === 0 ? (
            <View style={[tw`flex-1 items-center justify-center`, { paddingVertical: verticalScale(75) }]}>
              <Text style={{ fontSize: moderateScale(56), marginBottom: verticalScale(15) }}>🔔</Text>
              <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(15) }]}>No notifications yet</Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[tw`flex-row items-start border-b border-gray-100 ${!notification.isRead ? 'bg-[#A3CB31]/5' : ''
                  }`, { paddingHorizontal: horizontalScale(22.5), paddingVertical: verticalScale(15) }]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(notification)}
              >
                {/* Icon */}
                <View style={[tw`rounded-full bg-gray-200 items-center justify-center`, { width: horizontalScale(45), height: horizontalScale(45), marginRight: horizontalScale(15) }]}>
                  <Text style={{ fontSize: moderateScale(22.5) }}>{getNotificationIcon(notification.type)}</Text>
                </View>

                {/* Content */}
                <View style={tw`flex-1`}>
                  <View style={[tw`flex-row items-start justify-between`, { marginBottom: verticalScale(3.75) }]}>
                    <Text style={[tw`text-black font-bold font-dm flex-1`, { fontSize: moderateScale(13), paddingRight: horizontalScale(7.5) }]}>
                      {notification.title}
                    </Text>
                    {!notification.isRead && (
                      <View style={[tw`rounded-full bg-[#A3CB31]`, { width: horizontalScale(7.5), height: horizontalScale(7.5), marginTop: verticalScale(3.75) }]} />
                    )}
                  </View>
                  <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(13), marginBottom: verticalScale(7.5) }]}>
                    {notification.body}
                  </Text>
                  <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11) }]}>
                    {formatTime(notification.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AppStack_NotificationScreen;

