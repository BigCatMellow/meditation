import { LocalNotifications } from '@capacitor/local-notifications';

const CHANNEL_ID = 'shoulder-cook-alerts-v1';
const ALARM_SOUND = 'shoulder_alarm.wav';
const BASE_ID = 410000;
const REPEAT_MINUTES = 10;
const REPEAT_COUNT = 19;

const idsForStep = (stepIndex) =>
  Array.from({ length: REPEAT_COUNT }, (_, repeatIndex) => BASE_ID + stepIndex * 100 + repeatIndex);

async function ensureChannel() {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Shoulder cook alarms',
      description: 'High-priority reminders for pork shoulder cook steps',
      importance: 5,
      visibility: 1,
      sound: ALARM_SOUND,
      vibration: true,
      lights: true,
      lightColor: '#F59E0B',
    });
  } catch (error) {
    console.warn('Could not create notification channel', error);
  }
}

async function enable() {
  await ensureChannel();
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return { granted: false };

  let exact = 'unknown';
  try {
    const result = await LocalNotifications.checkExactNotificationSetting();
    exact = result.exact_alarm;
    if (exact !== 'granted') {
      await LocalNotifications.changeExactNotificationSetting();
    }
  } catch (error) {
    console.warn('Exact alarm setting unavailable', error);
  }

  return { granted: true, exact };
}

async function cancelStep(stepIndex) {
  const ids = idsForStep(stepIndex);
  await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
  try {
    await LocalNotifications.removeDeliveredNotificationsById({ ids });
  } catch (error) {
    console.warn('Could not clear delivered reminders', error);
  }
}

async function cancelAll() {
  try {
    await LocalNotifications.cancelAll();
  } catch (error) {
    console.warn('cancelAll failed', error);
  }
  try {
    await LocalNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.warn('removeAllDeliveredNotifications failed', error);
  }
}

async function scheduleCook(startMs, steps, completed = []) {
  await ensureChannel();
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    return { warning: 'Tap Settings → Enable to allow Android alerts.' };
  }

  await cancelAll();
  const completedSet = new Set(completed);
  const notifications = [];
  const now = Date.now();

  steps.forEach((step, stepIndex) => {
    if (completedSet.has(stepIndex)) return;
    const dueMs = startMs + Number(step[0]) * 60000;
    const firstMs = Math.max(dueMs, now + 2500);

    for (let repeatIndex = 0; repeatIndex < REPEAT_COUNT; repeatIndex++) {
      const at = new Date(firstMs + repeatIndex * REPEAT_MINUTES * 60000);
      const id = BASE_ID + stepIndex * 100 + repeatIndex;
      notifications.push({
        id,
        title: `Shoulder — ${step[2]}`,
        body: repeatIndex === 0 ? step[3] : `Still waiting for acknowledgement: ${step[3]}`,
        largeBody: step[3],
        schedule: { at, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        autoCancel: true,
        ongoing: false,
        foreground: true,
        isExactNotification: true,
        isExactMandatory: false,
        extra: { stepIndex, repeatIndex },
      });
    }
  });

  let warning = null;
  for (let i = 0; i < notifications.length; i += 40) {
    const result = await LocalNotifications.schedule({ notifications: notifications.slice(i, i + 40) });
    if (result.warning?.message) warning = result.warning.message;
  }

  return { scheduled: notifications.length, repeatMinutes: REPEAT_MINUTES, warning };
}

async function test() {
  await ensureChannel();
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return { granted: false };
  await LocalNotifications.schedule({
    notifications: [{
      id: BASE_ID - 1,
      title: 'Shoulder — Test alert',
      body: 'Android notifications are working.',
      schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
      channelId: CHANNEL_ID,
      foreground: true,
      autoCancel: true,
      isExactNotification: false,
    }],
  });
  return { granted: true };
}

window.ShoulderNative = { enable, scheduleCook, cancelStep, cancelAll, test };
window.dispatchEvent(new Event('shoulder-native-ready'));
