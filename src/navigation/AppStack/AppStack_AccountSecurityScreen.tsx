import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAtom } from 'jotai';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';
import { disconnectSocket } from '~/services/socketService';
import { userAtom } from '../../store';
import { navigationRef } from '~/index';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_AccountSecurityScreen'>;
type VisibilityOption = 'public' | 'contacts' | 'only_me';

const visibilityOptions: { key: VisibilityOption; label: string; subtitle: string }[] = [
  { key: 'public', label: 'Public', subtitle: 'Visible to everyone on the platform' },
  { key: 'contacts', label: 'Contacts', subtitle: 'Visible to your contacts only' },
  { key: 'only_me', label: 'Only me', subtitle: 'Hidden from others and visible only to you' },
];

const RadioRow = ({
  label,
  subtitle,
  selected,
  onPress,
  showDivider,
}: {
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  showDivider: boolean;
}) => (
  <>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        tw`flex-row items-center justify-between`,
        { paddingVertical: v(16), paddingHorizontal: h(18) },
      ]}>
      <View style={tw`flex-1`}>
        <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(15) }]}>
          {label}
        </Text>
        <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(12.5), marginTop: v(2) }]}>
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          width: h(22),
          height: h(22),
          borderRadius: h(11),
          borderWidth: 2,
          borderColor: selected ? colors.green : colors.border,
          backgroundColor: selected ? colors.green : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: h(12),
        }}>
        {selected && (
          <View
            style={{ width: h(8), height: h(8), borderRadius: h(4), backgroundColor: colors.white }}
          />
        )}
      </View>
    </TouchableOpacity>
    {showDivider && (
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: h(18) }} />
    )}
  </>
);

const VISIBILITY_KEY = '@profile_visibility';

const AppStack_AccountSecurityScreen: React.FC<Props> = ({ navigation }) => {
  const [visibility, setVisibility] = useState<VisibilityOption>('public');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(VISIBILITY_KEY).then((val) => {
      if (val === 'public' || val === 'contacts' || val === 'only_me') setVisibility(val);
    });
  }, []);

  const handleVisibilityChange = async (val: VisibilityOption) => {
    setVisibility(val);
    await AsyncStorage.setItem(VISIBILITY_KEY, val);
  };
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
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
            Account & Security
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(120) }}
        showsVerticalScrollIndicator={false}>
        <Text
          style={[
            tw`font-associate-bold`,
            { color: colors.ink, fontSize: ms(16), marginBottom: v(12) },
          ]}>
          Profile visibility
        </Text>

        <View style={[tw`rounded-2xl overflow-hidden`, { backgroundColor: colors.card }]}>
          {visibilityOptions.map((opt, idx) => (
            <RadioRow
              key={opt.key}
              label={opt.label}
              subtitle={opt.subtitle}
              selected={visibility === opt.key}
              onPress={() => handleVisibilityChange(opt.key)}
              showDivider={idx < visibilityOptions.length - 1}
            />
          ))}
        </View>
      </ScrollView>

      {/* Delete Account button pinned to bottom */}
      <View
        style={[
          tw`absolute left-0 right-0`,
          {
            bottom: 0,
            paddingHorizontal: '8%',
            paddingTop: v(12),
            paddingBottom: v(Platform.OS === 'ios' ? 34 : 24),
            backgroundColor: colors.pageBg,
          },
        ]}>
        <TouchableOpacity
          onPress={() => setShowDeleteModal(true)}
          activeOpacity={0.7}
          disabled={isDeletingAccount}
          style={[
            tw`rounded-full items-center justify-center`,
            { backgroundColor: colors.grey, paddingVertical: v(15) },
          ]}>
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(16) }]}>
              Delete Account
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Delete account modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={[tw`flex-1 items-center justify-center`, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <View
            style={[
              tw`rounded-3xl`,
              { backgroundColor: colors.card, padding: ms(24), marginHorizontal: '8%', width: '84%' },
            ]}>
            <Text
              style={[
                tw`font-associate-bold text-center`,
                { color: colors.ink, fontSize: ms(20), marginBottom: v(8) },
              ]}>
              Delete account?
            </Text>
            <Text
              style={[
                tw`font-associate text-center`,
                { color: colors.grey, fontSize: ms(14), marginBottom: v(24) },
              ]}>
              This action cannot be undone. Your account and data will be permanently deleted.
            </Text>
            <View style={[tw`flex-row`, { gap: h(12) }]}>
              <TouchableOpacity
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { borderWidth: 1.5, borderColor: colors.green, paddingVertical: v(14) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: ms(15) }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doDeleteAccount}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 rounded-full items-center`,
                  { backgroundColor: colors.grey, paddingVertical: v(14) },
                ]}>
                <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
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

export default AppStack_AccountSecurityScreen;
