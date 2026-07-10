import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { Hook, HookAvailabilitySlot } from '~/helpers/hooks';
import {
  CalendarBusyEvent,
  MinuteRange,
  clipToDayMinutes,
  mergeMinuteRanges,
  subtractMinuteRanges,
} from '~/helpers/calendarAvailability';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_AvailableTimesScreen'>;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate next 14 days starting from today
function generateDays(count = 14) {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const HOUR_HEIGHT = verticalScale(60);
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

const AppStack_AvailableTimesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contactId, contactUserId, contactName } = route.params;

  const [hooks, setHooks] = useState<Hook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Just the contact's own busy time — this screen is a plain "when are
  // they free" reference, not a booking flow (that's Send Catch, which
  // already correctly checks both sides' schedules). No point folding the
  // viewer's own calendar into what's meant to be a quick glance at
  // someone else's availability.
  const [ownerBusyEvents, setOwnerBusyEvents] = useState<CalendarBusyEvent[]>([]);
  const [loadingBusyEvents, setLoadingBusyEvents] = useState(true);

  const days = useMemo(() => generateDays(14), []);

  useEffect(() => {
    http
      .get(`/hooks/user/${contactUserId}`)
      .then((res) => setHooks(res.data.hooks || []))
      .catch(() => setHooks([]))
      .finally(() => setIsLoading(false));

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    end.setHours(23, 59, 59, 999);

    setLoadingBusyEvents(true);
    http
      .get(`/users/${contactUserId}/calendar-events`, { params: { start: start.toISOString(), end: end.toISOString() } })
      .then((res) => setOwnerBusyEvents(res.data.events || []))
      .catch(() => setOwnerBusyEvents([]))
      .finally(() => setLoadingBusyEvents(false));
  }, [contactUserId]);

  // Plain "when are they free" view — merges every hook's published window
  // for the day into one set of available bands (no per-hook titles/prices,
  // no individual bookable slots; that level of detail belongs to the
  // actual booking flow, not a glance-and-go availability reference), then
  // subtracts their existing approved commitments so a band that's
  // technically published but already booked doesn't show as free.
  const availableBands = useMemo((): MinuteRange[] => {
    const weekday = selectedDay.getDay();
    const windows: MinuteRange[] = [];
    hooks.forEach((hook) => {
      (hook.availabilitySlots || []).forEach((s: HookAvailabilitySlot) => {
        if (s.weekday === weekday && s.isAvailable && !s.isPaused) {
          windows.push({ start: s.startMinutes, end: s.endMinutes });
        }
      });
    });
    const merged = mergeMinuteRanges(windows);

    const busy: MinuteRange[] = [];
    for (const event of ownerBusyEvents) {
      if (event.sourceType === 'internal' && event.status !== 'approved') continue;
      const clipped = clipToDayMinutes(event, selectedDay);
      if (clipped) busy.push({ start: clipped.startMinutes, end: clipped.endMinutes });
    }
    return subtractMinuteRanges(merged, busy);
  }, [hooks, selectedDay, ownerBusyEvents]);

  // Crop the grid to when this contact is ever actually available (across
  // any weekday), with a little padding — so the screen shows their real
  // schedule at a glance instead of scrolling through dead midnight hours.
  const [gridStartHour, gridEndHour] = useMemo(() => {
    let minMinutes = Infinity;
    let maxMinutes = -Infinity;
    hooks.forEach((hook) => {
      (hook.availabilitySlots || []).forEach((s: HookAvailabilitySlot) => {
        if (!s.isAvailable || s.isPaused) return;
        minMinutes = Math.min(minMinutes, s.startMinutes);
        maxMinutes = Math.max(maxMinutes, s.endMinutes);
      });
    });
    if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) {
      return [DEFAULT_START_HOUR, DEFAULT_END_HOUR];
    }
    const start = Math.max(0, Math.floor(minMinutes / 60) - 1);
    const end = Math.min(24, Math.ceil(maxMinutes / 60) + 1);
    return [start, end];
  }, [hooks]);

  const hours = Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i);

  const sendCatch = () => {
    const y = selectedDay.getFullYear();
    const m = String(selectedDay.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDay.getDate()).padStart(2, '0');
    navigation.navigate('AppStack_SendCatchScreen', {
      mode: 'one',
      initialDate: `${y}-${m}-${d}`,
      initialContact: {
        id: contactId,
        displayName: contactName,
        contactUser: { id: contactUserId, name: contactName },
      },
    });
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: verticalScale(55), paddingHorizontal: '8%', marginBottom: verticalScale(18) },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <Text
          style={[
            tw`flex-1 font-associate-bold text-center`,
            { color: colors.ink, fontSize: moderateScale(17), marginHorizontal: horizontalScale(8) },
          ]}
          numberOfLines={1}>
          {contactName}'s availability
        </Text>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {/* Day picker — fixed height so it hugs the pills instead of eating
          into the grid's flex space below it. */}
      <ScrollView
        horizontal
        style={{ flexGrow: 0, flexShrink: 0, height: horizontalScale(66) + verticalScale(20) }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(12) }}>
        {days.map((day, idx) => {
          const isSelected = day.toDateString() === selectedDay.toDateString();
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => setSelectedDay(day)}
              style={[
                tw`items-center rounded-full`,
                {
                  width: horizontalScale(52),
                  height: horizontalScale(66),
                  marginRight: horizontalScale(6),
                  backgroundColor: isSelected ? colors.ink : colors.card,
                  justifyContent: 'center',
                },
              ]}>
              <Text
                style={[
                  tw`font-associate`,
                  {
                    color: isSelected ? colors.white : colors.grey,
                    fontSize: moderateScale(12),
                    marginBottom: verticalScale(2),
                  },
                ]}>
                {DAY_NAMES[day.getDay()]}
              </Text>
              <Text
                style={[
                  tw`font-associate-bold`,
                  { color: isSelected ? colors.white : isToday ? colors.green : colors.ink, fontSize: moderateScale(18) },
                ]}>
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Day grid — fills the rest of the screen below the date row */}
      <View style={tw`flex-1`}>
        {isLoading || loadingBusyEvents ? (
          <View style={tw`flex-1 items-center justify-center`}>
            <ActivityIndicator size="large" color={colors.green} />
          </View>
        ) : (
          <ScrollView
            style={tw`flex-1`}
            contentContainerStyle={{ paddingBottom: verticalScale(24) }}
            showsVerticalScrollIndicator={false}>
            {availableBands.length === 0 ? (
              <View style={{ paddingTop: verticalScale(80), alignItems: 'center' }}>
                <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(14) }]}>
                  Not available on this day
                </Text>
              </View>
            ) : (
              <View style={{ position: 'relative' }}>
                {hours.map((h) => (
                  <View
                    key={h}
                    style={[
                      tw`flex-row`,
                      { height: HOUR_HEIGHT, borderTopWidth: 1, borderTopColor: colors.border },
                    ]}>
                    <View style={{ width: horizontalScale(56) }}>
                      <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(11), paddingTop: verticalScale(4), paddingLeft: horizontalScale(4) }]}>
                        {`${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`}
                      </Text>
                    </View>
                    <View style={[tw`flex-1`, { borderLeftWidth: 1, borderLeftColor: colors.border }]} />
                  </View>
                ))}

                {/* Available bands — plain highlight, no titles/prices, just
                    "free" vs not, at a glance. */}
                {availableBands.map((band, i) => {
                  const top = ((band.start - gridStartHour * 60) / 60) * HOUR_HEIGHT;
                  const height = ((band.end - band.start) / 60) * HOUR_HEIGHT;
                  return (
                    <View
                      key={i}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top,
                        left: horizontalScale(56),
                        right: horizontalScale(8),
                        height,
                        backgroundColor: colors.greenTint,
                        borderRadius: horizontalScale(8),
                        borderWidth: 1,
                        borderColor: colors.green,
                      }}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Send Catch CTA — actual booking (with both sides' schedules,
          hook selection, pricing, etc.) happens in the existing Send Catch
          flow, not duplicated here. */}
      <View
        style={[
          tw`absolute left-0 right-0`,
          {
            bottom: 0,
            backgroundColor: colors.card,
            paddingHorizontal: '8%',
            paddingTop: verticalScale(14),
            paddingBottom: verticalScale(32),
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        ]}>
        <TouchableOpacity
          onPress={sendCatch}
          activeOpacity={0.85}
          style={[
            tw`rounded-full items-center justify-center`,
            { backgroundColor: colors.green, paddingVertical: verticalScale(15) },
          ]}>
          <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>
            Send a Catch
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AppStack_AvailableTimesScreen;
