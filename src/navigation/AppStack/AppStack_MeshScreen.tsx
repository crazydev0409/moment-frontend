import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import {
  Avatar,
  BackArrow,
  CalendarIcon,
  CheckIcon,
  FilterIcon,
  MeshIcon,
  NotificationsIcon,
  PhoneIcon,
  SearchIcon,
} from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import {
  Hook,
  HookAvailabilitySlot,
  WEEKDAYS,
  formatDuration,
  formatPrice,
  minutesToLabel,
} from '~/helpers/hooks';

const h = horizontalScale;
const v = verticalScale;
const ms = (n: number) => moderateScale(n, 0.2);

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_MeshScreen'>;
type Tab = 'recommended' | 'soon' | 'nearby';

interface FilterState {
  location: string;
  useCurrentLocation: boolean;
  distance: 1 | 5 | 10 | 20 | 50;
  sortBy: 'recommended' | 'trending' | 'new';
  availability: 'soon' | 'today' | 'this_week' | null;
  source: 'all' | 'connections';
}

const DEFAULT_FILTER: FilterState = {
  location: '',
  useCurrentLocation: false,
  distance: 5,
  sortBy: 'recommended',
  availability: null,
  source: 'all',
};

const DISTANCE_OPTIONS: (1 | 5 | 10 | 20 | 50)[] = [1, 5, 10, 20, 50];

const SORT_OPTIONS: { key: FilterState['sortBy']; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
];

const AVAIL_OPTIONS: { key: NonNullable<FilterState['availability']>; label: string }[] = [
  { key: 'soon', label: 'Soon' },
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
];

// ===== SVG Icons =====

const ClockIcon = ({ size = 14, color = colors.grey }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
    <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PinIcon = ({ size = 14, color = colors.grey }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11Z" stroke={color} strokeWidth="1.8" />
    <Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth="1.8" />
  </Svg>
);

// ===== Helpers =====

function getNextAvailableSlot(
  slots: HookAvailabilitySlot[] | undefined,
  durationMinutes: number
): { label: string; date: Date } | null {
  if (!slots || slots.length === 0) return null;
  const now = new Date();
  const todayWeekday = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + 15;

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const weekday = (todayWeekday + dayOffset) % 7;
    const daySlots = slots
      .filter((s) => s.weekday === weekday && s.isAvailable && !s.isPaused)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const slot of daySlots) {
      const minStart =
        dayOffset === 0 ? Math.max(slot.startMinutes, currentMinutes) : slot.startMinutes;
      const roundedStart = Math.ceil(minStart / 30) * 30;
      if (roundedStart + durationMinutes <= slot.endMinutes) {
        const date = new Date();
        date.setDate(date.getDate() + dayOffset);
        date.setHours(Math.floor(roundedStart / 60), roundedStart % 60, 0, 0);
        const timeLabel = minutesToLabel(roundedStart);
        let label: string;
        if (dayOffset === 0) label = `Today ${timeLabel}`;
        else if (dayOffset === 1) label = `Tomorrow ${timeLabel}`;
        else label = `${WEEKDAYS[weekday]} ${timeLabel}`;
        return { label, date };
      }
    }
  }
  return null;
}

function getNextAvailableMs(
  slots: HookAvailabilitySlot[] | undefined,
  durationMinutes: number
): number | null {
  const slot = getNextAvailableSlot(slots, durationMinutes);
  return slot ? slot.date.getTime() : null;
}

function countActiveFilters(f: FilterState): number {
  let count = 0;
  if (f.location.trim()) count++;
  if (f.useCurrentLocation) count++;
  if (f.distance !== DEFAULT_FILTER.distance) count++;
  if (f.sortBy !== DEFAULT_FILTER.sortBy) count++;
  if (f.availability !== DEFAULT_FILTER.availability) count++;
  if (f.source !== DEFAULT_FILTER.source) count++;
  return count;
}

function applyFilters(hooks: Hook[], filter: FilterState): Hook[] {
  let result = [...hooks];

  if (filter.availability) {
    const now = new Date();
    result = result.filter((hook) => {
      const slot = getNextAvailableSlot(hook.availabilitySlots, hook.durationMinutes);
      if (!slot) return false;
      if (filter.availability === 'soon') {
        return slot.date.getTime() - now.getTime() < 4 * 60 * 60 * 1000;
      }
      if (filter.availability === 'today') {
        return slot.date.toDateString() === now.toDateString();
      }
      if (filter.availability === 'this_week') {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return slot.date <= weekEnd;
      }
      return true;
    });
  }

  if (filter.sortBy === 'new') {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (filter.sortBy === 'trending') {
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  return result;
}

// ===== MeshCard =====

interface MeshCardProps {
  hook: Hook;
  onReserve: () => void;
  onContact: () => void;
  onOwnerPress: () => void;
}

const MeshCard: React.FC<MeshCardProps> = ({ hook, onReserve, onContact, onOwnerPress }) => {
  const nextSlot = useMemo(
    () => getNextAvailableSlot(hook.availabilitySlots, hook.durationMinutes),
    [hook.availabilitySlots, hook.durationMinutes]
  );
  const isRemote = hook.locationType === 'remote';
  const locationText = isRemote ? 'Remote' : hook.locationLabel || 'In-person';

  return (
    <View
      style={[
        tw`rounded-2xl`,
        {
          backgroundColor: colors.card,
          padding: h(16),
          marginBottom: v(12),
          shadowColor: colors.ink,
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
      ]}>
      {/* Title + price badge */}
      <View style={[tw`flex-row items-start justify-between`, { marginBottom: v(4) }]}>
        <Text
          style={[
            tw`flex-1`,
            {
              fontFamily: 'AssociateSansBold',
              color: colors.ink,
              fontSize: ms(16),
              marginRight: h(10),
            },
          ]}
          numberOfLines={2}>
          {hook.title}
        </Text>
        <View
          style={[
            tw`rounded-full`,
            {
              paddingHorizontal: h(10),
              paddingVertical: v(4),
              backgroundColor: hook.isPaid ? '#EEEAFE' : colors.greenTint,
            },
          ]}>
          <Text
            style={{
              fontFamily: 'AssociateSansBold',
              color: hook.isPaid ? '#7A5AF8' : colors.greenText,
              fontSize: ms(13),
            }}>
            {hook.isPaid ? formatPrice(hook.priceCents, hook.currency) : 'Free'}
          </Text>
        </View>
      </View>

      {/* By owner (underlined) */}
      <TouchableOpacity onPress={onOwnerPress} activeOpacity={0.7}>
        <Text
          style={{
            fontFamily: 'AssociateSansRegular',
            color: colors.grey,
            fontSize: ms(13),
            textDecorationLine: 'underline',
            marginBottom: v(12),
          }}>
          By {hook.owner?.name || 'Business'}
        </Text>
      </TouchableOpacity>

      {/* Separator */}
      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: v(12) }} />

      {/* Next available */}
      {nextSlot && (
        <View style={[tw`flex-row items-center`, { marginBottom: v(6) }]}>
          <View
            style={{
              width: h(8),
              height: h(8),
              borderRadius: h(4),
              backgroundColor: colors.green,
              marginRight: h(8),
            }}
          />
          <Text
            style={{ fontFamily: 'AssociateSansBold', color: colors.ink, fontSize: ms(14) }}>
            {nextSlot.label}
          </Text>
        </View>
      )}

      {/* Duration */}
      <View style={[tw`flex-row items-center`, { marginBottom: v(6) }]}>
        <ClockIcon size={h(14)} color={colors.grey} />
        <Text
          style={{
            fontFamily: 'AssociateSansRegular',
            color: colors.grey,
            fontSize: ms(13),
            marginLeft: h(6),
          }}>
          {formatDuration(hook.durationMinutes)}
        </Text>
      </View>

      {/* Location */}
      <View style={[tw`flex-row items-center`, { marginBottom: v(14) }]}>
        <PinIcon size={h(14)} color={colors.grey} />
        <Text
          style={{
            fontFamily: 'AssociateSansRegular',
            color: colors.grey,
            fontSize: ms(13),
            marginLeft: h(6),
          }}
          numberOfLines={1}>
          {locationText}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={[tw`flex-row`, { gap: h(10) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onContact}
          style={[
            tw`flex-1 flex-row items-center justify-center rounded-full`,
            { backgroundColor: colors.field, paddingVertical: v(11) },
          ]}>
          <Image
            source={PhoneIcon}
            style={{ width: h(15), height: h(15), marginRight: h(6) }}
            tintColor={colors.ink}
          />
          <Text
            style={{ fontFamily: 'AssociateSansBold', color: colors.ink, fontSize: ms(13) }}>
            Contact
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onReserve}
          style={[
            tw`flex-1 flex-row items-center justify-center rounded-full`,
            { borderWidth: 1.5, borderColor: colors.green, paddingVertical: v(11) },
          ]}>
          <Image
            source={CalendarIcon}
            style={{ width: h(15), height: h(15), marginRight: h(6) }}
            tintColor={colors.green}
          />
          <Text
            style={{ fontFamily: 'AssociateSansBold', color: colors.green, fontSize: ms(13) }}>
            Reserve
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ===== FilterSheet =====

interface FilterSheetProps {
  visible: boolean;
  filter: FilterState;
  onChange: (f: FilterState) => void;
  onClear: () => void;
  onApply: () => void;
  onClose: () => void;
}

const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  filter,
  onChange,
  onClear,
  onApply,
  onClose,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableOpacity style={tw`flex-1`} activeOpacity={1} onPress={onClose} />
    <View
      style={[
        tw`rounded-t-3xl`,
        {
          backgroundColor: colors.card,
          paddingHorizontal: '8%',
          paddingTop: v(24),
          paddingBottom: v(48),
        },
      ]}>
      {/* Location */}
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: ms(14),
          marginBottom: v(8),
        }}>
        Your location
      </Text>
      <View
        style={[
          tw`flex-row items-center`,
          {
            backgroundColor: colors.field,
            borderRadius: h(12),
            paddingHorizontal: h(14),
            paddingVertical: v(12),
            marginBottom: v(10),
          },
        ]}>
        <TextInput
          style={[
            tw`flex-1`,
            {
              fontFamily: 'AssociateSansRegular',
              color: colors.ink,
              fontSize: ms(14),
            },
          ]}
          placeholder="Enter your location"
          placeholderTextColor={colors.placeholder}
          value={filter.location}
          onChangeText={(t) => onChange({ ...filter, location: t })}
        />
      </View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onChange({ ...filter, useCurrentLocation: !filter.useCurrentLocation })}
        style={[tw`flex-row items-center`, { marginBottom: v(20) }]}>
        <View
          style={[
            tw`rounded items-center justify-center`,
            {
              width: h(20),
              height: h(20),
              borderWidth: 1.5,
              borderColor: filter.useCurrentLocation ? colors.green : colors.border,
              backgroundColor: filter.useCurrentLocation ? colors.green : 'transparent',
              marginRight: h(10),
            },
          ]}>
          {filter.useCurrentLocation && (
            <Image
              source={CheckIcon}
              style={{ width: h(12), height: h(12) }}
              tintColor={colors.white}
            />
          )}
        </View>
        <Text
          style={{
            fontFamily: 'AssociateSansRegular',
            color: colors.ink,
            fontSize: ms(14),
          }}>
          Use current location
        </Text>
      </TouchableOpacity>

      {/* Distance */}
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: ms(14),
          marginBottom: v(10),
        }}>
        Distance
      </Text>
      <View style={[tw`flex-row flex-wrap`, { gap: h(8), marginBottom: v(20) }]}>
        {DISTANCE_OPTIONS.map((d) => {
          const active = filter.distance === d;
          return (
            <TouchableOpacity
              key={d}
              activeOpacity={0.7}
              onPress={() => onChange({ ...filter, distance: d })}
              style={[
                tw`rounded-full`,
                {
                  paddingHorizontal: h(16),
                  paddingVertical: v(8),
                  backgroundColor: active ? colors.green : colors.field,
                },
              ]}>
              <Text
                style={{
                  fontFamily: active ? 'AssociateSansBold' : 'AssociateSansRegular',
                  color: active ? colors.white : colors.ink,
                  fontSize: ms(13),
                }}>
                {d} km
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sort by */}
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: ms(14),
          marginBottom: v(10),
        }}>
        Sort by
      </Text>
      <View style={[tw`flex-row flex-wrap`, { gap: h(8), marginBottom: v(20) }]}>
        {SORT_OPTIONS.map((s) => {
          const active = filter.sortBy === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              activeOpacity={0.7}
              onPress={() => onChange({ ...filter, sortBy: s.key })}
              style={[
                tw`rounded-full`,
                {
                  paddingHorizontal: h(16),
                  paddingVertical: v(8),
                  backgroundColor: active ? colors.green : colors.field,
                },
              ]}>
              <Text
                style={{
                  fontFamily: active ? 'AssociateSansBold' : 'AssociateSansRegular',
                  color: active ? colors.white : colors.ink,
                  fontSize: ms(13),
                }}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Availability */}
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: ms(14),
          marginBottom: v(10),
        }}>
        Availability
      </Text>
      <View style={[tw`flex-row flex-wrap`, { gap: h(8), marginBottom: v(20) }]}>
        {AVAIL_OPTIONS.map((a) => {
          const active = filter.availability === a.key;
          return (
            <TouchableOpacity
              key={a.key}
              activeOpacity={0.7}
              onPress={() => onChange({ ...filter, availability: active ? null : a.key })}
              style={[
                tw`rounded-full`,
                {
                  paddingHorizontal: h(16),
                  paddingVertical: v(8),
                  backgroundColor: active ? colors.green : colors.field,
                },
              ]}>
              <Text
                style={{
                  fontFamily: active ? 'AssociateSansBold' : 'AssociateSansRegular',
                  color: active ? colors.white : colors.ink,
                  fontSize: ms(13),
                }}>
                {a.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Source */}
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: ms(14),
          marginBottom: v(10),
        }}>
        Source
      </Text>
      <View style={[tw`flex-row flex-wrap`, { gap: h(8), marginBottom: v(28) }]}>
        {(['all', 'connections'] as const).map((key) => {
          const active = filter.source === key;
          const label = key === 'all' ? 'All' : 'My connections';
          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.7}
              onPress={() => onChange({ ...filter, source: key })}
              style={[
                tw`rounded-full`,
                {
                  paddingHorizontal: h(16),
                  paddingVertical: v(8),
                  backgroundColor: active ? colors.green : colors.field,
                },
              ]}>
              <Text
                style={{
                  fontFamily: active ? 'AssociateSansBold' : 'AssociateSansRegular',
                  color: active ? colors.white : colors.ink,
                  fontSize: ms(13),
                }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Buttons */}
      <View style={[tw`flex-row`, { gap: h(12) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onClear}
          style={[
            tw`flex-1 items-center justify-center rounded-full`,
            { paddingVertical: v(14), backgroundColor: colors.field },
          ]}>
          <Text
            style={{ fontFamily: 'AssociateSansBold', color: colors.ink, fontSize: ms(15) }}>
            Clear
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onApply}
          style={[
            tw`flex-1 items-center justify-center rounded-full`,
            { paddingVertical: v(14), backgroundColor: colors.green },
          ]}>
          <Text
            style={{ fontFamily: 'AssociateSansBold', color: colors.white, fontSize: ms(15) }}>
            Apply
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ===== ReserveSheet =====

interface ReserveSheetProps {
  hook: Hook | null;
  submitting: boolean;
  onReserve: () => void;
  onClose: () => void;
}

const ReserveSheet: React.FC<ReserveSheetProps> = ({ hook, submitting, onReserve, onClose }) => {
  const nextSlot = useMemo(
    () => (hook ? getNextAvailableSlot(hook.availabilitySlots, hook.durationMinutes) : null),
    [hook]
  );

  const rows = hook
    ? [
        {
          label: 'Time & Date',
          value: nextSlot?.label || 'No availability',
        },
        { label: 'Duration', value: formatDuration(hook.durationMinutes) },
        {
          label: 'Location',
          value:
            hook.locationLabel ||
            (hook.locationType === 'remote' ? 'Remote' : 'In-person'),
        },
        { label: 'Host', value: hook.owner?.name || 'Business' },
        {
          label: 'Total',
          value: hook.isPaid ? formatPrice(hook.priceCents, hook.currency) : 'Free',
        },
      ]
    : [];

  return (
    <Modal visible={!!hook} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={tw`flex-1`} activeOpacity={1} onPress={onClose} />
      <View
        style={[
          tw`rounded-t-3xl`,
          {
            backgroundColor: colors.card,
            paddingHorizontal: '8%',
            paddingTop: v(24),
            paddingBottom: v(48),
          },
        ]}>
        <Text
          style={{
            fontFamily: 'AssociateSansBold',
            color: colors.ink,
            fontSize: ms(20),
            marginBottom: v(4),
          }}>
          Reserve {hook?.title}
        </Text>
        <Text
          style={{
            fontFamily: 'AssociateSansRegular',
            color: colors.grey,
            fontSize: ms(14),
            marginBottom: v(20),
          }}>
          Review the service details
        </Text>

        {rows.map(({ label, value }) => (
          <View
            key={label}
            style={[
              tw`flex-row items-center justify-between`,
              {
                paddingVertical: v(14),
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}>
            <Text
              style={{
                fontFamily: 'AssociateSansRegular',
                color: colors.grey,
                fontSize: ms(14),
              }}>
              {label}
            </Text>
            <Text
              style={{
                fontFamily: 'AssociateSansBold',
                color: colors.ink,
                fontSize: ms(14),
              }}>
              {value}
            </Text>
          </View>
        ))}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onReserve}
          disabled={submitting || !nextSlot}
          style={[
            tw`items-center justify-center rounded-full`,
            {
              backgroundColor: !nextSlot || submitting ? colors.greyLight : colors.green,
              paddingVertical: v(16),
              marginTop: v(24),
            },
          ]}>
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text
              style={{
                fontFamily: 'AssociateSansBold',
                color: colors.white,
                fontSize: ms(16),
              }}>
              Reserve now
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ===== ContactSheet =====

interface ContactSheetProps {
  hook: Hook | null;
  phone: string | null;
  onClose: () => void;
}

const ContactSheet: React.FC<ContactSheetProps> = ({ hook, phone, onClose }) => (
  <Modal visible={!!hook} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableOpacity style={tw`flex-1`} activeOpacity={1} onPress={onClose} />
    <View
      style={[
        tw`rounded-t-3xl items-center`,
        {
          backgroundColor: colors.card,
          paddingHorizontal: '8%',
          paddingTop: v(28),
          paddingBottom: v(48),
        },
      ]}>
      <Text
        style={{
          fontFamily: 'AssociateSansBold',
          color: colors.ink,
          fontSize: ms(20),
          marginBottom: v(24),
        }}>
        Contact {hook?.owner?.name || 'Business'}
      </Text>

      {phone ? (
        <Text
          style={{
            fontFamily: 'AssociateSansBold',
            color: colors.green,
            fontSize: ms(22),
            marginBottom: v(32),
          }}>
          {phone}
        </Text>
      ) : (
        <Text
          style={{
            fontFamily: 'AssociateSansRegular',
            color: colors.grey,
            fontSize: ms(14),
            textAlign: 'center',
            marginBottom: v(32),
          }}>
          Add this business as a contact{'\n'}to see their contact information.
        </Text>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onClose}
        style={[
          tw`w-full items-center justify-center rounded-full`,
          { paddingVertical: v(14), backgroundColor: colors.field },
        ]}>
        <Text
          style={{ fontFamily: 'AssociateSansBold', color: colors.ink, fontSize: ms(15) }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  </Modal>
);

// ===== ProfileView =====

interface ProfileViewProps {
  hook: Hook;
  ownerHooks: Hook[];
  loading: boolean;
  profileTab: 'mesh' | 'all';
  displayedHooks: Hook[];
  contactRequested: Set<string>;
  onTabChange: (tab: 'mesh' | 'all') => void;
  onBack: () => void;
  onReserve: (hook: Hook) => void;
  onContact: (hook: Hook) => void;
  onAddContact: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({
  hook,
  ownerHooks,
  loading,
  profileTab,
  displayedHooks,
  contactRequested,
  onTabChange,
  onBack,
  onReserve,
  onContact,
  onAddContact,
}) => {
  const owner = hook.owner;
  const isRequested = contactRequested.has(hook.ownerId);

  const tags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const h of ownerHooks) {
      if (h.meetingType) tagSet.add(h.meetingType);
      if (h.category) tagSet.add(h.category);
    }
    return Array.from(tagSet).slice(0, 4);
  }, [ownerHooks]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: v(58), paddingHorizontal: '8%', marginBottom: v(24) },
        ]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ marginRight: h(16) }}>
          <Image
            source={BackArrow}
            style={{ width: h(22), height: h(22) }}
            tintColor={colors.ink}
          />
        </TouchableOpacity>
        <Text
          style={{ fontFamily: 'AssociateSansBold', color: colors.ink, fontSize: ms(20) }}>
          Mesh profile
        </Text>
      </View>

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(60) }}
        showsVerticalScrollIndicator={false}>
        {/* Avatar + name + tags */}
        <View style={[tw`items-center`, { marginBottom: v(20) }]}>
          <View
            style={[
              tw`rounded-full overflow-hidden items-center justify-center`,
              {
                width: h(76),
                height: h(76),
                backgroundColor: colors.field,
                marginBottom: v(12),
              },
            ]}>
            {owner?.avatar ? (
              <Image source={{ uri: owner.avatar }} style={{ width: h(76), height: h(76) }} />
            ) : (
              <Image
                source={Avatar}
                style={{ width: h(44), height: h(44) }}
                tintColor={colors.grey}
              />
            )}
          </View>

          <Text
            style={{
              fontFamily: 'AssociateSansBold',
              color: colors.ink,
              fontSize: ms(22),
              marginBottom: v(12),
            }}>
            {owner?.name || 'Business'}
          </Text>

          {tags.length > 0 && (
            <View style={[tw`flex-row flex-wrap justify-center`, { gap: h(8) }]}>
              {tags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    tw`rounded-full`,
                    { paddingHorizontal: h(14), paddingVertical: v(6), backgroundColor: colors.field },
                  ]}>
                  <Text
                    style={{
                      fontFamily: 'AssociateSansRegular',
                      color: colors.ink,
                      fontSize: ms(13),
                    }}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bio */}
        {hook.description ? (
          <Text
            style={{
              fontFamily: 'AssociateSansRegular',
              color: colors.grey,
              fontSize: ms(14),
              textAlign: 'center',
              marginBottom: v(20),
            }}>
            "{hook.description}"
          </Text>
        ) : null}

        {/* Add Contact */}
        <TouchableOpacity
          activeOpacity={isRequested ? 1 : 0.8}
          onPress={isRequested ? undefined : onAddContact}
          style={[
            tw`w-full items-center justify-center rounded-full`,
            {
              paddingVertical: v(14),
              backgroundColor: isRequested ? colors.field : colors.ink,
              marginBottom: v(20),
            },
          ]}>
          <Text
            style={{
              fontFamily: 'AssociateSansBold',
              color: isRequested ? colors.grey : colors.white,
              fontSize: ms(15),
            }}>
            {isRequested ? 'Requested ✓' : 'Add Contact'}
          </Text>
        </TouchableOpacity>

        {/* Hooks tab switcher */}
        <View
          style={[
            tw`flex-row rounded-full`,
            {
              backgroundColor: colors.field,
              padding: v(4),
              marginBottom: v(16),
            },
          ]}>
          {(['mesh', 'all'] as const).map((key) => {
            const active = profileTab === key;
            const label = key === 'mesh' ? 'Mesh hooks' : 'All hooks';
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.7}
                onPress={() => onTabChange(key)}
                style={[
                  tw`flex-1 items-center justify-center rounded-full`,
                  {
                    paddingVertical: v(10),
                    backgroundColor: active ? colors.card : 'transparent',
                  },
                ]}>
                <Text
                  style={{
                    fontFamily: active ? 'AssociateSansBold' : 'AssociateSansRegular',
                    color: active ? colors.ink : colors.grey,
                    fontSize: ms(14),
                  }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hooks list */}
        {loading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: v(30) }} />
        ) : displayedHooks.length === 0 ? (
          <Text
            style={{
              fontFamily: 'AssociateSansRegular',
              color: colors.grey,
              fontSize: ms(14),
              textAlign: 'center',
              marginTop: v(30),
            }}>
            No hooks available
          </Text>
        ) : (
          displayedHooks.map((h) => (
            <MeshCard
              key={h.id}
              hook={h}
              onReserve={() => onReserve(h)}
              onContact={() => onContact(h)}
              onOwnerPress={() => {}}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

// ===== Main Screen =====

const AppStack_MeshScreen: React.FC<Props> = ({ navigation }) => {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('recommended');
  const [unreadCount, setUnreadCount] = useState(0);

  const [filterVisible, setFilterVisible] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER);
  const [pendingFilter, setPendingFilter] = useState<FilterState>(DEFAULT_FILTER);
  const activeFilterCount = useMemo(() => countActiveFilters(filterState), [filterState]);

  const [profileHook, setProfileHook] = useState<Hook | null>(null);
  const [profileOwnerHooks, setProfileOwnerHooks] = useState<Hook[]>([]);
  const [profileOwnerLoading, setProfileOwnerLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<'mesh' | 'all'>('mesh');
  const [contactRequested, setContactRequested] = useState<Set<string>>(new Set());

  const [reserveHook, setReserveHook] = useState<Hook | null>(null);
  const [reserveSubmitting, setReserveSubmitting] = useState(false);

  const [contactHook, setContactHook] = useState<Hook | null>(null);
  const [contactPhone, setContactPhone] = useState<string | null>(null);

  const [toast, setToast] = useState<{ title: string; subtitle: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: string, subtitle: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title, subtitle });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const loadHooks = useCallback(async (refresh = false) => {
    try {
      if (!refresh) setIsLoading(true);
      const res = await http.get('/hooks/mesh');
      setHooks(res.data.hooks || []);
    } catch {
      setHooks([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHooks();
      http
        .get('/users/notifications?unreadOnly=true&limit=1')
        .then((r) => setUnreadCount(r.data.unreadCount || 0))
        .catch(() => {});
    }, [loadHooks])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadHooks(true);
  }, [loadHooks]);

  const displayed = useMemo(() => {
    let result = applyFilters(hooks, filterState);
    if (activeTab === 'soon') {
      result = [...result].sort((a, b) => {
        const at = getNextAvailableMs(a.availabilitySlots, a.durationMinutes);
        const bt = getNextAvailableMs(b.availabilitySlots, b.durationMinutes);
        if (at === null) return 1;
        if (bt === null) return -1;
        return at - bt;
      });
    }
    return result;
  }, [hooks, filterState, activeTab]);

  const handleOpenProfile = useCallback(async (hook: Hook) => {
    setProfileHook(hook);
    setProfileTab('mesh');
    setProfileOwnerLoading(true);
    try {
      const res = await http.get(`/hooks/user/${hook.ownerId}`);
      setProfileOwnerHooks(res.data.hooks || []);
    } catch {
      setProfileOwnerHooks([]);
    } finally {
      setProfileOwnerLoading(false);
    }
  }, []);

  const handleOpenContact = useCallback(async (hook: Hook) => {
    setContactHook(hook);
    setContactPhone(null);
    try {
      const res = await http.get('/users/contacts');
      const match = (res.data.contacts || []).find(
        (c: any) => c.contactUserId === hook.ownerId
      );
      setContactPhone(match?.contactPhone ?? null);
    } catch {
      setContactPhone(null);
    }
  }, []);

  const handleReserve = useCallback(async () => {
    if (!reserveHook?.ownerId) return;
    const nextSlot = getNextAvailableSlot(
      reserveHook.availabilitySlots,
      reserveHook.durationMinutes
    );
    if (!nextSlot) return;
    try {
      setReserveSubmitting(true);
      const endTime = new Date(
        nextSlot.date.getTime() + reserveHook.durationMinutes * 60 * 1000
      );
      await http.post('/users/moment-requests', {
        receiverId: reserveHook.ownerId,
        startTime: nextSlot.date.toISOString(),
        endTime: endTime.toISOString(),
        title: reserveHook.title,
        description: reserveHook.description || reserveHook.title,
        meetingType: 'service',
        locationType: reserveHook.locationType === 'remote' ? 'remote' : 'onsite',
        locationLabel:
          reserveHook.locationLabel ||
          (reserveHook.locationType === 'remote' ? 'Remote' : 'In-person'),
        locationAddress: reserveHook.locationAddress || null,
        locationLatitude: reserveHook.locationLatitude || null,
        locationLongitude: reserveHook.locationLongitude || null,
      });
      const locationText =
        reserveHook.locationLabel ||
        (reserveHook.locationType === 'remote' ? 'Remote' : 'In-person');
      setReserveHook(null);
      showToast('Reservation request sent', `${nextSlot.label} • ${locationText}`);
    } catch {
      // TODO: surface error to user
    } finally {
      setReserveSubmitting(false);
    }
  }, [reserveHook, showToast]);

  const handleAddContact = useCallback(
    (ownerId: string) => {
      setContactRequested((prev) => new Set(prev).add(ownerId));
      // Contact request endpoint to be wired when available on backend
    },
    []
  );

  const profileDisplayedHooks = useMemo(() => {
    if (profileTab === 'mesh') return profileOwnerHooks.filter((h) => h.publishedToMesh);
    return profileOwnerHooks;
  }, [profileOwnerHooks, profileTab]);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-start justify-between`,
          { marginTop: v(58), paddingHorizontal: '8%', marginBottom: v(16) },
        ]}>
        <View>
          <Text
            style={{
              fontFamily: 'AssociateSansBold',
              color: colors.ink,
              fontSize: ms(28),
            }}>
            Mesh
          </Text>
          <Text
            style={{
              fontFamily: 'AssociateSansRegular',
              color: colors.grey,
              fontSize: ms(13),
              marginTop: v(3),
            }}>
            Book services or reserve spaces{'\n'}for meetings nearby
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('AppStack_NotificationScreen')}
          activeOpacity={0.7}
          style={{ position: 'relative' }}>
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              { width: h(46), height: h(46), backgroundColor: colors.card },
            ]}>
            <Image
              source={NotificationsIcon}
              style={{ width: h(22), height: h(22) }}
              tintColor={colors.ink}
            />
          </View>
          {unreadCount > 0 && (
            <View
              style={[
                tw`absolute rounded-full items-center justify-center`,
                {
                  top: -2,
                  right: -2,
                  width: h(18),
                  height: h(18),
                  backgroundColor: colors.green,
                },
              ]}>
              <Text
                style={{
                  fontFamily: 'AssociateSansBold',
                  color: colors.white,
                  fontSize: ms(10),
                }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search row */}
      <View
        style={[
          tw`flex-row items-center`,
          { paddingHorizontal: '8%', marginBottom: v(14), gap: h(10) },
        ]}>
        <View
          style={[
            tw`flex-1 flex-row items-center`,
            {
              backgroundColor: colors.card,
              borderRadius: h(100),
              paddingHorizontal: h(18),
              paddingVertical: v(13),
            },
          ]}>
          <TextInput
            style={[
              tw`flex-1`,
              {
                fontFamily: 'AssociateSansRegular',
                color: colors.ink,
                fontSize: ms(14),
              },
            ]}
            placeholder="Search businesses"
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
          />
          <Image
            source={SearchIcon}
            style={{ width: h(18), height: h(18) }}
            tintColor={colors.greyLight}
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            setPendingFilter(filterState);
            setFilterVisible(true);
          }}
          style={[
            tw`rounded-full items-center justify-center`,
            {
              width: h(48),
              height: h(48),
              backgroundColor: colors.card,
              position: 'relative',
            },
          ]}>
          <Image
            source={FilterIcon}
            style={{ width: h(20), height: h(20) }}
            tintColor={colors.ink}
          />
          {activeFilterCount > 0 && (
            <View
              style={[
                tw`absolute rounded-full items-center justify-center`,
                {
                  top: -2,
                  right: -2,
                  width: h(18),
                  height: h(18),
                  backgroundColor: colors.green,
                },
              ]}>
              <Text
                style={{
                  fontFamily: 'AssociateSansBold',
                  color: colors.white,
                  fontSize: ms(10),
                }}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View
        style={[
          tw`flex-row`,
          { paddingHorizontal: '8%', marginBottom: v(14), gap: h(8) },
        ]}>
        {(['recommended', 'soon', 'nearby'] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          const label =
            tab === 'recommended' ? 'Recommended' : tab === 'soon' ? 'Soon' : 'Nearby';
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab)}
              style={[
                tw`rounded-full`,
                {
                  paddingHorizontal: h(16),
                  paddingVertical: v(8),
                  backgroundColor: active ? 'transparent' : colors.card,
                  borderWidth: active ? 1.5 : 0,
                  borderColor: active ? colors.green : 'transparent',
                },
              ]}>
              <Text
                style={{
                  fontFamily: active ? 'AssociateSansBold' : 'AssociateSansRegular',
                  color: active ? colors.green : colors.grey,
                  fontSize: ms(14),
                }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : displayed.length === 0 ? (
        <View style={[tw`flex-1 items-center justify-center`, { paddingBottom: v(80) }]}>
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              {
                width: h(96),
                height: h(96),
                backgroundColor: colors.greenTint,
                marginBottom: v(16),
              },
            ]}>
            <Image
              source={MeshIcon}
              style={{ width: h(48), height: h(48) }}
              tintColor={colors.green}
              resizeMode="contain"
            />
          </View>
          <Text
            style={{
              fontFamily: 'AssociateSansRegular',
              color: colors.grey,
              fontSize: ms(16),
            }}>
            No meshes yet
          </Text>
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(120) }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.green}
            />
          }>
          {displayed.map((hook) => (
            <MeshCard
              key={hook.id}
              hook={hook}
              onReserve={() => setReserveHook(hook)}
              onContact={() => handleOpenContact(hook)}
              onOwnerPress={() => handleOpenProfile(hook)}
            />
          ))}
        </ScrollView>
      )}

      {/* Filter sheet */}
      <FilterSheet
        visible={filterVisible}
        filter={pendingFilter}
        onChange={setPendingFilter}
        onClear={() => setPendingFilter(DEFAULT_FILTER)}
        onApply={() => {
          setFilterState(pendingFilter);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />

      {/* Reserve sheet */}
      <ReserveSheet
        hook={reserveHook}
        submitting={reserveSubmitting}
        onReserve={handleReserve}
        onClose={() => setReserveHook(null)}
      />

      {/* Contact sheet */}
      <ContactSheet
        hook={contactHook}
        phone={contactPhone}
        onClose={() => setContactHook(null)}
      />

      {/* Profile modal */}
      <Modal
        visible={!!profileHook}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setProfileHook(null)}>
        {profileHook && (
          <ProfileView
            hook={profileHook}
            ownerHooks={profileOwnerHooks}
            loading={profileOwnerLoading}
            profileTab={profileTab}
            displayedHooks={profileDisplayedHooks}
            contactRequested={contactRequested}
            onTabChange={setProfileTab}
            onBack={() => setProfileHook(null)}
            onReserve={(hook) => {
              setProfileHook(null);
              setReserveHook(hook);
            }}
            onContact={(hook) => {
              setProfileHook(null);
              handleOpenContact(hook);
            }}
            onAddContact={() => handleAddContact(profileHook.ownerId)}
          />
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <View
          style={[
            tw`absolute flex-row items-center`,
            {
              bottom: v(100),
              left: '8%',
              right: '8%',
              backgroundColor: colors.card,
              borderRadius: h(16),
              paddingHorizontal: h(16),
              paddingVertical: v(14),
              shadowColor: colors.ink,
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            },
          ]}>
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              {
                width: h(38),
                height: h(38),
                backgroundColor: colors.green,
                marginRight: h(12),
              },
            ]}>
            <Image
              source={CheckIcon}
              style={{ width: h(18), height: h(18) }}
              tintColor={colors.white}
            />
          </View>
          <View style={tw`flex-1`}>
            <Text
              style={{
                fontFamily: 'AssociateSansBold',
                color: colors.ink,
                fontSize: ms(14),
              }}>
              {toast.title}
            </Text>
            <Text
              style={{
                fontFamily: 'AssociateSansRegular',
                color: colors.grey,
                fontSize: ms(12),
              }}>
              {toast.subtitle}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default AppStack_MeshScreen;
