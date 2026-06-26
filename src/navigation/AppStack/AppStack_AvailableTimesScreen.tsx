import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BackArrow } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { Hook, HookAvailabilitySlot, formatDuration, formatPrice } from '~/helpers/hooks';
import Toast from '~/components/Toast';

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

// Convert a Date to "minutes since midnight"
function dateToMinutes(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

interface TimeSlot {
  hook: Hook;
  startMinutes: number;
  endMinutes: number;
}

const HOUR_HEIGHT = verticalScale(72);
const START_HOUR = 8; // 8am
const END_HOUR = 20;  // 8pm

const AppStack_AvailableTimesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contactUserId, contactName } = route.params;

  const [hooks, setHooks] = useState<Hook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [toast, setToast] = useState<{ message: string; subtitle?: string } | null>(null);

  const days = useMemo(() => generateDays(14), []);

  useEffect(() => {
    http
      .get(`/hooks/user/${contactUserId}`)
      .then((res) => setHooks(res.data.hooks || []))
      .catch(() => setHooks([]))
      .finally(() => setIsLoading(false));
  }, [contactUserId]);

  // For selected day, compute which hooks are available
  const slotsForDay = useMemo((): TimeSlot[] => {
    const weekday = selectedDay.getDay();
    const result: TimeSlot[] = [];
    hooks.forEach((hook) => {
      if (!hook.availabilitySlots) return;
      const slot = hook.availabilitySlots.find((s: HookAvailabilitySlot) => s.weekday === weekday && s.isAvailable && !s.isPaused);
      if (!slot) return;
      result.push({
        hook,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
      });
    });
    return result;
  }, [hooks, selectedDay]);

  const handleSlotTap = (slot: TimeSlot) => {
    setSelectedSlot((prev) => (prev?.hook.id === slot.hook.id ? null : slot));
  };

  const handleBook = async () => {
    if (!selectedSlot) return;
    const { hook, startMinutes } = selectedSlot;

    const startDate = new Date(selectedDay);
    startDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const endDate = new Date(startDate.getTime() + hook.durationMinutes * 60 * 1000);

    try {
      setIsBooking(true);
      await http.post('/users/moment-requests', {
        receiverId: contactUserId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        title: hook.title,
        locationType: hook.locationType,
        locationLabel: hook.locationLabel,
        hookId: hook.id,
      });
      setSelectedSlot(null);
      setToast({ message: 'Request sent successfully', subtitle: 'Waiting for confirmation' });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Could not send request.');
    } finally {
      setIsBooking(false);
    }
  };

  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const p = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${h12}:${String(min).padStart(2, '0')} ${p}`;
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const renderTimeGrid = () => (
    <View style={{ position: 'relative' }}>
      {/* Hour rows */}
      {hours.map((h) => (
        <View
          key={h}
          style={[
            tw`flex-row`,
            { height: HOUR_HEIGHT, borderTopWidth: 1, borderTopColor: colors.border },
          ]}>
          <View style={{ width: horizontalScale(60) }}>
            <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(11.5), paddingTop: verticalScale(4), paddingLeft: horizontalScale(4) }]}>
              {`${h % 12 || 12}:00 ${h >= 12 ? 'pm' : 'am'}`}
            </Text>
          </View>
          <View style={[tw`flex-1`, { borderLeftWidth: 1, borderLeftColor: colors.border }]} />
        </View>
      ))}

      {/* Hook slots overlaid */}
      {slotsForDay.map((slot) => {
        const topOffset = ((slot.startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
        const blockHeight = ((slot.endMinutes - slot.startMinutes) / 60) * HOUR_HEIGHT;
        const isPaid = slot.hook.isPaid;
        const isSelected = selectedSlot?.hook.id === slot.hook.id;
        const bgColor = isPaid ? '#EDE9FF' : isSelected ? colors.green : colors.greenTint;
        const textColor = isPaid ? '#7A5AF8' : isSelected ? colors.white : colors.greenText;

        return (
          <TouchableOpacity
            key={slot.hook.id}
            activeOpacity={0.8}
            onPress={() => handleSlotTap(slot)}
            style={[
              tw`absolute rounded-xl`,
              {
                top: topOffset,
                left: horizontalScale(64),
                right: horizontalScale(8),
                height: Math.max(blockHeight, verticalScale(40)),
                backgroundColor: bgColor,
                padding: horizontalScale(8),
              },
            ]}>
            <View style={tw`flex-row items-center justify-between`}>
              <Text style={[tw`font-associate-bold`, { color: textColor, fontSize: moderateScale(13) }]} numberOfLines={1}>
                {slot.hook.title}
              </Text>
              <Text style={[tw`font-associate-bold`, { color: textColor, fontSize: moderateScale(13) }]}>
                {isPaid ? formatPrice(slot.hook.priceCents, slot.hook.currency) : 'Free'}
              </Text>
            </View>
            <Text style={[tw`font-associate`, { color: textColor, fontSize: moderateScale(11.5) }]}>
              {formatMinutes(slot.startMinutes)} – {formatMinutes(slot.endMinutes)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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
          Available times with {contactName}
        </Text>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {/* Day picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(12) }}>
        {days.map((day, idx) => {
          const isSelected = day.toDateString() === selectedDay.toDateString();
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => { setSelectedDay(day); setSelectedSlot(null); }}
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

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingBottom: verticalScale(120) }}
          showsVerticalScrollIndicator={false}>
          {slotsForDay.length === 0 ? (
            <View style={{ paddingTop: verticalScale(60), alignItems: 'center' }}>
              <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(14) }]}>
                No available slots on this day
              </Text>
            </View>
          ) : (
            renderTimeGrid()
          )}
        </ScrollView>
      )}

      {/* Payment / book CTA */}
      {selectedSlot && (
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
          {selectedSlot.hook.isPaid ? (
            <View style={[tw`flex-row items-center justify-between`, { marginBottom: verticalScale(14) }]}>
              <View>
                <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(13) }]}>
                  Pay {contactName}
                </Text>
                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(24) }]}>
                  {formatPrice(selectedSlot.hook.priceCents, selectedSlot.hook.currency)}
                </Text>
              </View>
              <Text style={{ fontSize: moderateScale(20), color: colors.grey }}>›</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={handleBook}
            activeOpacity={0.85}
            disabled={isBooking}
            style={[
              tw`rounded-full items-center justify-center`,
              { backgroundColor: colors.green, paddingVertical: verticalScale(15), opacity: isBooking ? 0.6 : 1 },
            ]}>
            {isBooking ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>
                {selectedSlot.hook.isPaid ? `Book · ${formatDuration(selectedSlot.hook.durationMinutes)}` : 'Send request'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Toast message={toast?.message || ''} subtitle={toast?.subtitle} visible={!!toast} onHide={() => { setToast(null); navigation.goBack(); }} />
    </View>
  );
};

export default AppStack_AvailableTimesScreen;
