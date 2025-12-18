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
import tw from '../../../tailwindcss';
import { AuthStackParamList } from '.';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import { BackArrow, Background } from '~/lib/images';
import DateTimePicker from '@react-native-community/datetimepicker';
import { http } from '~/helpers/http';
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
      <View style={tw`mt-10 mb-10 px-10`}>
        <TouchableOpacity onPress={navigateToMainPage} activeOpacity={0.5} style={tw`mb-5`}>
          <Image source={BackArrow} />
        </TouchableOpacity>
        <Text style={tw`text-[22px] font-bold font-dm w-2/3 leading-[32px] mb-7`}>Fill in your profile details</Text>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>Name</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            style={tw`bg-white rounded-full w-full h-13.5 self-center  font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
            value={name}
            onChangeText={(t) => { setName(t); setNameError(''); }}
            placeholder="Name"
          />
          {nameError ? (
            <Text style={tw`text-red-500 text-xs mb-3 mt-3`}>{nameError}</Text>
          ) : <View style={tw`mb-3 mt-3`} />}
        </View>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>BIO</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            style={tw`bg-white rounded-full w-full h-13.5 self-center  font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
            value={bio}
            onChangeText={setBio}
            placeholder="Bio"
          />
          <View style={tw`mb-6`}></View>
        </View>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>Birthday</Text>

          {/* Fake input container to match UI */}
          <TouchableOpacity
            onPress={() => setShowBirthdayPicker(true)}
            activeOpacity={0.7}
            style={tw`bg-white rounded-full w-full h-13.5 justify-center px-5 `}
          >
            <Text style={tw`font-dm font-normal text-[14px] tracking-[0.5px] text-black`}>
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
            <Text style={tw`text-red-500 text-xs mb-3 mt-3`}>{birthdayError}</Text>
          ) : <View style={tw`mb-3 mt-3`} />}
        </View>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>Email</Text>
          <TextInput
            style={tw`bg-white rounded-full w-full h-13.5 self-center  font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(t) => { setEmail(t); setEmailError(''); }}
            placeholder="Email"
          />

          {emailError ? (
            <Text style={tw`text-red-500 text-xs mb-3 mt-3`}>{emailError}</Text>
          ) : <View style={tw`mb-3 mt-3`} />}
        </View>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>Confirm Email</Text>
          <TextInput
            style={tw`bg-white rounded-full w-full h-13.5 self-center  font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
            value={confirmEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(t) => { setConfirmEmail(t); setConfirmEmailError(''); }}
            placeholder="Confirm Email"
          />

          {confirmEmailError ? (
            <Text style={tw`text-red-500 text-xs mb-3 mt-3`}>{confirmEmailError}</Text>
          ) : <View style={tw`mb-3 mt-3`} />}
        </View>
      </View>
      <View style={tw`absolute bottom-0 w-full flex-col items-center`}>
        <TouchableOpacity 
          onPress={navigateToPlanPage} 
          activeOpacity={0.7}
          disabled={isSaving}
        >
          <View
            style={tw`bg-[#A3CB31] rounded-full h-15 w-60 mb-10 justify-center items-center shadow-lg ${isSaving ? 'opacity-50' : ''}`}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={tw`text-white text-base font-bold font-dm`}>
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
