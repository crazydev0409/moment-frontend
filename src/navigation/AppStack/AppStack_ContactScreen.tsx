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
import { Avatar } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { hashPhoneNumber } from '~/utils/phoneHash';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ContactScreen'>;

interface BackendContact {
  id: string;
  displayName: string;
  contactPhone?: string;
  autoConfirm?: boolean;
  contactUser?: { id: string; name: string; avatar?: string | null } | null;
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
  const [notifCount] = useState(0);

  const loadContacts = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setIsLoading(true);

      const { status: existingStatus } = await Contacts.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Contacts.requestPermissionsAsync();
        finalStatus = status;
      }

      const phoneToAvatarMap = new Map<string, string>();

      if (finalStatus === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.Image, Contacts.Fields.PhoneNumbers],
        });

        await Promise.all(
          data.map(async (c) => {
            if (c.phoneNumbers && c.image?.uri) {
              await Promise.all(
                c.phoneNumbers.map(async (p) => {
                  const norm = p.number?.replace(/[\s\-\(\)]/g, '') || '';
                  if (norm) {
                    const hashed = await hashPhoneNumber(norm);
                    phoneToAvatarMap.set(hashed, c.image!.uri!);
                  }
                })
              );
            }
          })
        );

        try {
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

      const res = await http.get('/users/contacts');
      const backendContacts: BackendContact[] = res.data.contacts || [];

      const formatted: DisplayContact[] = backendContacts.map((bc) => ({
        id: bc.id,
        name: bc.displayName || 'Unknown',
        imageUri: bc.contactPhone ? phoneToAvatarMap.get(bc.contactPhone) : undefined,
        backend: bc,
        isRegistered: !!(bc.contactUserId || bc.contactUser?.id),
      }));

      formatted.sort((a, b) => {
        if (a.isRegistered !== b.isRegistered) return a.isRegistered ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setContacts(formatted);
    } catch (err) {
      console.error('loadContacts error:', err);
      Alert.alert('Error', 'Failed to load contacts.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

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
      <Text style={{ fontSize: moderateScale(18), color: colors.greenText }}>🪝</Text>
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
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: moderateScale(28) }]}>
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
              <Text style={{ fontSize: moderateScale(22) }}>🔔</Text>
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
                  style={[tw`font-dm font-bold`, { color: colors.white, fontSize: moderateScale(10) }]}>
                  {notifCount}
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
              style={[tw`flex-1 font-dm`, { color: colors.ink, fontSize: moderateScale(14) }]}
              placeholder="Search contacts"
              placeholderTextColor={colors.placeholder}
              value={searchText}
              onChangeText={setSearchText}
            />
            <Text style={{ fontSize: moderateScale(18), color: colors.grey }}>🔍</Text>
          </View>

          {/* Invite CTA */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[tw`flex-row items-center`, { marginBottom: verticalScale(16) }]}>
            <Text style={[tw`font-dm font-bold`, { color: colors.greenText, fontSize: moderateScale(15) }]}>
              👤+ Invite
            </Text>
          </TouchableOpacity>

          {/* Contacts list */}
          {isLoading ? (
            <View style={{ paddingTop: verticalScale(60), alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          ) : filtered.length === 0 ? (
            <Text
              style={[
                tw`text-center font-dm`,
                { color: colors.grey, paddingVertical: verticalScale(40), fontSize: moderateScale(14) },
              ]}>
              {searchText ? 'No contacts found' : 'No contacts yet'}
            </Text>
          ) : (
            filtered.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                activeOpacity={0.7}
                onPress={() => handleContactPress(contact)}
                style={[
                  tw`flex-row items-center rounded-2xl`,
                  {
                    backgroundColor: colors.card,
                    padding: horizontalScale(14),
                    marginBottom: verticalScale(10),
                  },
                ]}>
                {/* Avatar with verified badge */}
                <View style={{ position: 'relative', marginRight: horizontalScale(14) }}>
                  <View
                    style={[
                      tw`rounded-full overflow-hidden items-center justify-center`,
                      { width: horizontalScale(52), height: horizontalScale(52), backgroundColor: colors.field },
                    ]}>
                    {contact.imageUri ? (
                      <Image
                        source={{ uri: contact.imageUri }}
                        style={{ width: horizontalScale(52), height: horizontalScale(52) }}
                      />
                    ) : (
                      <Image source={Avatar} style={{ width: horizontalScale(32), height: horizontalScale(32) }} />
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
                          backgroundColor: '#2D7FF9',
                          borderWidth: 1.5,
                          borderColor: colors.card,
                        },
                      ]}>
                      <Text style={{ color: colors.white, fontSize: moderateScale(9), fontWeight: 'bold' }}>✓</Text>
                    </View>
                  )}
                </View>

                {/* Name */}
                <Text
                  numberOfLines={1}
                  style={[
                    tw`flex-1 font-dm font-bold`,
                    { color: contact.isRegistered ? colors.ink : colors.grey, fontSize: moderateScale(15) },
                  ]}>
                  {contact.name}
                </Text>

                {/* Hook icon */}
                {contact.isRegistered && (
                  <TouchableOpacity onPress={() => handleHookIconPress(contact)} activeOpacity={0.7}>
                    <HookCircleIcon />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AppStack_ContactScreen;
