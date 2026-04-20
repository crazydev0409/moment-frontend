import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Background } from '~/lib/images';
import { http } from '~/helpers/http';
import {
  AvailabilitySchedule,
  AvailabilitySlot,
  DEFAULT_AVAILABILITY_SCHEDULE,
  minutesToLabel,
} from '~/helpers/calendarAvailability';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_AvailabilityScreen'>;

type PickerTarget = {
  weekday: number;
  index: number;
  field: 'startMinutes' | 'endMinutes';
};

const weekdayLabels = [
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
  { key: 0, label: 'Sunday' },
];

const roundToHalfHour = (date: Date) => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / 30) * 30;
  rounded.setMinutes(roundedMinutes === 60 ? 0 : roundedMinutes, 0, 0);
  if (roundedMinutes === 60) {
    rounded.setHours(rounded.getHours() + 1);
  }
  return rounded.getHours() * 60 + rounded.getMinutes();
};

const sortSlots = (slots: AvailabilitySlot[]) =>
  [...slots].sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes);

const AppStack_AvailabilityScreen: React.FC<Props> = ({ navigation }) => {
  const [schedule, setSchedule] = useState<AvailabilitySchedule>(DEFAULT_AVAILABILITY_SCHEDULE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const groupedSlots = useMemo(() => {
    const map = new Map<number, AvailabilitySlot[]>();
    weekdayLabels.forEach((day) => map.set(day.key, []));
    schedule.slots.forEach((slot) => {
      const current = map.get(slot.weekday) || [];
      current.push(slot);
      map.set(slot.weekday, current);
    });
    return map;
  }, [schedule.slots]);

  const loadSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await http.get('/users/availability');
      const fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setSchedule({
        timezone: response.data.timezone || fallbackTimezone,
        slots: sortSlots(response.data.slots || DEFAULT_AVAILABILITY_SCHEDULE.slots),
      });
    } catch (error) {
      console.error('Error loading availability schedule:', error);
      setSchedule({
        ...DEFAULT_AVAILABILITY_SCHEDULE,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      Alert.alert('Error', 'Failed to load availability schedule.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const updateSlot = (weekday: number, index: number, nextSlot: AvailabilitySlot) => {
    const daySlots = groupedSlots.get(weekday) || [];
    const updatedDaySlots = [...daySlots];
    updatedDaySlots[index] = nextSlot;

    const otherSlots = schedule.slots.filter((slot) => slot.weekday !== weekday);
    setSchedule((previous) => ({
      ...previous,
      slots: sortSlots([...otherSlots, ...updatedDaySlots]),
    }));
  };

  const handleAddRange = (weekday: number) => {
    const daySlots = groupedSlots.get(weekday) || [];
    const lastSlot = daySlots[daySlots.length - 1];
    const startMinutes = lastSlot ? Math.min(lastSlot.endMinutes + 30, 22 * 60) : 9 * 60;
    const endMinutes = Math.min(startMinutes + 60, 24 * 60);

    setSchedule((previous) => ({
      ...previous,
      slots: sortSlots([
        ...previous.slots,
        {
          weekday,
          startMinutes,
          endMinutes,
        },
      ]),
    }));
  };

  const handleRemoveRange = (weekday: number, index: number) => {
    const daySlots = groupedSlots.get(weekday) || [];
    const updatedDaySlots = daySlots.filter((_, currentIndex) => currentIndex !== index);
    const otherSlots = schedule.slots.filter((slot) => slot.weekday !== weekday);

    setSchedule((previous) => ({
      ...previous,
      slots: sortSlots([...otherSlots, ...updatedDaySlots]),
    }));
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate || !pickerTarget) {
      setPickerTarget(null);
      return;
    }

    const daySlots = groupedSlots.get(pickerTarget.weekday) || [];
    const currentSlot = daySlots[pickerTarget.index];
    if (!currentSlot) {
      setPickerTarget(null);
      return;
    }

    const roundedMinutes = roundToHalfHour(selectedDate);
    const nextSlot =
      pickerTarget.field === 'startMinutes'
        ? {
            ...currentSlot,
            startMinutes: Math.min(roundedMinutes, currentSlot.endMinutes - 30),
          }
        : {
            ...currentSlot,
            endMinutes: Math.max(roundedMinutes, currentSlot.startMinutes + 30),
          };

    updateSlot(pickerTarget.weekday, pickerTarget.index, nextSlot);
    setPickerTarget(null);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = {
        timezone: schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        slots: sortSlots(schedule.slots),
      };
      await http.put('/users/availability', payload);
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving availability schedule:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save availability schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentPickerDate = useMemo(() => {
    if (!pickerTarget) {
      return new Date();
    }

    const slot = (groupedSlots.get(pickerTarget.weekday) || [])[pickerTarget.index];
    const value = pickerTarget.field === 'startMinutes' ? slot?.startMinutes : slot?.endMinutes;

    const date = new Date();
    if (value !== undefined) {
      date.setHours(Math.floor(value / 60), value % 60, 0, 0);
    }
    return date;
  }, [groupedSlots, pickerTarget]);

  return (
    <View style={tw`flex-1 bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      <View
        style={[
          tw`flex-row items-center`,
          {
            marginTop: verticalScale(55),
            marginBottom: verticalScale(15),
            paddingHorizontal: '8%',
          },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image
            source={BackArrow}
            style={{ width: horizontalScale(24), height: horizontalScale(24) }}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-dm font-bold text-black`, { fontSize: moderateScale(18.75) }]}>
            Availability
          </Text>
          <Text
            style={[
              tw`font-dm text-grey`,
              { fontSize: moderateScale(11.25), marginTop: verticalScale(3.75) },
            ]}>
            {schedule.timezone}
          </Text>
        </View>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color="#A3CB31" />
        </View>
      ) : (
        <>
          <ScrollView
            style={tw`flex-1`}
            contentContainerStyle={{
              paddingHorizontal: '8%',
              paddingBottom: verticalScale(130),
            }}
            showsVerticalScrollIndicator={false}>
            <Text
              style={[
                tw`font-dm text-grey`,
                { fontSize: moderateScale(12.5), marginBottom: verticalScale(15) },
              ]}>
              Set the hours you normally accept meetings. These hours are used across booking and
              availability views.
            </Text>

            {weekdayLabels.map((day) => {
              const daySlots = groupedSlots.get(day.key) || [];
              return (
                <View
                  key={day.key}
                  style={[
                    tw`bg-white rounded-3xl`,
                    {
                      padding: moderateScale(15),
                      marginBottom: verticalScale(12),
                    },
                  ]}>
                  <View style={tw`flex-row items-center justify-between`}>
                    <Text
                      style={[tw`font-dm font-bold text-black`, { fontSize: moderateScale(15) }]}>
                      {day.label}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleAddRange(day.key)}
                      activeOpacity={0.7}
                      style={[
                        tw`bg-[#A3CB31] rounded-full items-center justify-center`,
                        {
                          width: horizontalScale(34),
                          height: horizontalScale(34),
                        },
                      ]}>
                      <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(20) }]}>
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {daySlots.length > 0 ? (
                    daySlots.map((slot, index) => (
                      <View
                        key={`${day.key}-${index}`}
                        style={[
                          tw`flex-row items-center`,
                          {
                            marginTop: verticalScale(12),
                            gap: horizontalScale(10),
                          },
                        ]}>
                        <TouchableOpacity
                          onPress={() =>
                            setPickerTarget({
                              weekday: day.key,
                              index,
                              field: 'startMinutes',
                            })
                          }
                          activeOpacity={0.7}
                          style={[
                            tw`flex-1 bg-[#F5F5F5] rounded-2xl`,
                            {
                              paddingVertical: verticalScale(11),
                              paddingHorizontal: horizontalScale(14),
                            },
                          ]}>
                          <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(13) }]}>
                            {minutesToLabel(slot.startMinutes)}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(13) }]}>
                          to
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            setPickerTarget({
                              weekday: day.key,
                              index,
                              field: 'endMinutes',
                            })
                          }
                          activeOpacity={0.7}
                          style={[
                            tw`flex-1 bg-[#F5F5F5] rounded-2xl`,
                            {
                              paddingVertical: verticalScale(11),
                              paddingHorizontal: horizontalScale(14),
                            },
                          ]}>
                          <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(13) }]}>
                            {minutesToLabel(slot.endMinutes)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRemoveRange(day.key, index)}
                          activeOpacity={0.7}
                          style={[
                            tw`items-center justify-center bg-[#F5F5F5] rounded-2xl`,
                            {
                              width: horizontalScale(42),
                              height: horizontalScale(42),
                            },
                          ]}>
                          <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(18) }]}>
                            ×
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <Text
                      style={[
                        tw`font-dm text-grey`,
                        { fontSize: moderateScale(12.5), marginTop: verticalScale(12) },
                      ]}>
                      No hours set for this day.
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View
            style={[
              tw`absolute left-0 right-0 bg-white rounded-t-3xl`,
              {
                bottom: 0,
                paddingHorizontal: '8%',
                paddingTop: verticalScale(15),
                paddingBottom: verticalScale(Platform.OS === 'ios' ? 34 : 24),
              },
            ]}>
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={isSaving}
              style={[
                tw`bg-[#A3CB31] rounded-2xl items-center`,
                { paddingVertical: verticalScale(12) },
                isSaving && tw`opacity-60`,
              ]}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[tw`font-dm font-bold text-white`, { fontSize: moderateScale(15) }]}>
                  Save availability
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {pickerTarget ? (
        <DateTimePicker mode="time" value={currentPickerDate} onChange={handlePickerChange} />
      ) : null}
    </View>
  );
};

export default AppStack_AvailabilityScreen;
