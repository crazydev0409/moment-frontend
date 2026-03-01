import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { http } from '~/helpers/http';
import { getDeviceInfo } from './deviceService';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register notification categories for interactive notifications
export async function registerNotificationCategories() {
  // Category for moment requests (Accept/Reject)
  await Notifications.setNotificationCategoryAsync('MOMENT_REQUEST', [
    {
      identifier: 'accept',
      buttonTitle: 'Accept',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: 'reject',
      buttonTitle: 'Reject',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);
}

// Request notification permissions (call this on app initialization)
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Check if running in Expo Go (limited push notification support)
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.warn('⚠️ Running in Expo Go: Push notifications have limited support.');
      console.warn('   For full push notification support, use a development build.');
      console.warn('   Local notifications will still work for testing.');
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permission not granted');
      return false;
    }

    console.log('✅ Notification permission granted');

    // Register categories after permission is granted
    await registerNotificationCategories();
    console.log('📱 Notification categories registered');

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Get the Expo push token for this device — must be called after permissions are granted
// and after the user is authenticated (push token registration requires a project ID)
export async function registerPushToken(): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Cannot get push token: notification permission not granted');
      return null;
    }

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants.expoConfig as any)?.projectId ||
      (Constants.manifest as any)?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('Cannot get push token: EAS projectId not found in app config');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('📱 Expo push token registered:', tokenData.data);
    return tokenData.data;
  } catch (error: any) {
    // Physical device required — emulators/simulators cannot receive push notifications
    console.warn('Could not register push token (requires physical device):', error.message);
    return null;
  }
}

// Helper function to navigate to DateDetailScreen with meeting date
function navigateToMeetingDate(data: any) {
  try {
    // Import navigation ref dynamically to avoid circular dependencies
    import('../../src/index').then((module) => {
      const navigationRef = (module as any).navigationRef;
      if (!navigationRef || !navigationRef.isReady()) {
        console.log('Navigation not ready, cannot navigate');
        return;
      }

      // Extract date from startTime if available
      let dateParam: string;
      if (data.startTime) {
        const meetingDate = new Date(data.startTime);
        const year = meetingDate.getFullYear();
        const month = String(meetingDate.getMonth() + 1).padStart(2, '0');
        const day = String(meetingDate.getDate()).padStart(2, '0');
        dateParam = `${year}-${month}-${day}`;
      } else {
        // Fallback to today's date
        const today = new Date();
        dateParam = today.toISOString().split('T')[0];
      }

      // Navigate to DateDetailScreen within AppStack
      // Use CommonActions to navigate to nested screen
      const { CommonActions } = require('@react-navigation/native');
      navigationRef.dispatch(
        CommonActions.navigate({
          name: 'AppStack',
          params: {
            screen: 'AppStack_DateDetailScreen',
            params: {
              date: dateParam,
              momentRequestId: data.momentRequestId
            }
          }
        })
      );
    });
  } catch (error) {
    console.error('Error navigating to meeting date:', error);
  }
}

// Handle notification responses (when user taps accept/reject or close/next)
export function setupNotificationResponseHandler(
  onAccept: (requestId: string) => void,
  onReject: (requestId: string) => void
) {
  Notifications.addNotificationResponseReceivedListener((response) => {
    const { notification } = response;
    const data = notification.request.content.data as any;
    const actionIdentifier = response.actionIdentifier;
    const eventType = data.eventType;



    // Handle moment request created notifications (with accept/reject buttons)
    if (eventType === 'moment.request.created') {
      const requestId = data.momentRequestId;

      if (actionIdentifier === 'accept') {
        console.log('✅ Accept button tapped for request:', requestId);
        handleAcceptRequest(requestId, onAccept);
      } else if (actionIdentifier === 'reject') {
        console.log('❌ Reject button tapped for request:', requestId);
        handleRejectRequest(requestId, onReject);
      } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        // User tapped the notification itself (not a button)
        // Navigate to DateDetailScreen with momentRequestId to auto-open modal
        console.log('📬 Moment request notification tapped:', requestId);
        navigateToMeetingDate({
          ...data,
          momentRequestId: requestId,
          shouldOpenModal: true // Flag to indicate modal should open
        });
      }
    }
    // Handle moment request approved notifications
    else if (eventType === 'moment.request.approved') {
      console.log('✅ Moment request approved notification tapped:', data.momentRequestId);
      navigateToMeetingDate(data);
      // Trigger refresh - app will refresh when navigated
    }
    // Handle moment request rejected notifications
    else if (eventType === 'moment.request.rejected') {
      console.log('❌ Moment request rejected notification tapped:', data.momentRequestId);
      navigateToMeetingDate(data);
      // Trigger refresh - app will refresh when navigated
    }
    // Handle moment request canceled notifications
    else if (eventType === 'moment.request.canceled') {
      console.log('🚫 Moment request canceled notification tapped:', data.momentRequestId);
      navigateToMeetingDate(data);
      // Trigger refresh - app will refresh when navigated
    }
    // Handle moment updated notifications
    else if (eventType === 'moment.updated') {
      console.log('🔄 Moment updated notification tapped:', data.momentId);
      navigateToMeetingDate(data);
      // Trigger refresh - app will refresh when navigated
    }
    // Handle moment deleted notifications
    else if (eventType === 'moment.deleted') {
      console.log('🗑️ Moment deleted notification tapped:', data.momentId);
      navigateToMeetingDate(data);
      // Trigger refresh - app will refresh when navigated
    }
    // Handle meeting reminder notifications
    else if (eventType === 'meeting.reminder') {
      console.log('⏰ Meeting reminder notification tapped:', data.momentRequestId);
      navigateToMeetingDate(data);
      // Trigger refresh - app will refresh when navigated
    }
  });
}

// Handle accept action
async function handleAcceptRequest(requestId: string, onAccept: (requestId: string) => void) {
  try {
    await http.post(`/users/moment-requests/${requestId}/respond`, {
      approved: true,
    });
    console.log('✅ Moment request accepted via notification:', requestId);

    // Trigger refresh by sending a silent local notification
    // This will be caught by notification listeners in DateDetailScreen and HomePage
    // to refresh the receiver's screen immediately
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '',
          body: '',
          data: {
            eventType: 'moment.request.approved',
            momentRequestId: requestId,
            localRefresh: true
          },
          sound: false,
        },
        trigger: null,
      });
    } catch (err) {
      // Ignore notification scheduling errors
    }

    onAccept(requestId);
  } catch (error: any) {
    console.error('Error accepting moment request:', error);
    alert(error.response?.data?.error || 'Failed to accept request');
  }
}

// Handle reject action
async function handleRejectRequest(requestId: string, onReject: (requestId: string) => void) {
  try {
    await http.post(`/users/moment-requests/${requestId}/respond`, {
      approved: false,
    });
    console.log('❌ Moment request rejected via notification:', requestId);

    // Trigger refresh by sending a silent local notification
    // This will be caught by notification listeners in DateDetailScreen and HomePage
    // to refresh the receiver's screen immediately
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '',
          body: '',
          data: {
            eventType: 'moment.request.rejected',
            momentRequestId: requestId,
            localRefresh: true
          },
          sound: false,
        },
        trigger: null,
      });
    } catch (err) {
      // Ignore notification scheduling errors
    }

    onReject(requestId);
  } catch (error: any) {
    console.error('Error rejecting moment request:', error);
    alert(error.response?.data?.error || 'Failed to reject request');
  }
}

// Setup notification received handler (when app is in foreground)
export function setupNotificationReceivedHandler(
  onNotificationReceived: (notification: Notifications.Notification) => void
) {
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received in foreground:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });
    onNotificationReceived(notification);
  });
}

// Schedule a reminder notification 30 minutes before a confirmed meeting
export async function scheduleMeetingReminder(meeting: {
  id: string;
  title?: string;
  notes?: string;
  startTime: string;
  endTime: string;
  sender?: { id: string; name?: string; phoneNumber?: string };
  receiver?: { id: string; name?: string; phoneNumber?: string };
  senderId: string;
  receiverId: string;
}, currentUserId: string) {
  try {
    // Check if permission is granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Cannot schedule reminder: permission not granted');
      return;
    }

    const startTime = new Date(meeting.startTime);
    const now = new Date();
    
    // Calculate time 30 minutes before meeting
    const reminderTime = new Date(startTime.getTime() - 30 * 60 * 1000);
    
    // Only schedule if reminder time is in the future
    if (reminderTime <= now) {
      console.log('Meeting is too soon, not scheduling reminder');
      return;
    }

    // Determine the other person's name
    const isCurrentUserSender = meeting.senderId === currentUserId;
    const otherPerson = isCurrentUserSender 
      ? (meeting.receiver?.name || meeting.receiver?.phoneNumber || 'Someone')
      : (meeting.sender?.name || meeting.sender?.phoneNumber || 'Someone');

    const meetingTitle = meeting.title || meeting.notes || 'Meeting';

    // Format time
    const timeString = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Calculate seconds until reminder
    const secondsUntilReminder = Math.floor((reminderTime.getTime() - now.getTime()) / 1000);

    // Schedule the reminder
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Meeting Reminder',
        body: `Your meeting "${meetingTitle}" with ${otherPerson} starts at ${timeString}`,
        data: {
          eventType: 'meeting.reminder',
          momentRequestId: meeting.id,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilReminder,
        repeats: false,
      },
      identifier: `meeting-reminder-${meeting.id}`,
    });

    console.log(`✅ Scheduled reminder for meeting ${meeting.id} at ${reminderTime.toLocaleString()}`);
  } catch (error: any) {
    console.error('Failed to schedule meeting reminder:', error.message);
  }
}

// Cancel a scheduled meeting reminder
export async function cancelMeetingReminder(meetingId: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`meeting-reminder-${meetingId}`);
    console.log(`🚫 Canceled reminder for meeting ${meetingId}`);
  } catch (error: any) {
    console.error('Failed to cancel meeting reminder:', error.message);
  }
}

// Schedule reminders for all upcoming confirmed meetings
export async function scheduleAllMeetingReminders(currentUserId: string) {
  try {
    // Check if permission is granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Cannot schedule reminders: permission not granted');
      return;
    }

    // Fetch all confirmed meetings (both sent and received)
    const [receivedRes, sentRes] = await Promise.all([
      http.get('/users/moment-requests/received'),
      http.get('/users/moment-requests/sent'),
    ]);

    const allMeetings = [
      ...(receivedRes.data.requests || []),
      ...(sentRes.data.requests || []),
    ];

    // Filter for approved meetings in the future
    const now = new Date();
    const upcomingConfirmedMeetings = allMeetings.filter((meeting: any) => {
      const meetingStart = new Date(meeting.startTime);
      return meeting.status === 'approved' && meetingStart > now;
    });

    if (upcomingConfirmedMeetings.length === 0) {
      console.log('No upcoming confirmed meetings to schedule reminders for');
      return;
    }

    console.log(`📅 Scheduling reminders for ${upcomingConfirmedMeetings.length} upcoming meeting(s)...`);

    // Schedule reminder for each meeting
    for (const meeting of upcomingConfirmedMeetings) {
      await scheduleMeetingReminder(meeting, currentUserId);
    }

    console.log(`✅ Scheduled ${upcomingConfirmedMeetings.length} meeting reminder(s)`);
  } catch (error: any) {
    console.error('Failed to schedule meeting reminders:', error.message);
  }
}

// Fetch and display pending moment requests as notifications
export async function showPendingMomentRequestNotifications() {
  try {
    // Check if permission is granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Cannot show notifications: permission not granted');
      return;
    }

    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants.expoConfig as any)?.projectId ||
      (Constants.manifest as any)?.extra?.eas?.projectId ||
      (Constants.manifest2 as any)?.extra?.eas?.projectId;

    if (!projectId) {
      console.log('Cannot show notifications: projectId not found');
      return;
    }

    // Fetch pending moment requests from backend
    const response = await http.get('/users/moment-requests/pending');
    const requests = response.data.requests || [];

    if (requests.length === 0) {
      console.log('No pending moment requests to display');
      return;
    }

    console.log(`📬 Found ${requests.length} pending moment request(s), displaying notifications...`);

    // Display each pending request as a notification
    for (const request of requests) {
      const senderName = request.sender?.name || request.sender?.phoneNumber || 'Someone';
      const title = request.title || request.notes || 'Meeting Request';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Moment Request',
          body: `${senderName} invited you to "${title}"`,
          data: {
            eventType: 'moment.request.created',
            momentRequestId: request.id,
            senderName: senderName,
            title: title,
            startTime: request.startTime,
            endTime: request.endTime,
            categoryId: 'MOMENT_REQUEST',
            actions: [
              { action: 'accept', title: 'Accept', requestId: request.id },
              { action: 'reject', title: 'Reject', requestId: request.id }
            ]
          },
          sound: true,
          categoryIdentifier: 'MOMENT_REQUEST', // This will show Accept and Reject buttons
        },
        trigger: null, // Show immediately
      });
    }

    console.log(`✅ Displayed ${requests.length} pending moment request notification(s)`);
  } catch (error: any) {
    console.error('Failed to show pending moment request notifications:', error.message);
    // Don't throw - this is a background operation that shouldn't block app initialization
  }
}

