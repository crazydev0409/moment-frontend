import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAtom } from 'jotai';
import React, { useEffect, useState } from 'react';
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

import { AuthStackParamList } from '.';

import { http } from '~/helpers/http';
import { BackArrow } from '~/lib/images';
import { userAtom } from '~/store';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthStack_ProfileScreen'>;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const formatBirthday = (date: Date | null) => {
  if (!date) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

const AuthStack_ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [birthdayError, setBirthdayError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [user] = useAtom(userAtom);

  const isCompactHeight = height < 720;
  const sidePadding = clamp(width * 0.043, 16, 24);
  const contentHeight = height - insets.top - insets.bottom;
  const titleSize = clamp(width * 0.074, 28, 31);
  const inputHeight = clamp(height * 0.066, 56, 64);
  const buttonHeight = clamp(height * 0.068, 58, 64);

  useEffect(() => {
    if (user.name) setName(user.name);
    if (user.email) setEmail(user.email);
    if (user.birthday) setBirthday(new Date(user.birthday));
  }, [user]);

  const onContinue = () => {
    let valid = true;

    setNameError('');
    setBirthdayError('');
    setEmailError('');

    if (!name.trim()) {
      setNameError('Full name is required.');
      valid = false;
    }

    if (!birthday) {
      setBirthdayError('Birthday is required.');
      valid = false;
    }

    if (!email.trim()) {
      setEmailError('Email is required.');
      valid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    if (!valid || isSaving) return;

    setIsSaving(true);
    http
      .put('/users/profile', {
        name: name.trim(),
        bio: bio.trim(),
        email: email.trim(),
        birthday,
      })
      .then((response) => {
        if (response.status === 200) {
          navigation.navigate('AuthStack_MeetingTypesScreen');
        } else {
          Alert.alert('Error', 'Failed to update profile. Please try again.');
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
              minHeight: contentHeight,
              paddingHorizontal: sidePadding,
              paddingTop: isCompactHeight ? 15 : 23,
              paddingBottom: Math.max(insets.bottom + 18, 28),
            },
          ]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.6}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.backButton}>
            <Image source={BackArrow} style={styles.backIcon} resizeMode="contain" />
          </TouchableOpacity>

          <Text
            style={[
              styles.title,
              {
                fontSize: titleSize,
                lineHeight: titleSize * 1.2,
                marginTop: isCompactHeight ? 29 : 51,
              },
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}>
            Fill in your profile details
          </Text>

          <View style={[styles.form, { marginTop: isCompactHeight ? 28 : 38 }]}>
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                placeholder="Full Name"
                placeholderTextColor="#A8B1BE"
                selectionColor="#171827"
                style={[styles.input, { height: inputHeight }]}
                onChangeText={(text) => {
                  setName(text);
                  setNameError('');
                }}
              />
              {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Enter short BIO</Text>
              <TextInput
                autoCapitalize="sentences"
                autoCorrect
                value={bio}
                placeholder="BIO"
                placeholderTextColor="#A8B1BE"
                selectionColor="#171827"
                style={[styles.input, { height: inputHeight }]}
                onChangeText={setBio}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Birthday</Text>
              <TouchableOpacity
                onPress={() => setShowBirthdayPicker(true)}
                activeOpacity={0.75}
                style={[styles.input, styles.dateInput, { height: inputHeight }]}>
                <Text style={[styles.inputText, !birthday && styles.placeholderText]}>
                  {birthday ? formatBirthday(birthday) : 'DD.MM.YYYY'}
                </Text>
              </TouchableOpacity>
              {!!birthdayError && <Text style={styles.errorText}>{birthdayError}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Enter email</Text>
              <TextInput
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Email"
                placeholderTextColor="#A8B1BE"
                selectionColor="#171827"
                style={[styles.input, { height: inputHeight }]}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError('');
                }}
              />
              {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
            </View>
          </View>

          <View style={styles.flexSpacer} />

          <TouchableOpacity
            onPress={onContinue}
            activeOpacity={0.8}
            disabled={isSaving}
            style={[
              styles.continueButton,
              {
                height: buttonHeight,
                opacity: isSaving ? 0.65 : 1,
              },
            ]}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {showBirthdayPicker && (
          <DateTimePicker
            value={birthday || new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, selectedDate) => {
              setShowBirthdayPicker(false);
              if (selectedDate) {
                setBirthday(selectedDate);
                setBirthdayError('');
              }
            }}
          />
        )}
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
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    height: 22,
    tintColor: '#171827',
    width: 22,
  },
  title: {
    color: '#171827',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
  },
  form: {
    width: '100%',
  },
  field: {
    marginBottom: 23,
  },
  label: {
    color: '#737B85',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  input: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7EBF0',
    borderRadius: 999,
    borderWidth: 1,
    color: '#171827',
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    letterSpacing: 0,
    paddingHorizontal: 39,
  },
  dateInput: {
    justifyContent: 'center',
  },
  inputText: {
    color: '#171827',
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    letterSpacing: 0,
  },
  placeholderText: {
    color: '#A8B1BE',
  },
  errorText: {
    color: '#EF4444',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  flexSpacer: {
    flex: 1,
    minHeight: 30,
  },
  continueButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#9BC425',
    borderRadius: 999,
    justifyContent: 'center',
  },
  continueText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: 0,
    lineHeight: 24,
  },
});

export default AuthStack_ProfileScreen;
