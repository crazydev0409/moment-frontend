import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
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
  CalendarGearIcon,
  BrainIcon,
  LogOutIcon,
} from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { userAtom } from '../../store';
import Toast from '~/components/Toast';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ProfileScreen'>;

interface MenuItem {
  icon: number;
  label: string;
  onPress: () => void;
}

const APP_VERSION = '1.86';

const AppStack_ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [user, setUser] = useAtom(userAtom);
  const [showLogoutToast, setShowLogoutToast] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await http.get('/users/profile');
      if (res.data) setUser(res.data);
    } catch {}
  }, [setUser]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await http.post('/auth/logout').catch(() => {});
          } finally {
            // Clear token and navigate to auth
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.removeItem('accessToken');
            navigation.reset({ index: 0, routes: [{ name: 'AppStack_HomePageScreen' }] });
          }
        },
      },
    ]);
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
      onPress: () => Alert.alert('Coming soon', 'Theme settings are coming soon.'),
    },
    {
      icon: NotificationsIcon,
      label: 'Notifications',
      onPress: () => navigation.navigate('AppStack_NotificationScreen'),
    },
    {
      icon: SecurityIcon,
      label: 'Account & Security',
      onPress: () => navigation.navigate('AppStack_SettingsScreen'),
    },
    {
      icon: PayIcon,
      label: 'Payments',
      onPress: () => Alert.alert('Coming soon', 'Payment settings are coming soon.'),
    },
    {
      icon: CalendarGearIcon,
      label: 'Calendar Settings',
      onPress: () => navigation.navigate('AppStack_CalendarSettingsScreen'),
    },
    {
      icon: BrainIcon,
      label: 'AI Assistant',
      onPress: () => Alert.alert('Coming soon', 'AI Assistant is coming soon.'),
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
        <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(18.75) }]}>
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
            <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(20) }]}>
              {(user as any)?.name || 'Your Name'}
            </Text>
            <View
              style={[
                tw`rounded-full items-center justify-center`,
                { width: horizontalScale(20), height: horizontalScale(20), backgroundColor: '#2D7FF9', marginLeft: horizontalScale(6) },
              ]}>
              <Text style={{ color: colors.white, fontSize: moderateScale(10), fontWeight: 'bold' }}>✓</Text>
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
              <Text style={[tw`font-dm`, { color: colors.ink, fontSize: moderateScale(15) }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text
          style={[
            tw`text-center font-dm`,
            { color: colors.greyLight, fontSize: moderateScale(13), marginTop: verticalScale(20) },
          ]}>
          Application version {APP_VERSION}
        </Text>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.7}
          style={[tw`flex-row items-center justify-center`, { marginTop: verticalScale(16) }]}>
          <Image source={LogOutIcon} tintColor={colors.grey} style={{ width: horizontalScale(20), height: horizontalScale(20), marginRight: horizontalScale(8) }} resizeMode="contain" />
          <Text style={[tw`font-dm`, { color: colors.grey, fontSize: moderateScale(15) }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Toast message="Logged out" visible={showLogoutToast} onHide={() => setShowLogoutToast(false)} />
    </View>
  );
};

export default AppStack_ProfileScreen;
