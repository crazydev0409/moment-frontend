import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { Avatar, BackArrow, Background, SearchIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import {
  ACCESS_LEVEL_META,
  ACCESS_LEVEL_ORDER,
  Hook,
  HookAccessLevel,
  HookAvailabilitySlot,
  HookLocationType,
  WEEKDAYS,
  defaultAvailability,
  formatDuration,
  formatPrice,
  minutesToLabel,
  summarizeAvailability,
} from '~/helpers/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_HookEditorScreen'>;

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

interface ContactItem {
  id: string;
  displayName: string;
  contactPhone?: string;
  contactUser?: { id: string; name?: string; avatar?: string };
}

const inputStyle = [
  tw`rounded-2xl font-dm`,
  { backgroundColor: colors.field, color: colors.ink, paddingHorizontal: horizontalScale(14), paddingVertical: verticalScale(12), fontSize: moderateScale(14) },
];

const Card = ({ children }: { children: React.ReactNode }) => (
  <View
    style={[
      tw`rounded-3xl`,
      { backgroundColor: colors.card, padding: moderateScale(16), marginBottom: verticalScale(14) },
    ]}>
    {children}
  </View>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(16), marginBottom: verticalScale(12) }]}>
    {children}
  </Text>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5), marginBottom: verticalScale(6), marginTop: verticalScale(12) }]}>
    {children}
  </Text>
);

function Segmented<T extends string>({
  value,
  options,
  onChange,
  fill,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  fill?: boolean;
}) {
  return (
    <View style={[tw`flex-row rounded-full`, { backgroundColor: colors.field, padding: horizontalScale(4) }]}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            activeOpacity={0.85}
            onPress={() => onChange(opt.key)}
            style={[
              tw`items-center rounded-full`,
              fill ? tw`flex-1` : {},
              {
                paddingVertical: verticalScale(9),
                paddingHorizontal: fill ? 0 : horizontalScale(18),
                backgroundColor: active ? colors.green : 'transparent',
              },
            ]}>
            <Text
              style={[
                tw`font-dm font-bold`,
                { fontSize: moderateScale(12.5), color: active ? colors.white : colors.grey },
              ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const AppStack_HookEditorScreen: React.FC<Props> = ({ navigation, route }) => {
  const hookId = route.params?.hookId;
  const isEdit = !!hookId;

  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [accountType, setAccountType] = useState('user');

  // Form state
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [description, setDescription] = useState('');
  const [accessLevel, setAccessLevel] = useState<HookAccessLevel>('personal');
  const [locationType, setLocationType] = useState<HookLocationType>('remote');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [capacity, setCapacity] = useState('');
  const [availability, setAvailability] = useState<HookAvailabilitySlot[]>(defaultAvailability());
  const [isPaid, setIsPaid] = useState(false);
  const [priceText, setPriceText] = useState('');
  const [publishedToMesh, setPublishedToMesh] = useState(false);

  // Participants
  const [selectedContacts, setSelectedContacts] = useState<ContactItem[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [contactSearch, setContactSearch] = useState('');

  // Sheets
  const [showAvailabilitySheet, setShowAvailabilitySheet] = useState(false);
  const [showDurationSheet, setShowDurationSheet] = useState(false);
  const [activeDay, setActiveDay] = useState(1); // Monday
  const [timePicker, setTimePicker] = useState<{ weekday: number; field: 'startMinutes' | 'endMinutes' } | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await http.get('/users/profile');
      setAccountType(res.data?.accountType || 'user');
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadHook = useCallback(async () => {
    if (!hookId) return;
    try {
      setIsLoading(true);
      const res = await http.get(`/hooks/${hookId}`);
      const hook: Hook = res.data.hook;
      setTitle(hook.title);
      setIcon(hook.icon || '');
      setMeetingType(hook.meetingType || '');
      setDescription(hook.description || '');
      setAccessLevel(hook.accessLevel);
      setLocationType(hook.locationType);
      setLocationLabel(hook.locationLabel || '');
      setLocationAddress(hook.locationAddress || '');
      setDurationMinutes(hook.durationMinutes);
      setCapacity(hook.capacity != null ? String(hook.capacity) : '');
      setIsPaid(hook.isPaid);
      setPriceText(hook.isPaid && hook.priceCents != null ? (hook.priceCents / 100).toString() : '');
      setPublishedToMesh(hook.publishedToMesh);
      if (hook.availabilitySlots && hook.availabilitySlots.length > 0) {
        // Backfill any missing weekdays so the sheet always shows all 7.
        const byDay = new Map(hook.availabilitySlots.map((s) => [s.weekday, s]));
        setAvailability(
          defaultAvailability().map((d) => byDay.get(d.weekday) || { ...d, isAvailable: false })
        );
      }
      setSelectedContacts(
        (hook.participants || [])
          .filter((p) => p.user?.id)
          .map((p) => ({
            id: p.user!.id,
            displayName: p.displayName || p.user?.name || 'Contact',
            contactUser: { id: p.user!.id, name: p.user?.name || undefined, avatar: p.user?.avatar || undefined },
          }))
      );
    } catch (error) {
      console.error('Error loading hook:', error);
      Alert.alert('Error', 'Failed to load this hook.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } finally {
      setIsLoading(false);
    }
  }, [hookId, navigation]);

  useEffect(() => {
    loadProfile();
    loadHook();
  }, [loadProfile, loadHook]);

  const loadContacts = useCallback(async () => {
    try {
      const res = await http.get('/users/contacts');
      setContacts((res.data.contacts || []).filter((c: ContactItem) => c.contactUser?.id));
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }, []);

  const openContactPicker = () => {
    loadContacts();
    setShowContactPicker(true);
  };

  const toggleContact = (contact: ContactItem) => {
    const uid = contact.contactUser?.id;
    if (!uid) return;
    setSelectedContacts((prev) =>
      prev.some((c) => c.contactUser?.id === uid)
        ? prev.filter((c) => c.contactUser?.id !== uid)
        : [...prev, contact]
    );
  };

  // Availability helpers
  const updateDay = (weekday: number, patch: Partial<HookAvailabilitySlot>) =>
    setAvailability((prev) => prev.map((s) => (s.weekday === weekday ? { ...s, ...patch } : s)));

  const activeSlot = availability.find((s) => s.weekday === activeDay) || availability[0];

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    const target = timePicker;
    setTimePicker(null);
    if (event.type === 'dismissed' || !date || !target) return;
    const mins = date.getHours() * 60 + date.getMinutes();
    if (target.field === 'startMinutes') {
      updateDay(target.weekday, { startMinutes: Math.min(mins, (activeSlot.endMinutes || 1080) - 15) });
    } else {
      updateDay(target.weekday, { endMinutes: Math.max(mins, (activeSlot.startMinutes || 540) + 15) });
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Please enter a name.';
    if (isPaid) {
      const amt = parseFloat(priceText);
      if (isNaN(amt) || amt <= 0) return 'Please enter a valid price.';
    }
    if (capacity.trim() && (!/^\d+$/.test(capacity.trim()) || parseInt(capacity, 10) <= 0))
      return 'Capacity must be a positive whole number.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Hold on', err);
      return;
    }
    const priceCents = isPaid ? Math.round(parseFloat(priceText) * 100) : undefined;
    const participantUserIds = selectedContacts.map((c) => c.contactUser?.id).filter(Boolean) as string[];
    const payload: Record<string, unknown> = {
      title: title.trim(),
      icon: icon.trim() || null,
      meetingType: meetingType.trim() || null,
      description: description.trim() || null,
      accessLevel,
      locationType,
      locationLabel: locationType === 'in_person' ? locationLabel.trim() || null : null,
      locationAddress: locationType === 'in_person' ? locationAddress.trim() || null : null,
      durationMinutes,
      capacity: capacity.trim() ? parseInt(capacity, 10) : null,
      isPaid,
      priceCents,
      publishedToMesh: accountType === 'business' ? publishedToMesh : false,
      availabilitySlots: availability,
    };
    try {
      setIsSaving(true);
      if (isEdit) {
        await http.put(`/hooks/${hookId}`, payload);
        if (ACCESS_LEVEL_META[accessLevel].hasInvitees && participantUserIds.length > 0) {
          await http.post(`/hooks/${hookId}/participants`, { participantUserIds }).catch(() => undefined);
        }
      } else {
        await http.post('/hooks', { ...payload, participantUserIds });
      }
      navigation.navigate('AppStack_MyHooksScreen', { toast: isEdit ? 'Hook updated' : 'Hook created' });
    } catch (error: any) {
      console.error('Error saving hook:', error);
      Alert.alert('Error', error?.response?.data?.error || 'Failed to save the hook.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!hookId) return;
    Alert.alert('Delete hook', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await http.delete(`/hooks/${hookId}`);
            navigation.navigate('AppStack_MyHooksScreen', { toast: 'Hook deleted' });
          } catch {
            Alert.alert('Error', 'Could not delete the hook.');
          }
        },
      },
    ]);
  };

  const PickerField = ({ value, placeholder, onPress, icon: glyph }: { value?: string; placeholder: string; onPress: () => void; icon: string }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[tw`rounded-2xl flex-row items-center justify-between`, { backgroundColor: colors.field, paddingHorizontal: horizontalScale(14), paddingVertical: verticalScale(13) }]}>
      <Text style={[tw`font-dm`, { color: value ? colors.ink : colors.placeholder, fontSize: moderateScale(14) }]}>
        {value || placeholder}
      </Text>
      <Text style={{ fontSize: moderateScale(15) }}>{glyph}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
        <Image source={Background} style={tw`absolute w-full h-full`} />
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </View>
    );
  }

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={[tw`absolute w-full h-full`, { backgroundColor: colors.pageBg, opacity: 0.9 }]} />

      {/* Header */}
      <View style={[tw`flex-row items-center`, { marginTop: verticalScale(55), marginBottom: verticalScale(8), paddingHorizontal: '8%' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
            {isEdit ? 'Edit hook' : 'Create new hook'}
          </Text>
        </View>
        {isEdit ? (
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <Text style={[tw`font-dm`, { color: colors.danger, fontSize: moderateScale(13) }]}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: horizontalScale(24) }} />
        )}
      </View>

      <KeyboardAvoidingView style={tw`flex-1`} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingTop: verticalScale(8), paddingBottom: verticalScale(150) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Basic info */}
          <Card>
            <SectionTitle>Basic info</SectionTitle>
            <FieldLabel>Name</FieldLabel>
            <View style={tw`flex-row items-center`}>
              <TextInput
                style={[tw`rounded-2xl text-center font-dm`, { backgroundColor: colors.field, color: colors.ink, width: horizontalScale(52), height: horizontalScale(48), marginRight: horizontalScale(10), fontSize: moderateScale(22) }]}
                value={icon}
                onChangeText={(t) => setIcon(t.slice(0, 2))}
                placeholder="🎯"
                placeholderTextColor={colors.placeholder}
              />
              <TextInput style={[inputStyle, tw`flex-1`]} value={title} onChangeText={setTitle} placeholder="e.g. Coffee chat" placeholderTextColor={colors.placeholder} />
            </View>
            <FieldLabel>Label (meeting type)</FieldLabel>
            <TextInput style={inputStyle} value={meetingType} onChangeText={setMeetingType} placeholder="e.g. Consultation, Coffee, Haircut" placeholderTextColor={colors.placeholder} />
            <FieldLabel>Description</FieldLabel>
            <TextInput style={[inputStyle, { height: verticalScale(80), textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="What is this hook for?" placeholderTextColor={colors.placeholder} multiline />
          </Card>

          {/* Booking details */}
          <Card>
            <SectionTitle>Booking details</SectionTitle>
            <FieldLabel>Availability</FieldLabel>
            <PickerField value={summarizeAvailability(availability)} placeholder="Select availability" icon="🗓️" onPress={() => setShowAvailabilitySheet(true)} />
            <FieldLabel>Duration</FieldLabel>
            <PickerField value={formatDuration(durationMinutes)} placeholder="Select duration" icon="🕐" onPress={() => setShowDurationSheet(true)} />
            <FieldLabel>Capacity (optional)</FieldLabel>
            <TextInput style={inputStyle} value={capacity} onChangeText={(t) => setCapacity(t.replace(/[^0-9]/g, ''))} placeholder="Max people, e.g. 20" placeholderTextColor={colors.placeholder} keyboardType="number-pad" />
          </Card>

          {/* Format */}
          <Card>
            <View style={tw`flex-row items-center justify-between`}>
              <SectionTitle>Format</SectionTitle>
              <Segmented value={locationType} onChange={setLocationType} options={[{ key: 'remote', label: 'Remote' }, { key: 'in_person', label: 'In-person' }]} />
            </View>
            {locationType === 'in_person' && (
              <>
                <FieldLabel>Location</FieldLabel>
                <TextInput style={inputStyle} value={locationLabel} onChangeText={setLocationLabel} placeholder="Place name (e.g. Blue Bottle)" placeholderTextColor={colors.placeholder} />
                <TextInput style={[inputStyle, { marginTop: verticalScale(10) }]} value={locationAddress} onChangeText={setLocationAddress} placeholder="Address" placeholderTextColor={colors.placeholder} />
              </>
            )}
          </Card>

          {/* Access */}
          <Card>
            <SectionTitle>Access</SectionTitle>
            <Segmented fill value={accessLevel} onChange={setAccessLevel} options={ACCESS_LEVEL_ORDER.map((k) => ({ key: k, label: ACCESS_LEVEL_META[k].label }))} />
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(11.5), marginTop: verticalScale(8) }]}>
              {ACCESS_LEVEL_META[accessLevel].description}
            </Text>
            {ACCESS_LEVEL_META[accessLevel].hasInvitees && (
              <>
                <FieldLabel>Invitees</FieldLabel>
                <View style={tw`flex-row flex-wrap items-center`}>
                  <TouchableOpacity onPress={openContactPicker} activeOpacity={0.85} style={{ alignItems: 'center', marginRight: horizontalScale(12), marginBottom: verticalScale(8) }}>
                    <View style={[tw`rounded-full items-center justify-center`, { backgroundColor: colors.green, width: horizontalScale(52), height: horizontalScale(52) }]}>
                      <Text style={[tw`text-white`, { fontSize: moderateScale(26) }]}>+</Text>
                    </View>
                    <Text style={[tw`font-dm font-bold`, { color: colors.greenText, fontSize: moderateScale(11.5), marginTop: verticalScale(3) }]}>Add</Text>
                  </TouchableOpacity>
                  {selectedContacts.map((c) => (
                    <TouchableOpacity key={c.contactUser?.id} onPress={() => toggleContact(c)} style={{ alignItems: 'center', marginRight: horizontalScale(12), marginBottom: verticalScale(8) }}>
                      <View style={[tw`rounded-full overflow-hidden items-center justify-center`, { backgroundColor: '#E3E7EB', width: horizontalScale(52), height: horizontalScale(52) }]}>
                        {c.contactUser?.avatar ? (
                          <Image source={{ uri: c.contactUser.avatar }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Image source={Avatar} style={{ width: horizontalScale(28), height: horizontalScale(28) }} />
                        )}
                        <View style={[tw`absolute rounded-full items-center justify-center`, { top: 0, right: 0, width: horizontalScale(18), height: horizontalScale(18), backgroundColor: colors.danger }]}>
                          <Text style={[tw`text-white`, { fontSize: moderateScale(11) }]}>×</Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(10.5), marginTop: verticalScale(3), maxWidth: horizontalScale(56) }]}>
                        {c.displayName.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </Card>

          {/* Pricing */}
          <Card>
            <View style={tw`flex-row items-center justify-between`}>
              <SectionTitle>Pricing</SectionTitle>
              <Segmented value={isPaid ? 'paid' : 'free'} onChange={(v) => setIsPaid(v === 'paid')} options={[{ key: 'paid', label: 'Paid' }, { key: 'free', label: 'Free' }]} />
            </View>
            {isPaid && (
              <View style={[tw`flex-row items-center rounded-2xl`, { backgroundColor: colors.field, marginTop: verticalScale(10), paddingHorizontal: horizontalScale(14) }]}>
                <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(16) }]}>$</Text>
                <TextInput
                  style={[tw`flex-1 font-dm`, { color: colors.ink, paddingVertical: verticalScale(12), paddingHorizontal: horizontalScale(8), fontSize: moderateScale(14) }]}
                  value={priceText}
                  onChangeText={(t) => setPriceText(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="decimal-pad"
                />
                {!!priceText && !isNaN(parseFloat(priceText)) && (
                  <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12) }]}>{formatPrice(Math.round(parseFloat(priceText) * 100))}</Text>
                )}
              </View>
            )}
            {accountType === 'business' && (
              <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(16) }]}>
                <View style={tw`flex-1`}>
                  <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(13) }]}>Publish to Mesh</Text>
                  <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(11.5), marginTop: verticalScale(2) }]}>Show this hook as a service in Mesh.</Text>
                </View>
                <Switch value={publishedToMesh} onValueChange={setPublishedToMesh} trackColor={{ true: colors.green }} />
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save / Create */}
      <View style={[tw`absolute left-0 right-0`, { bottom: 0, paddingHorizontal: '8%', paddingTop: verticalScale(12), paddingBottom: verticalScale(Platform.OS === 'ios' ? 34 : 24) }]}>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={isSaving}
          style={[tw`rounded-full items-center`, { backgroundColor: colors.green, paddingVertical: verticalScale(15) }, isSaving && tw`opacity-60`]}>
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[tw`font-dm font-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>{isEdit ? 'Save changes' : 'Create'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Duration sheet */}
      <Modal visible={showDurationSheet} transparent animationType="slide" onRequestClose={() => setShowDurationSheet(false)}>
        <View style={tw`flex-1 justify-end`}>
          <TouchableOpacity style={tw`flex-1`} activeOpacity={1} onPress={() => setShowDurationSheet(false)}>
            <View style={tw`flex-1 bg-black opacity-40`} />
          </TouchableOpacity>
          <View style={[tw`rounded-t-3xl`, { backgroundColor: colors.card, paddingTop: verticalScale(18), paddingBottom: verticalScale(34), paddingHorizontal: horizontalScale(18) }]}>
            <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(16), marginBottom: verticalScale(14) }]}>Set duration</Text>
            <View style={tw`flex-row flex-wrap`}>
              {DURATION_PRESETS.map((m) => {
                const active = durationMinutes === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => { setDurationMinutes(m); setShowDurationSheet(false); }}
                    style={[tw`rounded-full`, { marginRight: horizontalScale(10), marginBottom: verticalScale(10), paddingHorizontal: horizontalScale(18), paddingVertical: verticalScale(10), backgroundColor: active ? colors.green : colors.field }]}>
                    <Text style={[tw`font-dm font-bold`, { color: active ? colors.white : colors.ink, fontSize: moderateScale(13) }]}>{formatDuration(m)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(8) }]}>
              <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(13) }]}>Custom</Text>
              <View style={tw`flex-row items-center`}>
                <TouchableOpacity onPress={() => setDurationMinutes((d) => Math.max(15, d - 15))} style={[tw`rounded-full items-center justify-center`, { backgroundColor: colors.field, width: horizontalScale(34), height: horizontalScale(34) }]}>
                  <Text style={[tw`font-bold`, { color: colors.ink, fontSize: moderateScale(20) }]}>−</Text>
                </TouchableOpacity>
                <Text style={[tw`font-dm font-bold text-center`, { color: colors.ink, fontSize: moderateScale(14), width: horizontalScale(86) }]}>{formatDuration(durationMinutes)}</Text>
                <TouchableOpacity onPress={() => setDurationMinutes((d) => Math.min(480, d + 15))} style={[tw`rounded-full items-center justify-center`, { backgroundColor: colors.green, width: horizontalScale(34), height: horizontalScale(34) }]}>
                  <Text style={[tw`font-bold text-white`, { fontSize: moderateScale(20) }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Availability sheet */}
      <Modal visible={showAvailabilitySheet} transparent animationType="slide" onRequestClose={() => setShowAvailabilitySheet(false)}>
        <View style={tw`flex-1 justify-end`}>
          <TouchableOpacity style={tw`flex-1`} activeOpacity={1} onPress={() => setShowAvailabilitySheet(false)}>
            <View style={tw`flex-1 bg-black opacity-40`} />
          </TouchableOpacity>
          <View style={[tw`rounded-t-3xl`, { backgroundColor: colors.card, paddingTop: verticalScale(18), paddingBottom: verticalScale(34) }]}>
            <View style={[tw`flex-row justify-between items-center`, { paddingHorizontal: horizontalScale(18), marginBottom: verticalScale(14) }]}>
              <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18) }]}>Set availability</Text>
              <TouchableOpacity onPress={() => setShowAvailabilitySheet(false)}>
                <Text style={[tw`font-dm font-bold`, { color: colors.green, fontSize: moderateScale(15) }]}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: horizontalScale(18) }}>
              {availability.map((s) => {
                const active = s.weekday === activeDay;
                return (
                  <TouchableOpacity
                    key={s.weekday}
                    onPress={() => setActiveDay(s.weekday)}
                    style={[
                      tw`rounded-2xl items-center`,
                      { marginRight: horizontalScale(8), paddingVertical: verticalScale(10), paddingHorizontal: horizontalScale(12), minWidth: horizontalScale(74), borderWidth: 1, borderColor: colors.border, backgroundColor: active ? colors.ink : colors.card },
                    ]}>
                    <Text style={[tw`font-dm font-bold`, { color: active ? colors.white : colors.ink, fontSize: moderateScale(14) }]}>{WEEKDAYS[s.weekday]}</Text>
                    <Text style={[tw`font-dm`, { color: active ? colors.white : colors.grey, fontSize: moderateScale(9.5), marginTop: verticalScale(3), textAlign: 'center' }]}>
                      {s.isAvailable ? `${minutesToLabel(s.startMinutes)}\n${minutesToLabel(s.endMinutes)}` : 'Off'}
                    </Text>
                    <View style={[tw`rounded-full`, { width: horizontalScale(7), height: horizontalScale(7), marginTop: verticalScale(5), backgroundColor: s.isAvailable && !s.isPaused ? colors.green : colors.greyLight }]} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ paddingHorizontal: horizontalScale(18), marginTop: verticalScale(16) }}>
              <View style={tw`flex-row items-center justify-between`}>
                <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(15) }]}>Available</Text>
                <Switch value={activeSlot.isAvailable} onValueChange={(v) => updateDay(activeDay, { isAvailable: v })} trackColor={{ true: colors.green }} />
              </View>
              {activeSlot.isAvailable && (
                <>
                  <View style={[tw`flex-row`, { marginTop: verticalScale(14), gap: horizontalScale(12) }]}>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12), marginBottom: verticalScale(6) }]}>Start time</Text>
                      <TouchableOpacity onPress={() => setTimePicker({ weekday: activeDay, field: 'startMinutes' })} style={[tw`rounded-2xl items-center`, { borderWidth: 1, borderColor: colors.border, paddingVertical: verticalScale(13) }]}>
                        <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(15) }]}>{minutesToLabel(activeSlot.startMinutes)}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={tw`flex-1`}>
                      <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12), marginBottom: verticalScale(6) }]}>End time</Text>
                      <TouchableOpacity onPress={() => setTimePicker({ weekday: activeDay, field: 'endMinutes' })} style={[tw`rounded-2xl items-center`, { borderWidth: 1, borderColor: colors.border, paddingVertical: verticalScale(13) }]}>
                        <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(15) }]}>{minutesToLabel(activeSlot.endMinutes)}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(16) }]}>
                    <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(15) }]}>Pause</Text>
                    <Switch value={activeSlot.isPaused} onValueChange={(v) => updateDay(activeDay, { isPaused: v })} trackColor={{ true: colors.green }} />
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {timePicker && (
        <DateTimePicker
          mode="time"
          value={(() => {
            const d = new Date();
            const mins = timePicker.field === 'startMinutes' ? activeSlot.startMinutes : activeSlot.endMinutes;
            d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
            return d;
          })()}
          onChange={onTimeChange}
        />
      )}

      {/* Contact picker */}
      <Modal visible={showContactPicker} transparent animationType="slide" onRequestClose={() => setShowContactPicker(false)}>
        <View style={tw`flex-1 justify-end`}>
          <TouchableOpacity style={tw`flex-1`} activeOpacity={1} onPress={() => setShowContactPicker(false)}>
            <View style={tw`flex-1 bg-black opacity-40`} />
          </TouchableOpacity>
          <View style={[tw`rounded-t-3xl`, { backgroundColor: colors.card, paddingTop: verticalScale(18), maxHeight: '75%' }]}>
            <View style={[tw`flex-row justify-between items-center`, { paddingHorizontal: horizontalScale(18), marginBottom: verticalScale(12) }]}>
              <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(16) }]}>Add people</Text>
              <TouchableOpacity onPress={() => setShowContactPicker(false)}>
                <Text style={[tw`font-dm font-bold`, { color: colors.green, fontSize: moderateScale(14) }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={[tw`rounded-2xl flex-row items-center`, { backgroundColor: colors.field, marginHorizontal: horizontalScale(18), paddingHorizontal: horizontalScale(14), paddingVertical: verticalScale(10), marginBottom: verticalScale(10) }]}>
              <Image source={SearchIcon} style={{ width: horizontalScale(16), height: horizontalScale(16), marginRight: horizontalScale(8) }} />
              <TextInput style={[tw`flex-1 font-dm`, { color: colors.ink }]} placeholder="Search contacts" placeholderTextColor={colors.greyLight} value={contactSearch} onChangeText={setContactSearch} />
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: horizontalScale(18), paddingBottom: verticalScale(30) }}>
              {contacts
                .filter((c) => c.displayName.toLowerCase().includes(contactSearch.toLowerCase()))
                .map((contact) => {
                  const selected = selectedContacts.some((c) => c.contactUser?.id === contact.contactUser?.id);
                  return (
                    <TouchableOpacity key={contact.id} activeOpacity={0.7} onPress={() => toggleContact(contact)} style={[tw`flex-row items-center`, { paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <View style={[tw`rounded-full overflow-hidden items-center justify-center`, { backgroundColor: '#E3E7EB', width: horizontalScale(42), height: horizontalScale(42), marginRight: horizontalScale(12) }]}>
                        {contact.contactUser?.avatar ? (
                          <Image source={{ uri: contact.contactUser.avatar }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Image source={Avatar} style={{ width: horizontalScale(26), height: horizontalScale(26) }} />
                        )}
                      </View>
                      <Text style={[tw`flex-1 font-dm`, { color: colors.ink, fontSize: moderateScale(14) }]}>{contact.displayName}</Text>
                      <View style={[tw`rounded-full items-center justify-center`, { width: horizontalScale(24), height: horizontalScale(24), borderWidth: 2, borderColor: selected ? colors.green : colors.border, backgroundColor: selected ? colors.green : 'transparent' }]}>
                        {selected && <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(13) }]}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              {contacts.length === 0 && (
                <Text style={[tw`font-dm text-center`, { color: colors.grey, fontSize: moderateScale(13), paddingVertical: verticalScale(30) }]}>No registered contacts to invite yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_HookEditorScreen;
