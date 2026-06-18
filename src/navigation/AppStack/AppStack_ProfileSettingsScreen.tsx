import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAtom } from 'jotai';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { userAtom } from '../../store';
import Toast from '~/components/Toast';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ProfileSettingsScreen'>;

const AppStack_ProfileSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useAtom(userAtom);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await http.get('/users/profile');
      const d = res.data;
      if (d) {
        setUser(d);
        if (d.name) setName(d.name);
        if (d.email) setEmail(d.email);
        if (d.bio) setBio(d.bio);
        if (d.birthday) setBirthday(new Date(d.birthday));
      }
    } catch {}
  }, [setUser]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const formatBirthday = (d: Date | null) => {
    if (!d) return '';
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Full name is required.');
      return;
    }
    if (isSaving) return;
    try {
      setIsSaving(true);
      const res = await http.put('/users/profile', { name, bio, email, birthday });
      if (res.status === 200) {
        await fetchProfile();
        setToast('Profile updated');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const FieldLabel = ({ text }: { text: string }) => (
    <Text
      style={[
        tw`font-dm`,
        { color: colors.grey, fontSize: moderateScale(13), marginBottom: verticalScale(6) },
      ]}>
      {text}
    </Text>
  );

  const inputStyle = {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: horizontalScale(16),
    paddingVertical: verticalScale(14),
    fontFamily: 'DMSans',
    fontSize: moderateScale(14),
    color: colors.ink,
    marginBottom: verticalScale(18),
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={60}>
        {/* Header */}
        <View
          style={[
            tw`flex-row items-center`,
            { marginTop: verticalScale(55), paddingHorizontal: '8%', marginBottom: verticalScale(20) },
          ]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
          </TouchableOpacity>
          <View style={tw`flex-1 items-center`}>
            <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
              Profile Settings
            </Text>
          </View>
          <View style={{ width: horizontalScale(24) }} />
        </View>

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(120) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FieldLabel text="Full name" />
          <TextInput
            style={inputStyle}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <FieldLabel text="Enter short BIO" />
          <TextInput
            style={[inputStyle, { minHeight: verticalScale(100), textAlignVertical: 'top', paddingTop: verticalScale(14) }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people what you're open to..."
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={4}
          />

          <FieldLabel text="Birthday" />
          <TouchableOpacity
            onPress={() => setShowBirthdayPicker(true)}
            activeOpacity={0.7}
            style={[inputStyle, { justifyContent: 'center' }]}>
            <Text style={{ color: birthday ? colors.ink : colors.placeholder, fontSize: moderateScale(14), fontFamily: 'DMSans' }}>
              {birthday ? formatBirthday(birthday) : 'MM/DD/YY'}
            </Text>
          </TouchableOpacity>
          {showBirthdayPicker && (
            <DateTimePicker
              value={birthday || new Date(1990, 0, 1)}
              mode="date"
              display="spinner"
              onChange={(_, date) => {
                setShowBirthdayPicker(false);
                if (date) setBirthday(date);
              }}
            />
          )}

          <View style={[tw`flex-row items-center justify-between`, { marginBottom: verticalScale(6) }]}>
            <FieldLabel text="Your email" />
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(13) }]}>Change</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={inputStyle}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </ScrollView>

        {/* Save CTA */}
        <View
          style={[
            tw`absolute left-0 right-0`,
            {
              bottom: 0,
              paddingHorizontal: '8%',
              paddingTop: verticalScale(12),
              paddingBottom: verticalScale(Platform.OS === 'ios' ? 34 : 24),
            },
          ]}>
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={isSaving}
            style={[
              tw`rounded-full items-center`,
              { backgroundColor: colors.green, paddingVertical: verticalScale(15), opacity: isSaving ? 0.6 : 1 },
            ]}>
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[tw`font-dm font-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Toast message={toast || ''} visible={!!toast} onHide={() => setToast(null)} />
    </View>
  );
};

export default AppStack_ProfileSettingsScreen;
