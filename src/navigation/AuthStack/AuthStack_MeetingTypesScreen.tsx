import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { AuthStackParamList } from '.';

import { http } from '~/helpers/http';
import { BackArrow } from '~/lib/images';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthStack_MeetingTypesScreen'>;

type CategoryId = 'services' | 'work' | 'life';

type HookCategory = {
  id: CategoryId;
  title: string;
  icon: CategoryId;
  hooks: string[];
  placeholder: string;
};

const MAX_SELECTED = 3;
const GREEN = '#9BC425';
const TEXT = '#171827';
const MUTED = '#737B85';
const BORDER = '#E7EBF0';

const INITIAL_CATEGORIES: HookCategory[] = [
  {
    id: 'services',
    title: 'Services',
    icon: 'services',
    hooks: ['Appointment', 'Home/service visit', 'Paid session', 'Class or group booking'],
    placeholder: 'Add a new service',
  },
  {
    id: 'work',
    title: 'Work',
    icon: 'work',
    hooks: ['Client consultation', 'Intro call', 'Team sync', 'Project session'],
    placeholder: 'Add a new work hook',
  },
  {
    id: 'life',
    title: 'Friends & Life',
    icon: 'life',
    hooks: ['Grab coffee', 'Study/work together', 'Quick call', 'Make plans'],
    placeholder: 'Add a new life hook',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const CategoryIcon = ({ type }: { type: CategoryId }) => {
  if (type === 'services') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={5} width={16} height={17} rx={2} stroke={MUTED} strokeWidth={2} />
        <Line x1={8} y1={3} x2={8} y2={7} stroke={MUTED} strokeWidth={2} strokeLinecap="round" />
        <Line x1={16} y1={3} x2={16} y2={7} stroke={MUTED} strokeWidth={2} strokeLinecap="round" />
        <Line x1={4} y1={10} x2={20} y2={10} stroke={MUTED} strokeWidth={2} />
        <Line x1={9} y1={15} x2={15} y2={15} stroke={MUTED} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (type === 'work') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={7} width={18} height={15} rx={2} stroke={MUTED} strokeWidth={2} />
        <Path
          d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h3A2.5 2.5 0 0 1 17 5.5V7"
          stroke={MUTED}
          strokeWidth={2}
        />
      </Svg>
    );
  }

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={7} r={3} stroke={MUTED} strokeWidth={2} />
      <Path
        d="M14.5 13.5c1.2-1.8 4.5-1.3 4.5 1.5 0 2.7-4.5 5.5-4.5 5.5S10 17.7 10 15c0-2.8 3.3-3.3 4.5-1.5Z"
        stroke={MUTED}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M3 20c.5-3 2.2-5 5-5 1 0 1.9.2 2.6.7"
        stroke={MUTED}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
};

const AuthStack_MeetingTypesScreen: React.FC<Props> = ({ navigation }) => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]);
  const [addingCategory, setAddingCategory] = useState<CategoryId | null>(null);
  const [customHook, setCustomHook] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const sidePadding = clamp(width * 0.043, 16, 24);
  const isCompactHeight = height < 720;
  const titleSize = clamp(width * 0.1, 34, 40);
  const buttonHeight = clamp(height * 0.068, 58, 64);
  const selectedSet = useMemo(() => new Set(selectedHooks), [selectedHooks]);

  const toggleHook = (hook: string) => {
    if (selectedSet.has(hook)) {
      setSelectedHooks((current) => current.filter((item) => item !== hook));
      return;
    }

    if (selectedHooks.length >= MAX_SELECTED) {
      Alert.alert('Limit Reached', 'You can select up to 3 hooks.');
      return;
    }

    setSelectedHooks((current) => [...current, hook]);
  };

  const openCustomInput = (categoryId: CategoryId) => {
    setAddingCategory(categoryId);
    setCustomHook('');
  };

  const confirmCustomHook = () => {
    const nextHook = customHook.trim();

    if (!nextHook || !addingCategory) {
      setAddingCategory(null);
      setCustomHook('');
      return;
    }

    setCategories((current) =>
      current.map((category) => {
        if (category.id !== addingCategory || category.hooks.includes(nextHook)) return category;

        return {
          ...category,
          hooks: [...category.hooks, nextHook],
        };
      })
    );

    if (!selectedSet.has(nextHook) && selectedHooks.length < MAX_SELECTED) {
      setSelectedHooks((current) => [...current, nextHook]);
    }

    setAddingCategory(null);
    setCustomHook('');
  };

  const saveMeetingTypes = () => {
    if (!selectedHooks.length) {
      Alert.alert('Selection Required', 'Please select at least one hook.');
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    http
      .put('/users/profile', { meetingTypes: selectedHooks })
      .then((response) => {
        if (response.status === 200) {
          navigation.navigate('AppStack');
        } else {
          Alert.alert('Error', 'Failed to save meeting types. Please try again.');
        }
      })
      .catch((error) => {
        console.log({ error });
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const skipMeetingTypes = () => {
    navigation.navigate('AppStack');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: sidePadding,
              paddingTop: isCompactHeight ? 15 : 23,
              paddingBottom: Math.max(insets.bottom + 18, 28),
            },
          ]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.6}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              style={styles.backButton}>
              <Image source={BackArrow} style={styles.backIcon} resizeMode="contain" />
            </TouchableOpacity>
            <Text style={styles.counterText}>
              {selectedHooks.length}/{MAX_SELECTED} selected
            </Text>
          </View>

          <Text
            style={[
              styles.title,
              {
                fontSize: titleSize,
                lineHeight: titleSize * 1.14,
                marginTop: isCompactHeight ? 29 : 51,
              },
            ]}>
            What are you into?
          </Text>
          <Text style={styles.subtitle}>
            Pick up to 3 hooks you’d like to show on your profile.
          </Text>

          <View style={[styles.cards, { marginTop: isCompactHeight ? 26 : 43 }]}>
            {categories.map((category) => (
              <View key={category.id} style={styles.categoryCard}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.iconCircle}>
                    <CategoryIcon type={category.icon} />
                  </View>
                  <Text style={styles.cardTitle}>{category.title}</Text>
                </View>

                <View style={styles.chipWrap}>
                  {category.hooks.map((hook) => {
                    const selected = selectedSet.has(hook);

                    return (
                      <TouchableOpacity
                        key={hook}
                        onPress={() => toggleHook(hook)}
                        activeOpacity={0.75}
                        style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {hook}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.addRow}>
                  {addingCategory === category.id ? (
                    <TextInput
                      autoFocus
                      value={customHook}
                      placeholder={category.placeholder}
                      placeholderTextColor="#A8B1BE"
                      selectionColor={TEXT}
                      style={styles.customInput}
                      onChangeText={setCustomHook}
                      onSubmitEditing={confirmCustomHook}
                      returnKeyType="done"
                    />
                  ) : (
                    <View style={styles.addSpacer} />
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      addingCategory === category.id
                        ? confirmCustomHook()
                        : openCustomInput(category.id)
                    }
                    activeOpacity={0.75}
                    style={styles.addButton}>
                    {addingCategory === category.id ? (
                      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Polyline
                          points="5 13 10 18 19 7"
                          stroke={GREEN}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    ) : (
                      <Text style={styles.addButtonText}>+</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={saveMeetingTypes}
            activeOpacity={0.8}
            disabled={isSaving}
            style={[
              styles.saveButton,
              {
                height: buttonHeight,
                opacity: isSaving ? 0.65 : 1,
              },
            ]}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={skipMeetingTypes}
            activeOpacity={0.8}
            style={[styles.notNowButton, { height: buttonHeight }]}>
            <Text style={styles.notNowText}>Not Now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    height: 22,
    tintColor: TEXT,
    width: 22,
  },
  counterText: {
    color: MUTED,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  title: {
    color: TEXT,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
  },
  subtitle: {
    color: MUTED,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  cards: {
    gap: 16,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingBottom: 24,
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 26,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginRight: 16,
    width: 48,
  },
  cardTitle: {
    color: TEXT,
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    lineHeight: 26,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    alignItems: 'center',
    borderColor: BORDER,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  chipSelected: {
    borderColor: '#CDE989',
  },
  chipText: {
    color: MUTED,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  chipTextSelected: {
    color: GREEN,
  },
  addRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginTop: 20,
  },
  addSpacer: {
    flex: 1,
  },
  customInput: {
    borderColor: '#CDE989',
    borderRadius: 999,
    borderWidth: 1,
    color: TEXT,
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    height: 50,
    paddingHorizontal: 18,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  addButtonText: {
    color: GREEN,
    fontFamily: 'Inter_400Regular',
    fontSize: 22,
    lineHeight: 26,
  },
  saveButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: GREEN,
    borderRadius: 999,
    justifyContent: 'center',
    marginTop: 38,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    lineHeight: 24,
  },
  notNowButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: GREEN,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    marginTop: 16,
  },
  notNowText: {
    color: GREEN,
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    lineHeight: 24,
  },
});

export default AuthStack_MeetingTypesScreen;
