import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_NotificationSettingsScreen'>;

const SYSTEM_KEY = '@notif_system';
const MAIL_KEY = '@notif_mail';

const AppStack_NotificationSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [mailNotifications, setMailNotifications] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SYSTEM_KEY),
      AsyncStorage.getItem(MAIL_KEY),
    ]).then(([sys, mail]) => {
      if (sys !== null) setSystemNotifications(sys === 'true');
      if (mail !== null) setMailNotifications(mail === 'true');
    });
  }, []);

  const handleSystemChange = async (val: boolean) => {
    setSystemNotifications(val);
    await AsyncStorage.setItem(SYSTEM_KEY, String(val));
  };

  const handleMailChange = async (val: boolean) => {
    setMailNotifications(val);
    await AsyncStorage.setItem(MAIL_KEY, String(val));
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: v(55), marginBottom: v(20), paddingHorizontal: '8%' },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: h(24), height: h(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(18.75) }]}>
            Notifications
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: '8%', gap: v(10) }}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleSystemChange(!systemNotifications)}
          style={[
            tw`flex-row items-center justify-between rounded-2xl`,
            { backgroundColor: colors.card, paddingHorizontal: h(18), paddingVertical: v(16) },
          ]}>
          <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
            Notifications in the system
          </Text>
          <Switch
            value={systemNotifications}
            onValueChange={handleSystemChange}
            trackColor={{ false: colors.border, true: colors.green }}
            thumbColor={colors.white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleMailChange(!mailNotifications)}
          style={[
            tw`flex-row items-center justify-between rounded-2xl`,
            { backgroundColor: colors.card, paddingHorizontal: h(18), paddingVertical: v(16) },
          ]}>
          <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
            Notifications by mail
          </Text>
          <Switch
            value={mailNotifications}
            onValueChange={handleMailChange}
            trackColor={{ false: colors.border, true: colors.green }}
            thumbColor={colors.white}
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default AppStack_NotificationSettingsScreen;
