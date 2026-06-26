import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Background } from '~/lib/images';
import { http } from '~/helpers/http';
import { disconnectSocket } from '~/services/socketService';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import { navigationRef } from '~/index';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_SettingsScreen'>;

const AppStack_SettingsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [lightTheme, setLightTheme] = useState(true);
  const [darkTheme, setDarkTheme] = useState(false);
  const [autoTheme, setAutoTheme] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState(false);
  const [mailNotifications, setMailNotifications] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [, setUser] = useAtom(userAtom);

  const resetUserAtom = () => {
    setUser({
      id: '',
      name: '',
      email: '',
      phoneNumber: '',
      avatar: '',
      timezone: 'UTC',
      birthday: '',
      bio: '',
      meetingTypes: [],
      verified: false,
    });
  };

  const navigateToProfile = () => {
    navigation.navigate('AppStack_ProfileScreen');
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    if (theme === 'light') {
      setLightTheme(true);
      setDarkTheme(false);
      setAutoTheme(false);
    } else if (theme === 'dark') {
      setLightTheme(false);
      setDarkTheme(true);
      setAutoTheme(false);
    } else {
      setLightTheme(false);
      setDarkTheme(false);
      setAutoTheme(true);
    }
  };

  const doLogout = async () => {
    setShowLogoutModal(false);
    setIsLoggingOut(true);
    try {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      delete http.defaults.headers.common['Authorization'];
      disconnectSocket();
      resetUserAtom();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
      } else {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error during logout:', error);
      resetUserAtom();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const doDeleteAccount = async () => {
    setShowDeleteModal(false);
    setIsDeletingAccount(true);
    try {
      await http.delete('/users/account');
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      delete http.defaults.headers.common['Authorization'];
      disconnectSocket();
      resetUserAtom();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
      } else {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={tw`pb-10`}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            { marginTop: verticalScale(60), marginBottom: verticalScale(37.5) },
            { paddingHorizontal: '8%' },
          ]}>
          {/* Header */}
          <View style={[tw`flex-row items-center relative`, { marginBottom: verticalScale(30) }]}>
            <TouchableOpacity
              onPress={navigateToProfile}
              activeOpacity={0.5}
              style={tw`absolute left-0 z-10`}>
              <Image
                source={BackArrow}
                style={{ width: horizontalScale(24), height: horizontalScale(24) }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text
              style={[
                tw`font-associate-bold text-black flex-1 text-center`,
                { fontSize: moderateScale(22.5) },
              ]}>
              Settings
            </Text>
          </View>

          {/* Application Theme Section */}
          <View style={{ marginBottom: verticalScale(22.5) }}>
            <Text
              style={[
                tw`font-associate-bold text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) },
              ]}>
              Application theme
            </Text>
            <View style={tw`bg-white rounded-2xl overflow-hidden`}>
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between border-b border-gray-100`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => handleThemeChange('light')}>
                <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(15) }]}>Light</Text>
                <Switch
                  value={lightTheme}
                  onValueChange={() => handleThemeChange('light')}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={lightTheme ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between border-b border-gray-100`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => handleThemeChange('dark')}>
                <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(15) }]}>Dark</Text>
                <Switch
                  value={darkTheme}
                  onValueChange={() => handleThemeChange('dark')}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={darkTheme ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => handleThemeChange('auto')}>
                <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(15) }]}>
                  Automatically
                </Text>
                <Switch
                  value={autoTheme}
                  onValueChange={() => handleThemeChange('auto')}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={autoTheme ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Notifications Section */}
          <View style={{ marginBottom: verticalScale(22.5) }}>
            <Text
              style={[
                tw`font-associate-bold text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) },
              ]}>
              Notifications
            </Text>
            <View style={tw`bg-white rounded-2xl overflow-hidden`}>
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between border-b border-gray-100`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => setSystemNotifications(!systemNotifications)}>
                <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(15) }]}>
                  Notifications in the system
                </Text>
                <Switch
                  value={systemNotifications}
                  onValueChange={setSystemNotifications}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={systemNotifications ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => setMailNotifications(!mailNotifications)}>
                <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(15) }]}>
                  Notifications by mail
                </Text>
                <Switch
                  value={mailNotifications}
                  onValueChange={setMailNotifications}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={mailNotifications ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Application Version */}
          <View style={[tw`items-center`, { marginTop: verticalScale(15) }]}>
            <Text style={[tw`font-associate text-grey`, { fontSize: moderateScale(13.125) }]}>
              Application version 1.86
            </Text>
          </View>

          {/* Logout */}
          <View style={{ marginTop: verticalScale(30) }}>
            <TouchableOpacity
              style={tw`bg-white rounded-2xl overflow-hidden`}
              activeOpacity={0.7}
              onPress={() => setShowLogoutModal(true)}
              disabled={isLoggingOut || isDeletingAccount}>
              <View
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}>
                <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(15) }]}>
                  Logout
                </Text>
                {isLoggingOut ? <ActivityIndicator size="small" color="#000000" /> : null}
              </View>
            </TouchableOpacity>
          </View>

          {/* Delete Account */}
          <View style={{ marginTop: verticalScale(15), marginBottom: verticalScale(30) }}>
            <TouchableOpacity
              style={tw`bg-white rounded-2xl overflow-hidden border border-red-500`}
              activeOpacity={0.7}
              onPress={() => setShowDeleteModal(true)}
              disabled={isLoggingOut || isDeletingAccount}>
              <View
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}>
                <Text style={[tw`font-associate text-red-500`, { fontSize: moderateScale(15) }]}>
                  Delete Account
                </Text>
                {isDeletingAccount ? <ActivityIndicator size="small" color="#EF4444" /> : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Log out modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <View
            style={[
              tw`rounded-3xl`,
              {
                backgroundColor: colors.card,
                padding: moderateScale(24),
                marginHorizontal: '8%',
                width: '84%',
              },
            ]}>
            <Text
              style={[
                tw`font-associate-bold text-center`,
                { color: colors.ink, fontSize: moderateScale(20), marginBottom: verticalScale(8) },
              ]}>
              Log out?
            </Text>
            <Text
              style={[
                tw`font-associate text-center`,
                { color: colors.grey, fontSize: moderateScale(14), marginBottom: verticalScale(24) },
              ]}>
              You'll need to sign in again to access your account.
            </Text>
            <View style={[tw`flex-row`, { gap: horizontalScale(12) }]}>
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { borderWidth: 1.5, borderColor: colors.border, paddingVertical: verticalScale(14) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(15) }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doLogout}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { backgroundColor: colors.ink, paddingVertical: verticalScale(14) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(15) }]}>
                  Log Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete account modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <View
            style={[
              tw`rounded-3xl`,
              {
                backgroundColor: colors.card,
                padding: moderateScale(24),
                marginHorizontal: '8%',
                width: '84%',
              },
            ]}>
            <Text
              style={[
                tw`font-associate-bold text-center`,
                { color: colors.ink, fontSize: moderateScale(20), marginBottom: verticalScale(8) },
              ]}>
              Delete account?
            </Text>
            <Text
              style={[
                tw`font-associate text-center`,
                { color: colors.grey, fontSize: moderateScale(14), marginBottom: verticalScale(24) },
              ]}>
              This action cannot be undone. All your data, hooks, and meeting history will be permanently deleted.
            </Text>
            <View style={[tw`flex-row`, { gap: horizontalScale(12) }]}>
              <TouchableOpacity
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { borderWidth: 1.5, borderColor: colors.green, paddingVertical: verticalScale(14) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: moderateScale(15) }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doDeleteAccount}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { backgroundColor: '#4A4A4A', paddingVertical: verticalScale(14) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(15) }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_SettingsScreen;
