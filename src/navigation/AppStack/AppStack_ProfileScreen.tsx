import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAtom } from 'jotai';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import {
  BackArrow,
  Avatar,
  QRIcon,
  UserSettingsIcon,
  ThemeIcon,
  NotificationsIcon,
  SecurityIcon,
  PayIcon,
  CalendarIcon,
  BrainIcon,
  LogOutIcon,
  CheckIcon,
} from '~/lib/images';
import { http } from '~/helpers/http';
import { disconnectSocket } from '~/services/socketService';
import { navigationRef } from '~/index';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { userAtom } from '../../store';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ProfileScreen'>;

interface MenuItem {
  icon: number;
  label: string;
  onPress: () => void;
}

const APP_VERSION = '1.86';

const AppStack_ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useAtom(userAtom);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const fetchProfile = useCallback(async () => {
    try {
      const res = await http.get('/users/profile');
      if (res.data) setUser(res.data);
    } catch {}
  }, [setUser]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const doLogout = async () => {
    setShowLogoutModal(false);
    setIsLoggingOut(true);
    try {
      await http.post('/auth/logout').catch(() => {});
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
    } catch {
      resetUserAtom();
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'AuthStack' }] });
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems: MenuItem[] = [
    {
      icon: UserSettingsIcon,
      label: 'Profile Settings',
      onPress: () => navigation.navigate('AppStack_ProfileSettingsScreen'),
    },
    {
      icon: ThemeIcon,
      label: 'Application theme',
      onPress: () => navigation.navigate('AppStack_ApplicationThemeScreen'),
    },
    {
      icon: NotificationsIcon,
      label: 'Notifications',
      onPress: () => navigation.navigate('AppStack_NotificationSettingsScreen'),
    },
    {
      icon: SecurityIcon,
      label: 'Account & Security',
      onPress: () => navigation.navigate('AppStack_AccountSecurityScreen'),
    },
    {
      icon: PayIcon,
      label: 'Payments',
      onPress: () => navigation.navigate('AppStack_PaymentsScreen'),
    },
    {
      icon: CalendarIcon,
      label: 'Calendar Settings',
      onPress: () => navigation.navigate('AppStack_CalendarSettingsScreen'),
    },
    {
      icon: BrainIcon,
      label: 'AI Assistant',
      onPress: () => navigation.navigate('AppStack_AIAssistantScreen'),
    },
  ];

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center justify-between`,
          { marginTop: verticalScale(55), paddingHorizontal: '8%', marginBottom: verticalScale(20) },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
          Profile
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('AppStack_QRScannerScreen')} activeOpacity={0.7}>
          <Image source={QRIcon} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(60) }}
        showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={[tw`items-center`, { marginBottom: verticalScale(28) }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AppStack_ProfileSettingsScreen')}
            style={{ position: 'relative', marginBottom: verticalScale(12) }}>
            <View
              style={[
                tw`rounded-full overflow-hidden items-center justify-center`,
                { width: horizontalScale(88), height: horizontalScale(88), backgroundColor: colors.field },
              ]}>
              {(user as any)?.avatar ? (
                <Image source={{ uri: (user as any).avatar }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Image source={Avatar} style={{ width: horizontalScale(52), height: horizontalScale(52) }} />
              )}
            </View>
            <View
              style={[
                tw`absolute rounded-full items-center justify-center`,
                {
                  bottom: 2,
                  right: 2,
                  width: horizontalScale(22),
                  height: horizontalScale(22),
                  backgroundColor: colors.green,
                  borderWidth: 2,
                  borderColor: colors.pageBg,
                },
              ]}>
              <Text style={{ color: colors.white, fontSize: moderateScale(13), fontWeight: 'bold' }}>+</Text>
            </View>
          </TouchableOpacity>

          <View style={tw`flex-row items-center`}>
            <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(20) }]}>
              {(user as any)?.name || 'Your Name'}
            </Text>
            <View
              style={[
                tw`rounded-full items-center justify-center`,
                { width: horizontalScale(20), height: horizontalScale(20), backgroundColor: '#2D7FF9', marginLeft: horizontalScale(6) },
              ]}>
              <Image source={CheckIcon} style={{ width: horizontalScale(10), height: horizontalScale(10) }} tintColor={colors.white} />
            </View>
          </View>
        </View>

        {/* Menu items */}
        <View style={{ gap: verticalScale(8) }}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.7}
              onPress={item.onPress}
              style={[
                tw`flex-row items-center rounded-2xl`,
                { backgroundColor: colors.card, padding: moderateScale(16) },
              ]}>
              <Image source={item.icon} tintColor={colors.ink} style={{ width: horizontalScale(20), height: horizontalScale(20), marginRight: horizontalScale(14) }} resizeMode="contain" />
              <Text style={[tw`font-associate`, { color: colors.ink, fontSize: moderateScale(15) }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={[
            tw`text-center font-associate`,
            { color: colors.greyLight, fontSize: moderateScale(13), marginTop: verticalScale(20) },
          ]}>
          Application version {APP_VERSION}
        </Text>

        <TouchableOpacity
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.7}
          style={[tw`flex-row items-center justify-center`, { marginTop: verticalScale(16) }]}>
          <Image source={LogOutIcon} tintColor={colors.grey} style={{ width: horizontalScale(20), height: horizontalScale(20), marginRight: horizontalScale(8) }} resizeMode="contain" />
          <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(15) }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Log out confirmation modal */}
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
                  {
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    paddingVertical: verticalScale(14),
                  },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(15) }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doLogout}
                activeOpacity={0.7}
                disabled={isLoggingOut}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { backgroundColor: colors.ink, paddingVertical: verticalScale(14), opacity: isLoggingOut ? 0.6 : 1 },
                ]}>
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(15) }]}>
                    Log Out
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_ProfileScreen;
