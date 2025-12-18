import React, { useEffect, useState, useCallback } from 'react';
import { Alert, ActivityIndicator } from 'react-native';
import Toast from '~/components/Toast';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import tw from '../../../tailwindcss';
import { AppStackParamList } from '.';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import { BackArrow, Background, Avatar, Settings } from '~/lib/images';
import DateTimePicker from '@react-native-community/datetimepicker';
import { http } from '~/helpers/http';
type Props = NativeStackScreenProps<
  AppStackParamList,
  'AppStack_ProfileScreen'
>;

const AppStack_ProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(new Date(1986, 7, 18)); // Default: 18.08.1986
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [email, setEmail] = useState('mail@mail.com');
  const [confirmEmail, setConfirmEmail] = useState('mail@mail.com');
  const [nameError, setNameError] = useState('');
  const [birthdayError, setBirthdayError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [confirmEmailError, setConfirmEmailError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useAtom(userAtom);
  
  // Fetch and update user profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await http.get('/users/profile');
      if (response.data) {
        setUser(response.data);
        // Update local state with fetched data
        if (response.data.name) setName(response.data.name);
        if (response.data.email) {
          setEmail(response.data.email);
          setConfirmEmail(response.data.email);
        }
        if (response.data.bio) setBio(response.data.bio);
        if (response.data.birthday) {
          setBirthday(new Date(response.data.birthday));
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, [setUser]);

  // Fetch profile on mount and when screen comes into focus
  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  useFocusEffect(
    useCallback(() => {
      fetchUserProfile();
    }, [fetchUserProfile])
  );
  const navigateToMainPage = () => {
    navigation.navigate('AppStack_HomePageScreen');
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
      .then(async response => {
        if (response.status === 200) {
          // Fetch updated profile and update atom
          await fetchUserProfile();
          setShowToast(true);
          setTimeout(() => {
            navigation.navigate('AppStack_HomePageScreen');
          }, 2000); // Navigate after toast is visible for 2 seconds
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

  const formatBirthday = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      <View style={tw`mt-16 mb-10 px-10`}>
        {/* Header with back arrow and settings */}
        <View style={tw`flex-row justify-between items-center -mb-2`}>
          <TouchableOpacity onPress={navigateToMainPage} activeOpacity={0.5}>
            <Image source={BackArrow} />
          </TouchableOpacity>
          <TouchableOpacity 
            activeOpacity={0.5}
            onPress={() => navigation.navigate('AppStack_SettingsScreen')}
          >
            <Image source={Settings} />
          </TouchableOpacity>
        </View>

        {/* Profile Picture */}
        <View style={tw`items-center mb-8`}>
          <View style={tw`w-[86px] h-[86px] rounded-full bg-white items-center justify-center shadow-sm`}>
            <Image source={Avatar} />
          </View>
        </View>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>Name</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            style={tw`bg-white rounded-full w-full h-13.5 self-center px-5 font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
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
            style={tw`bg-white rounded-full w-full h-13.5 self-center px-5 font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
            value={bio}
            onChangeText={setBio}
            placeholder="Text"
          />
          <View style={tw`mb-6`}></View>
        </View>
        <View style={tw``}>
          <Text style={tw`text-xs text-grey leading-[21px] mb-2`}>Birthday</Text>

          {/* Fake input container to match UI */}
          <TouchableOpacity
            onPress={() => setShowBirthdayPicker(true)}
            activeOpacity={0.7}
            style={tw`bg-white rounded-full w-full h-13.5 justify-center px-5`}
          >
            <Text style={tw`font-dm font-normal text-[14px] tracking-[0.5px] text-black`}>
              {birthday ? formatBirthday(birthday) : "18.08.1986"}
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
            style={tw`bg-white rounded-full w-full h-13.5 self-center px-5 font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
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
            style={tw`bg-white rounded-full w-full h-13.5 self-center px-5 font-dm font-normal text-[14px] font-bold tracking-[0.5px]`}
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
                Save
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Toast notification */}
      <Toast
        message="Profile has been updated successfully"
        visible={showToast}
        onHide={() => setShowToast(false)}
      />
    </View>
  );
};

export default AppStack_ProfileScreen;
