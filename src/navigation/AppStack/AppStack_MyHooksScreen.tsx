import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Background, Avatar, EditIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import Toast from '~/components/Toast';
import { colors, accessBadge, priceBadge } from '~/lib/theme';
import {
  ACCESS_LEVEL_META,
  HOOK_FILTERS,
  Hook,
  HookAccessLevel,
  formatDuration,
  formatPrice,
  summarizeAvailability,
} from '~/helpers/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_MyHooksScreen'>;

const AppStack_MyHooksScreen: React.FC<Props> = ({ navigation, route }) => {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | HookAccessLevel>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [accountType, setAccountType] = useState('user');
  const [toast, setToast] = useState<string | null>(null);

  const loadHooks = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);
      const [hooksRes, profileRes] = await Promise.all([
        http.get('/hooks'),
        http.get('/users/profile').catch(() => null),
      ]);
      setHooks(hooksRes.data.hooks || []);
      if (profileRes?.data?.accountType) setAccountType(profileRes.data.accountType);
    } catch (error) {
      console.error('Error loading hooks:', error);
      Alert.alert('Error', 'Failed to load your hooks. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHooks();
      if (route.params?.toast) {
        setToast(route.params.toast);
        navigation.setParams({ toast: undefined });
      }
    }, [loadHooks, route.params?.toast, navigation])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadHooks(false);
  }, [loadHooks]);

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const handleTogglePause = async (hook: Hook) => {
    const nextState = hook.state === 'paused' ? 'active' : 'paused';
    try {
      await http.post(`/hooks/${hook.id}/state`, { state: nextState });
      setToast(nextState === 'paused' ? 'Hook paused' : 'Hook resumed');
      loadHooks(false);
    } catch {
      Alert.alert('Error', 'Could not update the hook.');
    }
  };

  const handleToggleMesh = async (hook: Hook, value: boolean) => {
    // Optimistic update.
    setHooks((prev) => prev.map((h) => (h.id === hook.id ? { ...h, publishedToMesh: value } : h)));
    try {
      await http.put(`/hooks/${hook.id}`, { publishedToMesh: value });
    } catch {
      setHooks((prev) => prev.map((h) => (h.id === hook.id ? { ...h, publishedToMesh: !value } : h)));
      Alert.alert('Error', 'Could not update Mesh setting.');
    }
  };

  const handleDelete = (hook: Hook) => {
    Alert.alert('Delete hook', `Delete "${hook.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await http.delete(`/hooks/${hook.id}`);
            setToast('Hook deleted');
            loadHooks(false);
          } catch {
            Alert.alert('Error', 'Could not delete the hook.');
          }
        },
      },
    ]);
  };

  const openHookMenu = (hook: Hook) => {
    Alert.alert(hook.title, undefined, [
      { text: 'Edit', onPress: () => navigation.navigate('AppStack_HookEditorScreen', { hookId: hook.id }) },
      { text: hook.state === 'paused' ? 'Resume' : 'Pause', onPress: () => handleTogglePause(hook) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(hook) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const visibleHooks =
    filter === 'all' ? hooks : hooks.filter((h) => h.accessLevel === filter);

  const renderPill = (label: string, fg: string, bg: string) => (
    <View
      style={[
        tw`rounded-full`,
        { backgroundColor: bg, paddingHorizontal: horizontalScale(10), paddingVertical: verticalScale(4) },
      ]}>
      <Text style={[tw`font-dm font-bold`, { color: fg, fontSize: moderateScale(11) }]}>{label}</Text>
    </View>
  );

  const renderAvatars = (hook: Hook) => {
    const people = (hook.participants || []).filter((p) => p.status === 'accepted' || p.status === 'invited');
    if (people.length === 0) return null;
    const shown = people.slice(0, 4);
    const extra = people.length - shown.length;
    return (
      <View style={[tw`flex-row items-center`, { marginTop: verticalScale(10) }]}>
        {shown.map((p, i) => (
          <View
            key={p.id}
            style={[
              tw`rounded-full overflow-hidden items-center justify-center`,
              {
                width: horizontalScale(32),
                height: horizontalScale(32),
                marginLeft: i === 0 ? 0 : -horizontalScale(8),
                borderWidth: 2,
                borderColor: colors.card,
                backgroundColor: '#E3E7EB',
              },
            ]}>
            {p.user?.avatar ? (
              <Image source={{ uri: p.user.avatar }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Image source={Avatar} style={{ width: horizontalScale(18), height: horizontalScale(18) }} />
            )}
          </View>
        ))}
        {extra > 0 && (
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              { width: horizontalScale(32), height: horizontalScale(32), marginLeft: -horizontalScale(8), backgroundColor: colors.field, borderWidth: 2, borderColor: colors.card },
            ]}>
            <Text style={[tw`font-dm font-bold`, { fontSize: moderateScale(10), color: colors.grey }]}>+{extra}</Text>
          </View>
        )}
      </View>
    );
  };

  const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <View style={[tw`flex-row items-center justify-between`, { paddingVertical: verticalScale(5) }]}>
      <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(12.5), maxWidth: '62%' }]}>
        {value}
      </Text>
    </View>
  );

  const renderCard = (hook: Hook) => {
    const isOpen = !!expanded[hook.id];
    const access = accessBadge[hook.accessLevel] || accessBadge.personal;
    const isPaused = hook.state === 'paused';
    return (
      <View
        key={hook.id}
        style={[
          tw`rounded-3xl`,
          { backgroundColor: colors.card, padding: moderateScale(16), marginBottom: verticalScale(12) },
          isPaused && tw`opacity-70`,
        ]}>
        {/* Title + edit + badges */}
        <View style={tw`flex-row items-start justify-between`}>
          <View style={[tw`flex-row items-center flex-1`, { marginRight: horizontalScale(8) }]}>
            <Text numberOfLines={1} style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(16) }]}>
              {hook.icon ? `${hook.icon} ` : ''}{hook.title}
            </Text>
            {hook.isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AppStack_HookEditorScreen', { hookId: hook.id })}
                style={{ marginLeft: horizontalScale(6) }}>
                <Image source={EditIcon} tintColor={colors.grey} style={{ width: horizontalScale(16), height: horizontalScale(16) }} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
          <View style={tw`flex-row items-center`}>
            {renderPill(access.label, access.fg, access.bg)}
            <View style={{ width: horizontalScale(6) }} />
            {hook.isPaid
              ? renderPill(formatPrice(hook.priceCents, hook.currency), priceBadge.paid.fg, priceBadge.paid.bg)
              : renderPill(priceBadge.free.label, priceBadge.free.fg, priceBadge.free.bg)}
          </View>
        </View>

        {isOpen && !!hook.description && (
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5), marginTop: verticalScale(8) }]}>
            {hook.description}
          </Text>
        )}

        {/* Details */}
        <View style={{ marginTop: verticalScale(10) }}>
          {isOpen ? (
            <>
              <DetailRow label="Availability" value={summarizeAvailability(hook.availabilitySlots)} />
              <DetailRow label="Format" value={hook.locationType === 'in_person' ? 'In-person' : 'Remote'} />
              {hook.locationType === 'in_person' && (
                <DetailRow label="Location" value={hook.locationLabel || 'Set location'} />
              )}
              <DetailRow label="Duration" value={formatDuration(hook.durationMinutes)} />
              {hook.capacity != null && <DetailRow label="Capacity" value={`Up to ${hook.capacity} people`} />}
            </>
          ) : (
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
              {summarizeAvailability(hook.availabilitySlots)} · {formatDuration(hook.durationMinutes)}
              {hook.locationType === 'in_person' && hook.locationLabel ? ` · ${hook.locationLabel}` : ''}
            </Text>
          )}
        </View>

        {renderAvatars(hook)}

        {/* Mesh toggle (business owners only) */}
        {hook.isOwner && accountType === 'business' && (
          <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(12) }]}>
            <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(13) }]}>Publish to Mesh</Text>
            <Switch
              value={hook.publishedToMesh}
              onValueChange={(v) => handleToggleMesh(hook, v)}
              trackColor={{ true: colors.green }}
            />
          </View>
        )}

        {/* Footer: expander + owner menu */}
        <View style={[tw`flex-row items-center justify-between`, { marginTop: verticalScale(12) }]}>
          <TouchableOpacity onPress={() => toggleExpand(hook.id)} activeOpacity={0.7}>
            <Text style={[tw`font-dm font-bold`, { color: colors.grey, fontSize: moderateScale(12.5) }]}>
              {isOpen ? 'Less details ⌃' : 'More details ⌄'}
            </Text>
          </TouchableOpacity>
          {!hook.isOwner ? (
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(11.5) }]}>
              Shared by {hook.owner?.name || 'a contact'}
            </Text>
          ) : (
            <TouchableOpacity onPress={() => openHookMenu(hook)} activeOpacity={0.7} style={{ paddingHorizontal: horizontalScale(6) }}>
              <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(20) }]}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={[tw`absolute w-full h-full`, { backgroundColor: colors.pageBg, opacity: 0.9 }]} />

      {/* Header */}
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: verticalScale(55), marginBottom: verticalScale(12), paddingHorizontal: '8%' },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>My Hooks</Text>
        </View>
        <View style={{ width: horizontalScale(24) }} />
      </View>

      {/* Filter chips */}
      <View style={{ paddingLeft: '8%', marginBottom: verticalScale(6) }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: horizontalScale(24) }}>
          {HOOK_FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.8}
                onPress={() => setFilter(key)}
                style={[
                  tw`rounded-full flex-row items-center`,
                  {
                    marginRight: horizontalScale(8),
                    paddingHorizontal: horizontalScale(16),
                    paddingVertical: verticalScale(8),
                    backgroundColor: colors.card,
                    borderWidth: 1.5,
                    borderColor: active ? colors.green : colors.border,
                  },
                ]}>
                <Text
                  style={[
                    tw`font-dm font-bold`,
                    { fontSize: moderateScale(12.5), color: active ? colors.green : colors.grey },
                  ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : visibleHooks.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center`} >
          <View
            style={[
              tw`rounded-full items-center justify-center`,
              { backgroundColor: colors.greenTint, width: horizontalScale(120), height: horizontalScale(120), marginBottom: verticalScale(18) },
            ]}>
            <Text style={{ fontSize: moderateScale(52) }}>🪝</Text>
          </View>
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(16) }]}>No hooks yet</Text>
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingTop: verticalScale(8), paddingBottom: verticalScale(140) }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.green} />}>
          {visibleHooks.map(renderCard)}
        </ScrollView>
      )}

      {/* Create CTA */}
      <View
        style={[
          tw`absolute left-0 right-0`,
          {
            bottom: 0,
            paddingHorizontal: '8%',
            paddingTop: verticalScale(12),
            paddingBottom: verticalScale(Platform.OS === 'ios' ? 34 : 24),
            backgroundColor: 'transparent',
          },
        ]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AppStack_HookEditorScreen', {})}
          activeOpacity={0.85}
          style={[tw`rounded-full items-center`, { backgroundColor: colors.green, paddingVertical: verticalScale(15) }]}>
          <Text style={[tw`font-dm font-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>Create new hook</Text>
        </TouchableOpacity>
      </View>

      <Toast message={toast || ''} visible={!!toast} onHide={() => setToast(null)} />
    </View>
  );
};

export default AppStack_MyHooksScreen;
