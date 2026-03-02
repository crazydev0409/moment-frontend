import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// NOTE: This task is ONLY called for data-only (silent) push notifications —
// ones sent without a title/body. Visible push notifications (with title+body,
// which is what our backend sends) are displayed by the OS automatically and
// do NOT invoke this callback at all.
//
// This file must be imported at the top of App.tsx before any component renders
// so that defineTask runs at module level, as required by expo-task-manager.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) {
    console.error('Background notification task error:', error);
    return;
  }

  if (!data) return;

  // Cast to the shape Expo delivers: { notification: { request: { content: { data } } } }
  const notification = (data as any).notification;
  const payload = notification?.request?.content?.data ?? (data as any);

  const eventType: string = payload?.eventType ?? '';
  console.log('📬 Silent background notification received:', eventType, payload);

  // For silent/data-only pushes, we may still want to surface a local
  // notification so the user sees it (e.g. a lightweight sync ping from
  // the server that carries just the event type and no display text).
  const silentEvents: Record<string, { title: string; body: string }> = {
    'moment.request.created': {
      title: 'New Moment Request',
      body: `${payload?.senderName ?? 'Someone'} invited you to "${payload?.title ?? 'a meeting'}"`,
    },
    'moment.request.approved': {
      title: 'Moment Request Approved',
      body: `${payload?.receiverName ?? 'Someone'} approved your moment request`,
    },
    'moment.request.rejected': {
      title: 'Moment Request Declined',
      body: 'Your moment request was declined',
    },
    'moment.request.canceled': {
      title: 'Meeting Canceled',
      body: `${payload?.canceledByName ?? 'Someone'} canceled the meeting`,
    },
  };

  const display = silentEvents[eventType];
  if (display) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: display.title,
        body: display.body,
        data: payload,
        sound: true,
        ...(eventType === 'moment.request.created'
          ? { categoryIdentifier: 'MOMENT_REQUEST' }
          : {}),
      },
      trigger: null, // show immediately
    });
  }
});
