import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Circle, Path } from 'react-native-svg';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { http } from '~/helpers/http';
import { minutesToLabel } from '~/helpers/calendarAvailability';
import { horizontalScale as h, moderateScale as ms, verticalScale as v } from '~/helpers/responsive';
import { colors } from '~/lib/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_AvailabilityScreen'>;

type PickerField = 'start' | 'end' | 'pauseFrom' | 'pauseTo';

interface DayState {
  available: boolean;
  startMinutes: number;
  endMinutes: number;
  pauseEnabled: boolean;
  pauseFromMinutes: number;
  pauseToMinutes: number;
}

const weekdays = [
  { key: 1, short: 'Mon', label: 'Monday' },
  { key: 2, short: 'Tue', label: 'Tuesday' },
  { key: 3, short: 'Wed', label: 'Wednesday' },
  { key: 4, short: 'Thu', label: 'Thursday' },
  { key: 5, short: 'Fri', label: 'Friday' },
  { key: 6, short: 'Sat', label: 'Saturday' },
  { key: 0, short: 'Sun', label: 'Sunday' },
];

const DEFAULT_DAY: DayState = {
  available: false,
  startMinutes: 9 * 60,
  endMinutes: 18 * 60,
  pauseEnabled: false,
  pauseFromMinutes: 11 * 60,
  pauseToMinutes: 13 * 60,
};

const minutesToDate = (minutes: number): Date => {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

const dateToMinutes = (date: Date): number => date.getHours() * 60 + date.getMinutes();

const roundToHalf = (date: Date): Date => {
  const d = new Date(date);
  const m = d.getMinutes();
  const rounded = Math.round(m / 30) * 30;
  if (rounded === 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(rounded, 0, 0);
  }
  return d;
};

// Sleeping face SVG illustration
const ChillIllustration = () => (
  <View style={{ alignItems: 'center', marginVertical: v(28) }}>
    <Svg width={h(140)} height={h(140)} viewBox="0 0 140 140">
      <Circle cx="70" cy="80" r="48" fill="#C7E06A" />
      <Path d="M52 73 Q58 67 64 73" stroke={colors.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M76 73 Q82 67 88 73" stroke={colors.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M58 90 Q70 100 82 90" stroke={colors.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* zzz */}
      <Path d="M95 46 L103 46 L95 38 L103 38" stroke={colors.ink} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M107 32 L113 32 L107 26 L113 26" stroke={colors.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M82 56 L90 56 L82 48 L90 48" stroke={colors.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
    <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(15), marginTop: v(4) }]}>
      Today is a chill day
    </Text>
  </View>
);

const AppStack_AvailabilityScreen: React.FC<Props> = ({ navigation }) => {
  const [days, setDays] = useState<Record<number, DayState>>(
    Object.fromEntries(weekdays.map((w) => [w.key, { ...DEFAULT_DAY }])),
  );
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerField, setPickerField] = useState<PickerField | null>(null);
  const [pickerValue, setPickerValue] = useState<Date>(new Date());

  // ─── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const res = await http.get('/users/availability');
        const rawSlots: { weekday: number; startMinutes: number; endMinutes: number }[] =
          res.data.slots || [];

        setDays((prev) => {
          const next = { ...prev };
          weekdays.forEach((w) => {
            const daySlots = rawSlots.filter((s) => s.weekday === w.key);
            if (daySlots.length === 0) {
              next[w.key] = { ...DEFAULT_DAY, available: false };
            } else if (daySlots.length === 1) {
              next[w.key] = {
                available: true,
                startMinutes: daySlots[0].startMinutes,
                endMinutes: daySlots[0].endMinutes,
                pauseEnabled: false,
                pauseFromMinutes: 11 * 60,
                pauseToMinutes: 13 * 60,
              };
            } else {
              // Two slots = pause in between
              const sorted = [...daySlots].sort((a, b) => a.startMinutes - b.startMinutes);
              next[w.key] = {
                available: true,
                startMinutes: sorted[0].startMinutes,
                endMinutes: sorted[sorted.length - 1].endMinutes,
                pauseEnabled: true,
                pauseFromMinutes: sorted[0].endMinutes,
                pauseToMinutes: sorted[1].startMinutes,
              };
            }
          });
          return next;
        });
      } catch {
        Alert.alert('Error', 'Failed to load availability schedule.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const updateDay = (key: number, partial: Partial<DayState>) =>
    setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }));

  const chipSubText = (key: number): string => {
    const d = days[key];
    if (!d.available) return 'Off';
    if (d.startMinutes === 0 && d.endMinutes === 0) return 'Not Set';
    return `${minutesToLabel(d.startMinutes)}\n${minutesToLabel(d.endMinutes)}`;
  };

  const chipHasSlot = (key: number) => days[key]?.available;

  // ─── Time picker ─────────────────────────────────────────────────────────────
  const openPicker = (field: PickerField) => {
    const d = days[selectedDay];
    const mins =
      field === 'start' ? d.startMinutes
      : field === 'end' ? d.endMinutes
      : field === 'pauseFrom' ? d.pauseFromMinutes
      : d.pauseToMinutes;
    setPickerValue(minutesToDate(mins));
    setPickerField(field);
  };

  const handlePickerChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setPickerValue(roundToHalf(date));
  };

  const commitPickerWithDate = (date: Date) => {
    if (!pickerField) return;
    const mins = dateToMinutes(date);
    const d = days[selectedDay];
    if (pickerField === 'start') {
      updateDay(selectedDay, { startMinutes: Math.min(mins, d.endMinutes - 30) });
    } else if (pickerField === 'end') {
      updateDay(selectedDay, { endMinutes: Math.max(mins, d.startMinutes + 30) });
    } else if (pickerField === 'pauseFrom') {
      updateDay(selectedDay, { pauseFromMinutes: Math.min(mins, d.pauseToMinutes - 30) });
    } else {
      updateDay(selectedDay, { pauseToMinutes: Math.max(mins, d.pauseFromMinutes + 30) });
    }
    setPickerField(null);
  };

  const commitPicker = () => commitPickerWithDate(pickerValue);

  const handleAndroidPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) {
      commitPickerWithDate(roundToHalf(date));
    } else {
      // dismissed or neutralButtonPressed
      setPickerField(null);
    }
  };

  const pickerTitle: Record<PickerField, string> = {
    start: 'Start time',
    end: 'End time',
    pauseFrom: 'Break start',
    pauseTo: 'Break end',
  };

  // ─── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const slots: { weekday: number; startMinutes: number; endMinutes: number }[] = [];
      weekdays.forEach((w) => {
        const d = days[w.key];
        if (!d.available) return;
        if (d.pauseEnabled) {
          slots.push({ weekday: w.key, startMinutes: d.startMinutes, endMinutes: d.pauseFromMinutes });
          slots.push({ weekday: w.key, startMinutes: d.pauseToMinutes, endMinutes: d.endMinutes });
        } else {
          slots.push({ weekday: w.key, startMinutes: d.startMinutes, endMinutes: d.endMinutes });
        }
      });
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      await http.put('/users/availability', { timezone, slots });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save availability.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  const current = days[selectedDay];

  const TimeButton = ({
    minutes,
    field,
    active,
  }: {
    minutes: number;
    field: PickerField;
    active?: boolean;
  }) => (
    <TouchableOpacity
      onPress={() => openPicker(field)}
      activeOpacity={0.7}
      style={[
        tw`flex-1 items-center justify-center rounded-full`,
        {
          backgroundColor: colors.card,
          paddingVertical: v(16),
          borderWidth: active ? 1.5 : 0,
          borderColor: active ? colors.green : 'transparent',
        },
      ]}>
      <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17) }]}>
        {minutesToLabel(minutes)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: v(55), marginBottom: v(20), paddingHorizontal: '8%' },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: h(24), height: h(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(18.75) }]}>
            Manage availability
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <>
          {/* Day chip strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: '8%', gap: h(10), paddingBottom: v(4) }}>
            {weekdays.map((w) => {
              const active = selectedDay === w.key;
              const hasSlot = chipHasSlot(w.key);
              const sub = chipSubText(w.key);
              return (
                <TouchableOpacity
                  key={w.key}
                  onPress={() => setSelectedDay(w.key)}
                  activeOpacity={0.7}
                  style={[
                    tw`items-center justify-between rounded-2xl`,
                    {
                      paddingHorizontal: h(14),
                      paddingTop: v(14),
                      paddingBottom: v(10),
                      width: h(80),
                      height: v(96),
                      backgroundColor: active ? colors.ink : colors.card,
                    },
                  ]}>
                  <Text
                    style={[
                      tw`font-associate-bold`,
                      { color: active ? colors.white : colors.ink, fontSize: ms(14) },
                    ]}>
                    {w.short}
                  </Text>
                  <Text
                    style={[
                      tw`font-associate text-center`,
                      {
                        color: active ? 'rgba(255,255,255,0.6)' : colors.grey,
                        fontSize: ms(10),
                        lineHeight: ms(14),
                        flexShrink: 1,
                      },
                    ]}>
                    {sub}
                  </Text>
                  {/* Green dot at bottom for days with slots (inactive only) */}
                  <View
                    style={{
                      width: h(6),
                      height: h(6),
                      borderRadius: h(3),
                      backgroundColor: hasSlot && !active ? colors.green : 'transparent',
                    }}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Content */}
          <ScrollView
            style={tw`flex-1`}
            contentContainerStyle={{ paddingHorizontal: '8%', paddingTop: v(20), paddingBottom: v(120) }}
            showsVerticalScrollIndicator={false}>
            {/* Available row */}
            <View style={[tw`flex-row items-center justify-between`, { marginBottom: v(20) }]}>
              <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17) }]}>
                Available
              </Text>
              <Switch
                value={current.available}
                onValueChange={(val) => updateDay(selectedDay, { available: val })}
                trackColor={{ false: colors.border, true: colors.green }}
                thumbColor={colors.white}
              />
            </View>

            {!current.available ? (
              <ChillIllustration />
            ) : (
              <>
                {/* Start / End time */}
                <View style={[tw`flex-row`, { gap: h(12), marginBottom: v(20) }]}>
                  <View style={tw`flex-1`}>
                    <Text
                      style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginBottom: v(8) }]}>
                      Start time
                    </Text>
                    <TimeButton minutes={current.startMinutes} field="start" active={pickerField === 'start'} />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text
                      style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginBottom: v(8) }]}>
                      End time
                    </Text>
                    <TimeButton minutes={current.endMinutes} field="end" active={pickerField === 'end'} />
                  </View>
                </View>

                {/* Pause row */}
                <View style={[tw`flex-row items-center justify-between`, { marginBottom: current.pauseEnabled ? v(16) : 0 }]}>
                  <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17) }]}>
                    Pause
                  </Text>
                  <Switch
                    value={current.pauseEnabled}
                    onValueChange={(val) => updateDay(selectedDay, { pauseEnabled: val })}
                    trackColor={{ false: colors.border, true: colors.green }}
                    thumbColor={colors.white}
                  />
                </View>

                {current.pauseEnabled && (
                  <View style={[tw`flex-row`, { gap: h(12) }]}>
                    <View style={tw`flex-1`}>
                      <Text
                        style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginBottom: v(8) }]}>
                        From
                      </Text>
                      <TimeButton
                        minutes={current.pauseFromMinutes}
                        field="pauseFrom"
                        active={pickerField === 'pauseFrom'}
                      />
                    </View>
                    <View style={tw`flex-1`}>
                      <Text
                        style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginBottom: v(8) }]}>
                        To
                      </Text>
                      <TimeButton
                        minutes={current.pauseToMinutes}
                        field="pauseTo"
                        active={pickerField === 'pauseTo'}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Save button */}
          <View
            style={[
              tw`absolute left-0 right-0`,
              {
                bottom: 0,
                paddingHorizontal: '8%',
                paddingTop: v(12),
                paddingBottom: v(Platform.OS === 'ios' ? 34 : 24),
                backgroundColor: colors.pageBg,
              },
            ]}>
            <TouchableOpacity
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={isSaving}
              style={[
                tw`rounded-full items-center`,
                { backgroundColor: colors.green, paddingVertical: v(12), opacity: isSaving ? 0.6 : 1 },
              ]}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Android: native picker dialog — no custom modal wrapper needed */}
      {Platform.OS === 'android' && pickerField !== null && (
        <DateTimePicker
          mode="time"
          display="spinner"
          value={pickerValue}
          onChange={handleAndroidPickerChange}
        />
      )}

      {/* iOS: custom bottom-sheet modal with inline spinner */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={!!pickerField}
          transparent
          animationType="slide"
          onRequestClose={() => setPickerField(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
              activeOpacity={1}
              onPress={() => setPickerField(null)}
            />
            <View
              style={{
                backgroundColor: colors.card,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: 34,
              }}>
              <View
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: h(20), paddingTop: v(16), paddingBottom: v(4) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17) }]}>
                  {pickerField ? pickerTitle[pickerField] : ''}
                </Text>
                <TouchableOpacity onPress={commitPicker} activeOpacity={0.7}>
                  <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: ms(16) }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                mode="time"
                display="spinner"
                value={pickerValue}
                onChange={handlePickerChange}
                style={{ height: v(180) }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default AppStack_AvailabilityScreen;
