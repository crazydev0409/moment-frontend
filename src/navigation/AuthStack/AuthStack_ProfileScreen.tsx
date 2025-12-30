import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '~/tailwindcss';
import { AuthStackParamList } from '.';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import { BackArrow, Background } from '~/lib/images';
import DateTimePicker from '@react-native-community/datetimepicker';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
type Props = NativeStackScreenProps<
  AuthStackParamList,
  'AuthStack_ProfileScreen'
>;

const AuthStack_ProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [birthdayError, setBirthdayError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [confirmEmailError, setConfirmEmailError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [user] = useAtom(userAtom);
  useEffect(() => {
    if (user.name) setName(user.name);
    if (user.email) setEmail(user.email);
  }, [user]);
  const navigateToMainPage = () => {
    navigation.navigate('AppStack');
  };
  const navigateToPlanPage = () => {
    let valid = true;

    // Reset before validating
    setNameError('');
    setBirthdayError('');
    setEmailError('');
    setConfirmEmailError('');

    // --- Name required ---
    if (!name.trim()) {
      setNameError("Name is required.");
      valid = false;
    }

    // --- Birthday required ---
    if (!birthday) {
      setBirthdayError("Birthday is required.");
      valid = false;
    }

    // --- Email required ---
    if (!email.trim()) {
      setEmailError("Email is required.");
      valid = false;
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    // --- Confirm Email required ---
    if (!confirmEmail.trim()) {
      setConfirmEmailError("Confirm Email is required.");
      valid = false;
    }

    // Emails must match
    if (email && confirmEmail && email !== confirmEmail) {
      setConfirmEmailError("Emails do not match.");
      valid = false;
    }

    if (!valid) return;
    if (isSaving) return;

    const payload = {
      name, bio, email, birthday
    }

    setIsSaving(true);
    http.put('/users/profile', payload)
      .then(response => {
        if (response.status === 200) {
          navigation.navigate('AuthStack_MeetingTypesScreen');
        } else {
          Alert.alert('Error', 'Failed to update profile. Please try again.');
        }
      })
      .catch(error => {
        console.log({ error });
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      <View style={[{ marginTop: verticalScale(37.5), marginBottom: verticalScale(37.5) }, { paddingHorizontal: '8%' }]}>
        <TouchableOpacity onPress={navigateToMainPage} activeOpacity={0.5} style={{ marginBottom: verticalScale(18.75) }}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={[tw`font-bold font-dm w-2/3`, { fontSize: moderateScale(20.625), lineHeight: moderateScale(30), marginBottom: verticalScale(26.25) }]}>Fill in your profile details</Text>
        <View style={tw``}>
          <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25), lineHeight: moderateScale(19.6875), marginBottom: verticalScale(7.5) }]}>Name</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            style={[tw`bg-white rounded-full w-full self-center font-dm font-normal font-bold`, { height: verticalScale(50.625), fontSize: moderateScale(13.125), letterSpacing: horizontalScale(0.375), paddingHorizontal: horizontalScale(19), }]}
            value={name}
            onChangeText={(t) => { setName(t); setNameError(''); }}
            placeholder="Name"
          />
          {nameError ? (
            <Text style={[tw`text-red-500`, { fontSize: moderateScale(11.25), marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }]}>{nameError}</Text>
          ) : <View style={{ marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }} />}
        </View>
        <View style={tw``}>
          <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25), lineHeight: moderateScale(19.6875), marginBottom: verticalScale(7.5) }]}>BIO</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            style={[tw`bg-white rounded-full w-full self-center font-dm font-normal font-bold`, { height: verticalScale(50.625), fontSize: moderateScale(13.125), letterSpacing: horizontalScale(0.375), paddingHorizontal: horizontalScale(19), }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Bio"
          />
          <View style={{ marginBottom: verticalScale(22.5) }}></View>
        </View>
        <View style={tw``}>
          <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25), lineHeight: moderateScale(19.6875), marginBottom: verticalScale(7.5) }]}>Birthday</Text>

          {/* Fake input container to match UI */}
          <TouchableOpacity
            onPress={() => setShowBirthdayPicker(true)}
            activeOpacity={0.7}
            style={[tw`bg-white rounded-full w-full justify-center`, { height: verticalScale(50.625), paddingHorizontal: horizontalScale(18.75) }]}
          >
            <Text style={[tw`font-dm font-normal text-black`, { fontSize: moderateScale(13.125), letterSpacing: horizontalScale(0.375) }]}>
              {birthday ? birthday.toLocaleDateString() : "Select Birthday"}
            </Text>
          </TouchableOpacity>

          {showBirthdayPicker && (
            <DateTimePicker
              value={birthday || new Date()}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                setShowBirthdayPicker(false);
                if (selectedDate) { setBirthday(selectedDate); setBirthdayError(''); };
              }}
            />
          )}

          {birthdayError ? (
            <Text style={[tw`text-red-500`, { fontSize: moderateScale(11.25), marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }]}>{birthdayError}</Text>
          ) : <View style={{ marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }} />}
        </View>
        <View style={tw``}>
          <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25), lineHeight: moderateScale(19.6875), marginBottom: verticalScale(7.5) }]}>Email</Text>
          <TextInput
            style={[tw`bg-white rounded-full w-full self-center font-dm font-normal font-bold`, { height: verticalScale(50.625), fontSize: moderateScale(13.125), letterSpacing: horizontalScale(0.375), paddingHorizontal: horizontalScale(19), }]}
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(t) => { setEmail(t); setEmailError(''); }}
            placeholder="Email"
          />

          {emailError ? (
            <Text style={[tw`text-red-500`, { fontSize: moderateScale(11.25), marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }]}>{emailError}</Text>
          ) : <View style={{ marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }} />}
        </View>
        <View style={tw``}>
          <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25), lineHeight: moderateScale(19.6875), marginBottom: verticalScale(7.5) }]}>Confirm Email</Text>
          <TextInput
            style={[tw`bg-white rounded-full w-full self-center font-dm font-normal font-bold`, { height: verticalScale(50.625), fontSize: moderateScale(13.125), letterSpacing: horizontalScale(0.375), paddingHorizontal: horizontalScale(19) }]}
            value={confirmEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(t) => { setConfirmEmail(t); setConfirmEmailError(''); }}
            placeholder="Confirm Email"
          />

          {confirmEmailError ? (
            <Text style={[tw`text-red-500`, { fontSize: moderateScale(11.25), marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }]}>{confirmEmailError}</Text>
          ) : <View style={{ marginBottom: verticalScale(11.25), marginTop: verticalScale(11.25) }} />}
        </View>
      </View>
      <View style={tw`absolute bottom-0 w-full flex-col items-center`}>
        <TouchableOpacity
          onPress={navigateToPlanPage}
          activeOpacity={0.7}
          disabled={isSaving}
        >
          <View
            style={[tw`bg-[#A3CB31] rounded-full justify-center items-center shadow-lg ${isSaving ? 'opacity-50' : ''}`, { height: verticalScale(56.25), width: horizontalScale(225), marginBottom: verticalScale(37.5) }]}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
                Next
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default AuthStack_ProfileScreen;
