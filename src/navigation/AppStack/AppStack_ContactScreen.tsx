import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as Contacts from 'expo-contacts';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { Avatar, NotificationsIcon, SearchIcon, HookIcon, UserIcon, CheckIcon, BrainIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { hashPhoneNumber } from '~/utils/phoneHash';
import { resolveContactAvatarUri, useDeviceContactAvatarMap } from '~/helpers/contactAvatars';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ContactScreen'>;

interface BackendContact {
  id: string;
  displayName: string;
  contactPhone?: string;
  autoConfirm?: boolean;
  contactUser?: { id: string; name: string; avatar?: string | null; accountType?: string | null } | null;
  contactUserId?: string | null;
}

interface DisplayContact {
  id: string;
  name: string;
  imageUri?: string;
  backend: BackendContact;
  isRegistered: boolean;
}

const AppStack_ContactScreen: React.FC<Props> = ({ navigation }) => {
  const [contacts, setContacts] = useState<DisplayContact[]>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  // This is the one screen responsible for actually prompting for Contacts
  // access — every other screen just reads whatever's already granted.
  const { refreshAvatarMap } = useDeviceContactAvatarMap({ requestPermission: true });

  const loadContacts = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);

      const { status: existingStatus } = await Contacts.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Contacts.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        try {
          const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          });
          const importable = data
            .filter((c) => c.name && c.phoneNumbers?.length)
            .map((c) => ({
              phoneNumber: c.phoneNumbers![0].number || '',
              displayName: c.name || 'Unknown',
              phoneBookId: c.id,
            }))
            .filter((c) => c.phoneNumber);
          if (importable.length > 0) {
            await http.post('/users/contacts/import', { contacts: importable });
          }
        } catch {
          // silent — background import failure is non-critical
        }
      }

      // Refresh (rather than just read) the shared device-contact-photo map
      // so it reflects a permission grant/import that may have just happened.
      const currentAvatarMap = await refreshAvatarMap();

      const res = await http.get('/users/contacts');
      const backendContacts: BackendContact[] = res.data.contacts || [];

      const formatted: DisplayContact[] = await Promise.all(
        backendContacts.map(async (bc) => {
          // Contact.contactPhone is stored as plain E.164 server-side
          // (unlike User.phoneNumber, which is hashed), so it must be
          // hashed the same way as every other lookup key before it can
          // match the device-contact-photo map.
          let hashedContactPhone: string | undefined;
          if (bc.contactPhone) {
            const normalized = bc.contactPhone.replace(/[\s\-()]/g, '');
            if (normalized) hashedContactPhone = await hashPhoneNumber(normalized);
          }
          return {
            id: bc.id,
            name: bc.displayName || 'Unknown',
            imageUri:
              resolveContactAvatarUri(currentAvatarMap, hashedContactPhone, bc.contactUser?.avatar) ||
              undefined,
            backend: bc,
            isRegistered: !!(bc.contactUserId || bc.contactUser?.id),
          };
        })
      );

      formatted.sort((a, b) => {
        if (a.isRegistered !== b.isRegistered) return a.isRegistered ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(formatted);

      try {
        const notifRes = await http.get('/users/notifications');
        const notifs = notifRes.data.notifications || [];
        setNotifCount(notifs.filter((n: any) => !n.isRead).length);
      } catch {}
    } catch (err) {
      console.error('loadContacts error:', err);
      Alert.alert('Error', 'Failed to load contacts.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [refreshAvatarMap]);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadContacts(false);
  }, [loadContacts]);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleContactPress = (c: DisplayContact) => {
    navigation.navigate('AppStack_ContactProfileScreen', {
      contactId: c.backend.id,
      contactUserId: c.backend.contactUserId || c.backend.contactUser?.id,
      contactName: c.name,
    });
  };

  const handleHookIconPress = (c: DisplayContact) => {
    navigation.navigate('AppStack_ContactProfileScreen', {
      contactId: c.backend.id,
      contactUserId: c.backend.contactUserId || c.backend.contactUser?.id,
      contactName: c.name,
    });
  };

  const HookCircleIcon = () => (
    <View
      style={[
        tw`rounded-full items-center justify-center`,
        {
          width: horizontalScale(40),
          height: horizontalScale(40),
          backgroundColor: colors.greenTint,
        },
      ]}>
      <Image source={HookIcon} style={{ width: horizontalScale(20), height: horizontalScale(20) }} tintColor={colors.greenText} />
    </View>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        {/* Header */}
        <View
          style={[
            tw`flex-row items-center justify-between`,
            { marginTop: verticalScale(58), paddingHorizontal: '8%', marginBottom: verticalScale(18) },
          ]}>
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(28) }]}>
            Contacts
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AppStack_NotificationScreen')}
            activeOpacity={0.7}
            style={{ position: 'relative' }}>
            <View
              style={[
                tw`rounded-full items-center justify-center`,
                {
                  width: horizontalScale(46),
                  height: horizontalScale(46),
                  backgroundColor: colors.card,
                },
              ]}>
              <Image
                  source={NotificationsIcon}
                  style={{ width: horizontalScale(22), height: horizontalScale(22) }}
                  tintColor={colors.ink}
                />
            </View>
            {notifCount > 0 && (
              <View
                style={[
                  tw`absolute rounded-full items-center justify-center`,
                  {
                    top: -2,
                    right: -2,
                    width: horizontalScale(18),
                    height: horizontalScale(18),
                    backgroundColor: colors.green,
                  },
                ]}>
                <Text
                  style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(10) }]}>
                  {notifCount > 9 ? '9+' : notifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: verticalScale(120) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.green} />
          }>
          {/* Search bar */}
          <View
            style={[
              tw`flex-row items-center rounded-2xl`,
              {
                backgroundColor: colors.card,
                paddingHorizontal: horizontalScale(16),
                paddingVertical: verticalScale(12),
                marginBottom: verticalScale(16),
              },
            ]}>
            <TextInput
              style={[tw`flex-1 font-associate`, { color: colors.ink, fontSize: moderateScale(14) }]}
              placeholder="Search contacts"
              placeholderTextColor={colors.placeholder}
              value={searchText}
              onChangeText={setSearchText}
            />
            <Image source={SearchIcon} style={{ width: horizontalScale(18), height: horizontalScale(18) }} tintColor={colors.grey} />
          </View>

          {/* Invite CTA */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[tw`flex-row items-center`, { marginBottom: verticalScale(16) }]}>
            <Image source={UserIcon} style={{ width: horizontalScale(16), height: horizontalScale(16), marginRight: horizontalScale(6) }} tintColor={colors.greenText} />
            <Text style={[tw`font-associate-bold`, { color: colors.greenText, fontSize: moderateScale(15) }]}>Invite</Text>
          </TouchableOpacity>

          {/* Contacts list */}
          {isLoading ? (
            <View style={{ paddingTop: verticalScale(60), alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          ) : filtered.length === 0 ? (
            <Text
              style={[
                tw`text-center font-associate`,
                { color: colors.grey, paddingVertical: verticalScale(40), fontSize: moderateScale(14) },
              ]}>
              {searchText ? 'No contacts found' : 'No contacts yet'}
            </Text>
          ) : (
            (() => {
              const registered = filtered.filter((c) => c.isRegistered);
              const unregistered = filtered.filter((c) => !c.isRegistered);
              const renderCard = (contact: DisplayContact) => (
                <TouchableOpacity
                  key={contact.id}
                  activeOpacity={contact.isRegistered ? 0.7 : 1}
                  onPress={() => contact.isRegistered && handleContactPress(contact)}
                  style={[
                    tw`flex-row items-center rounded-2xl`,
                    {
                      backgroundColor: contact.isRegistered ? colors.card : colors.field,
                      padding: horizontalScale(14),
                      marginBottom: verticalScale(10),
                    },
                  ]}>
                  {/* Avatar */}
                  <View style={{ position: 'relative', marginRight: horizontalScale(14) }}>
                    <View
                      style={[
                        tw`rounded-full overflow-hidden items-center justify-center`,
                        {
                          width: horizontalScale(52),
                          height: horizontalScale(52),
                          backgroundColor: contact.isRegistered ? colors.field : colors.border,
                        },
                      ]}>
                      {contact.imageUri ? (
                        <Image
                          source={{ uri: contact.imageUri }}
                          style={{ width: horizontalScale(52), height: horizontalScale(52) }}
                        />
                      ) : (
                        <Image
                          source={Avatar}
                          style={{ width: horizontalScale(32), height: horizontalScale(32) }}
                          tintColor={contact.isRegistered ? undefined : colors.greyLight}
                        />
                      )}
                    </View>
                    {contact.isRegistered && (
                      <View
                        style={[
                          tw`absolute rounded-full items-center justify-center`,
                          {
                            bottom: 0,
                            right: 0,
                            width: horizontalScale(18),
                            height: horizontalScale(18),
                            backgroundColor: contact.backend.contactUser?.accountType === 'agent' ? colors.ink : '#2D7FF9',
                            borderWidth: 1.5,
                            borderColor: colors.card,
                          },
                        ]}>
                        <Image
                          source={contact.backend.contactUser?.accountType === 'agent' ? BrainIcon : CheckIcon}
                          style={{ width: horizontalScale(9), height: horizontalScale(9) }}
                          tintColor={colors.white}
                        />
                      </View>
                    )}
                  </View>

                  {/* Name */}
                  <Text
                    numberOfLines={1}
                    style={[
                      tw`flex-1 font-associate-bold`,
                      { color: contact.isRegistered ? colors.ink : colors.greyLight, fontSize: moderateScale(15) },
                    ]}>
                    {contact.name}
                  </Text>

                  {/* Action */}
                  {contact.isRegistered && (
                    <TouchableOpacity onPress={() => handleHookIconPress(contact)} activeOpacity={0.7}>
                      <HookCircleIcon />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
              return (
                <>
                  {registered.map(renderCard)}
                  {unregistered.map(renderCard)}
                </>
              );
            })()
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AppStack_ContactScreen;
