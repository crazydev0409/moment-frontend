import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Device from 'expo-device';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Background } from '~/lib/images';
import { http } from '~/helpers/http';
import { getDeviceId } from '~/services/deviceService';
import { disconnectSocket } from '~/services/socketService';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import { navigationRef } from '~/index';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_SettingsScreen'>;

type CalendarProvider = 'google' | 'microsoft' | 'icloud';

type CalendarIntegration = {
  provider: CalendarProvider;
  status: string;
  accountEmail?: string | null;
  accountName?: string | null;
  lastSyncedAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  connected: boolean;
};

type CalendarPreviewEvent = {
  id: string;
  source: 'catch' | CalendarProvider;
  sourceType: 'internal' | 'external';
  title: string;
  startTime: string;
  endTime: string;
  compact: boolean;
};

const providerLabels: Record<CalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Calendar',
  icloud: 'iCloud Calendar',
};

WebBrowser.maybeCompleteAuthSession();

const AppStack_SettingsScreen: React.FC<Props> = ({ navigation, route }) => {
  const [lightTheme, setLightTheme] = useState(true);
  const [darkTheme, setDarkTheme] = useState(false);
  const [autoTheme, setAutoTheme] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState(false);
  const [mailNotifications, setMailNotifications] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [calendarIntegrations, setCalendarIntegrations] = useState<CalendarIntegration[]>([]);
  const [previewEvents, setPreviewEvents] = useState<CalendarPreviewEvent[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  const [activeProvider, setActiveProvider] = useState<CalendarProvider | null>(null);
  const [showIcloudModal, setShowIcloudModal] = useState(false);
  const [icloudAppleId, setIcloudAppleId] = useState('');
  const [icloudPassword, setIcloudPassword] = useState('');
  const [, setUser] = useAtom(userAtom);
  const oauthRedirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'catch', path: 'calendar-integration' }),
    []
  );

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

  const loadCalendarIntegrations = useCallback(async () => {
    try {
      setIsLoadingIntegrations(true);
      const response = await http.get('/users/calendar-integrations');
      setCalendarIntegrations(response.data.integrations || []);
    } catch (error) {
      console.error('Error loading calendar integrations:', error);
      setCalendarIntegrations([]);
    } finally {
      setIsLoadingIntegrations(false);
    }
  }, []);

  const loadPreviewEvents = useCallback(async () => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const response = await http.get('/users/calendar-events', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      setPreviewEvents((response.data.events || []).slice(0, 5));
    } catch (error) {
      console.error('Error loading calendar preview events:', error);
      setPreviewEvents([]);
    }
  }, []);

  useEffect(() => {
    loadCalendarIntegrations();
    loadPreviewEvents();
  }, [loadCalendarIntegrations, loadPreviewEvents]);

  const handleOAuthConnect = async (
    provider: Extract<CalendarProvider, 'google' | 'microsoft'>
  ) => {
    try {
      setActiveProvider(provider);
      const deviceId = await getDeviceId();
      const deviceName =
        Device.deviceName || Device.modelName || Device.modelId || 'unknown-device';
      const response = await http.post(`/users/calendar-integrations/${provider}/start`, {
        // Backend expects snake_case for OAuth callback context.
        device_id: deviceId,
        device_name: deviceName,
        // Keep camelCase keys for backward compatibility with older API handlers.
        deviceId,
        deviceName,
        redirectUri: oauthRedirectUri,
      });
      const result = await WebBrowser.openAuthSessionAsync(
        response.data.authorizationUrl,
        oauthRedirectUri
      );

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const status = parsed.queryParams?.status;
        const message = parsed.queryParams?.message;

        if (status === 'success') {
          await Promise.all([loadCalendarIntegrations(), loadPreviewEvents()]);
        } else {
          Alert.alert('Connection failed', String(message || 'Failed to connect calendar.'));
        }
      }
    } catch (error: any) {
      console.error(`Error connecting ${provider} calendar:`, error);
      Alert.alert(
        'Connection failed',
        error.response?.data?.error || 'Failed to start calendar connection.'
      );
    } finally {
      setActiveProvider(null);
    }
  };

  const handleIcloudConnect = async () => {
    try {
      setActiveProvider('icloud');
      await http.post('/users/calendar-integrations/icloud/connect', {
        appleId: icloudAppleId,
        appSpecificPassword: icloudPassword,
      });
      setShowIcloudModal(false);
      setIcloudAppleId('');
      setIcloudPassword('');
      await Promise.all([loadCalendarIntegrations(), loadPreviewEvents()]);
    } catch (error: any) {
      console.error('Error connecting iCloud calendar:', error);
      Alert.alert(
        'Connection failed',
        error.response?.data?.error || 'Failed to connect iCloud calendar.'
      );
    } finally {
      setActiveProvider(null);
    }
  };

  const handleSyncProvider = async (provider: CalendarProvider) => {
    try {
      setActiveProvider(provider);
      await http.post(`/users/calendar-integrations/${provider}/sync`);
      await Promise.all([loadCalendarIntegrations(), loadPreviewEvents()]);
    } catch (error: any) {
      console.error(`Error syncing ${provider} calendar:`, error);
      Alert.alert('Sync failed', error.response?.data?.error || 'Failed to sync calendar.');
    } finally {
      setActiveProvider(null);
    }
  };

  const handleDisconnectProvider = async (provider: CalendarProvider) => {
    Alert.alert('Disconnect calendar', `Disconnect ${providerLabels[provider]} from Catch?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            setActiveProvider(provider);
            await http.delete(`/users/calendar-integrations/${provider}`);
            await Promise.all([loadCalendarIntegrations(), loadPreviewEvents()]);
          } catch (error: any) {
            console.error(`Error disconnecting ${provider} calendar:`, error);
            Alert.alert(
              'Disconnect failed',
              error.response?.data?.error || 'Failed to disconnect calendar.'
            );
          } finally {
            setActiveProvider(null);
          }
        },
      },
    ]);
  };

  const getIntegrationForProvider = (provider: CalendarProvider) =>
    calendarIntegrations.find((integration) => integration.provider === provider);

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

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            // Clear tokens from storage
            await AsyncStorage.removeItem('accessToken');
            await AsyncStorage.removeItem('refreshToken');

            // Clear authorization header
            delete http.defaults.headers.common['Authorization'];

            // Disconnect socket
            disconnectSocket();

            // Clear user atom
            resetUserAtom();

            // Navigate to AuthStack - use reset to clear navigation stack
            if (navigationRef.isReady()) {
              navigationRef.reset({
                index: 0,
                routes: [{ name: 'AuthStack' }],
              });
            } else {
              // If not ready, wait a bit and try again
              setTimeout(() => {
                if (navigationRef.isReady()) {
                  navigationRef.reset({
                    index: 0,
                    routes: [{ name: 'AuthStack' }],
                  });
                }
              }, 100);
            }
          } catch (error) {
            console.error('Error during logout:', error);
            // Even if there's an error, try to navigate to auth
            resetUserAtom();
            if (navigationRef.isReady()) {
              navigationRef.reset({
                index: 0,
                routes: [{ name: 'AuthStack' }],
              });
            }
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your account and all associated data. Are you absolutely sure?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeletingAccount(true);
                    try {
                      // Call delete account API
                      await http.delete('/users/account');

                      // Clear tokens from storage
                      await AsyncStorage.removeItem('accessToken');
                      await AsyncStorage.removeItem('refreshToken');

                      // Clear authorization header
                      delete http.defaults.headers.common['Authorization'];

                      // Disconnect socket
                      disconnectSocket();

                      // Clear user atom
                      resetUserAtom();

                      // Navigate to AuthStack - use reset to clear navigation stack
                      if (navigationRef.isReady()) {
                        navigationRef.reset({
                          index: 0,
                          routes: [{ name: 'AuthStack' }],
                        });
                      } else {
                        // If not ready, wait a bit and try again
                        setTimeout(() => {
                          if (navigationRef.isReady()) {
                            navigationRef.reset({
                              index: 0,
                              routes: [{ name: 'AuthStack' }],
                            });
                          }
                        }, 100);
                      }
                    } catch (error: any) {
                      console.error('Error deleting account:', error);
                      Alert.alert(
                        'Error',
                        error.response?.data?.error ||
                          'Failed to delete account. Please try again.',
                        [{ text: 'OK' }]
                      );
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
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
                tw`font-bold font-dm text-black flex-1 text-center`,
                { fontSize: moderateScale(22.5) },
              ]}>
              Settings
            </Text>
          </View>

          {/* Application Theme Section */}
          <View style={{ marginBottom: verticalScale(22.5) }}>
            <Text
              style={[
                tw`font-bold font-dm text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) },
              ]}>
              Application theme
            </Text>
            <View style={tw`bg-white rounded-2xl overflow-hidden`}>
              {/* Light */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between border-b border-gray-100`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => handleThemeChange('light')}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>Light</Text>
                <Switch
                  value={lightTheme}
                  onValueChange={() => handleThemeChange('light')}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={lightTheme ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>

              {/* Dark */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between border-b border-gray-100`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => handleThemeChange('dark')}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>Dark</Text>
                <Switch
                  value={darkTheme}
                  onValueChange={() => handleThemeChange('dark')}
                  trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                  thumbColor={darkTheme ? '#000000' : '#9CA3AF'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </TouchableOpacity>

              {/* Automatically */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => handleThemeChange('auto')}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
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
                tw`font-bold font-dm text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) },
              ]}>
              Notifications
            </Text>
            <View style={tw`bg-white rounded-2xl overflow-hidden`}>
              {/* Notifications in the system */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between border-b border-gray-100`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => setSystemNotifications(!systemNotifications)}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
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

              {/* Notifications by mail */}
              <TouchableOpacity
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}
                activeOpacity={0.7}
                onPress={() => setMailNotifications(!mailNotifications)}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
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

          {/* Calendar Integrations */}
          <View style={{ marginBottom: verticalScale(22.5) }}>
            <Text
              style={[
                tw`font-bold font-dm text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) },
              ]}>
              Calendar integrations
            </Text>
            <View style={tw`bg-white rounded-2xl overflow-hidden`}>
              {(['google', 'microsoft', 'icloud'] as CalendarProvider[]).map(
                (provider, index, providers) => {
                  const integration = getIntegrationForProvider(provider);
                  const isBusy = activeProvider === provider;
                  return (
                    <View key={provider}>
                      <View
                        style={[
                          tw`flex-row items-center justify-between`,
                          {
                            paddingHorizontal: horizontalScale(18.75),
                            paddingVertical: verticalScale(15),
                          },
                        ]}>
                        <View style={tw`flex-1`}>
                          <Text
                            style={[
                              tw`font-dm text-black`,
                              { fontSize: moderateScale(15), marginBottom: verticalScale(3) },
                            ]}>
                            {providerLabels[provider]}
                          </Text>
                          <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(11.25) }]}>
                            {integration?.connected
                              ? integration.accountEmail || integration.accountName || 'Connected'
                              : 'Not connected'}
                          </Text>
                          {integration?.lastSyncError ? (
                            <Text
                              style={[
                                tw`font-dm text-red-500`,
                                { fontSize: moderateScale(10.5), marginTop: verticalScale(3) },
                              ]}>
                              {integration.lastSyncError}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[tw`flex-row items-center`, { gap: horizontalScale(7.5) }]}>
                          {integration?.connected ? (
                            <>
                              <TouchableOpacity
                                onPress={() => handleSyncProvider(provider)}
                                activeOpacity={0.7}
                                disabled={isBusy}
                                style={[
                                  tw`bg-black rounded-full`,
                                  {
                                    paddingHorizontal: horizontalScale(12),
                                    paddingVertical: verticalScale(7.5),
                                  },
                                ]}>
                                {isBusy ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text
                                    style={[
                                      tw`font-dm text-white`,
                                      { fontSize: moderateScale(11.25) },
                                    ]}>
                                    Sync
                                  </Text>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleDisconnectProvider(provider)}
                                activeOpacity={0.7}
                                disabled={isBusy}
                                style={[
                                  tw`bg-[#F5F5F5] rounded-full`,
                                  {
                                    paddingHorizontal: horizontalScale(12),
                                    paddingVertical: verticalScale(7.5),
                                  },
                                ]}>
                                <Text
                                  style={[
                                    tw`font-dm text-black`,
                                    { fontSize: moderateScale(11.25) },
                                  ]}>
                                  Disconnect
                                </Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                if (provider === 'icloud') {
                                  setShowIcloudModal(true);
                                } else {
                                  handleOAuthConnect(provider as 'google' | 'microsoft');
                                }
                              }}
                              activeOpacity={0.7}
                              disabled={isBusy}
                              style={[
                                tw`bg-[#A3CB31] rounded-full`,
                                {
                                  paddingHorizontal: horizontalScale(12),
                                  paddingVertical: verticalScale(7.5),
                                },
                              ]}>
                              {isBusy ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text
                                  style={[
                                    tw`font-dm text-white`,
                                    { fontSize: moderateScale(11.25) },
                                  ]}>
                                  Connect
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      {index < providers.length - 1 ? (
                        <View
                          style={[
                            tw`bg-gray-100`,
                            { height: verticalScale(1), marginHorizontal: horizontalScale(18.75) },
                          ]}
                        />
                      ) : null}
                    </View>
                  );
                }
              )}
            </View>
          </View>

          {/* Calendar Preview */}
          <View style={{ marginBottom: verticalScale(22.5) }}>
            <Text
              style={[
                tw`font-bold font-dm text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) },
              ]}>
              Synced meeting preview
            </Text>
            <View style={tw`bg-white rounded-2xl overflow-hidden`}>
              {isLoadingIntegrations ? (
                <View
                  style={[
                    tw`items-center justify-center`,
                    { paddingVertical: verticalScale(22.5) },
                  ]}>
                  <ActivityIndicator size="small" color="#A3CB31" />
                </View>
              ) : previewEvents.length > 0 ? (
                previewEvents.map((event, index) => (
                  <View key={event.id}>
                    <View
                      style={[
                        tw`flex-row items-center`,
                        {
                          paddingHorizontal: horizontalScale(18.75),
                          paddingVertical: verticalScale(11.25),
                        },
                      ]}>
                      <View style={tw`flex-1`}>
                        <Text
                          style={[
                            tw`font-dm text-black`,
                            { fontSize: moderateScale(13.125), marginBottom: verticalScale(2) },
                          ]}
                          numberOfLines={1}>
                          {event.title}
                        </Text>
                        <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(10.5) }]}>
                          {new Date(event.startTime).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View
                        style={[
                          tw`rounded-full ${event.source === 'catch' ? 'bg-black' : 'bg-[#A3CB31]'}`,
                          {
                            paddingHorizontal: horizontalScale(10),
                            paddingVertical: verticalScale(4),
                          },
                        ]}>
                        <Text style={[tw`font-dm text-white`, { fontSize: moderateScale(10.5) }]}>
                          {event.source === 'catch' ? 'Catch' : providerLabels[event.source]}
                        </Text>
                      </View>
                    </View>
                    {index < previewEvents.length - 1 ? (
                      <View
                        style={[
                          tw`bg-gray-100`,
                          { height: verticalScale(1), marginHorizontal: horizontalScale(18.75) },
                        ]}
                      />
                    ) : null}
                  </View>
                ))
              ) : (
                <View
                  style={[
                    tw`items-center justify-center`,
                    { paddingVertical: verticalScale(22.5) },
                  ]}>
                  <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(12.5) }]}>
                    Connect a calendar to preview merged Catch and external events.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Application Version */}
          <View style={[tw`items-center`, { marginTop: verticalScale(15) }]}>
            <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(13.125) }]}>
              Application version 1.86
            </Text>
          </View>

          {/* Logout Section */}
          <View style={{ marginTop: verticalScale(30) }}>
            <TouchableOpacity
              style={tw`bg-white rounded-2xl overflow-hidden`}
              activeOpacity={0.7}
              onPress={handleLogout}
              disabled={isLoggingOut || isDeletingAccount}>
              <View
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                  Logout
                </Text>
                {isLoggingOut ? <ActivityIndicator size="small" color="#000000" /> : null}
              </View>
            </TouchableOpacity>
          </View>

          {/* Delete Account Section */}
          <View style={{ marginTop: verticalScale(15), marginBottom: verticalScale(30) }}>
            <TouchableOpacity
              style={tw`bg-white rounded-2xl overflow-hidden border border-red-500`}
              activeOpacity={0.7}
              onPress={handleDeleteAccount}
              disabled={isLoggingOut || isDeletingAccount}>
              <View
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) },
                ]}>
                <Text style={[tw`font-dm text-red-500`, { fontSize: moderateScale(15) }]}>
                  Delete Account
                </Text>
                {isDeletingAccount ? <ActivityIndicator size="small" color="#EF4444" /> : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showIcloudModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIcloudModal(false)}>
        <View
          style={[
            tw`flex-1 items-center justify-center`,
            { backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: '8%' },
          ]}>
          <View style={[tw`bg-white rounded-3xl w-full`, { padding: moderateScale(18.75) }]}>
            <Text
              style={[
                tw`font-dm font-bold text-black`,
                { fontSize: moderateScale(16.875), marginBottom: verticalScale(7.5) },
              ]}>
              Connect iCloud
            </Text>
            <Text
              style={[
                tw`font-dm text-grey`,
                { fontSize: moderateScale(11.25), marginBottom: verticalScale(15) },
              ]}>
              Use your Apple ID and an app-specific password for calendar sync.
            </Text>
            <TextInput
              style={[
                tw`bg-[#F5F5F5] rounded-2xl text-black font-dm`,
                {
                  paddingHorizontal: horizontalScale(15),
                  paddingVertical: verticalScale(12),
                  marginBottom: verticalScale(10),
                },
              ]}
              placeholder="Apple ID"
              placeholderTextColor="#999"
              autoCapitalize="none"
              value={icloudAppleId}
              onChangeText={setIcloudAppleId}
            />
            <TextInput
              style={[
                tw`bg-[#F5F5F5] rounded-2xl text-black font-dm`,
                {
                  paddingHorizontal: horizontalScale(15),
                  paddingVertical: verticalScale(12),
                  marginBottom: verticalScale(15),
                },
              ]}
              placeholder="App-specific password"
              placeholderTextColor="#999"
              autoCapitalize="none"
              secureTextEntry
              value={icloudPassword}
              onChangeText={setIcloudPassword}
            />
            <View style={[tw`flex-row`, { gap: horizontalScale(10) }]}>
              <TouchableOpacity
                onPress={() => setShowIcloudModal(false)}
                activeOpacity={0.7}
                style={[
                  tw`flex-1 bg-[#F5F5F5] rounded-2xl items-center`,
                  { paddingVertical: verticalScale(11.25) },
                ]}>
                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(13.125) }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleIcloudConnect}
                activeOpacity={0.7}
                disabled={activeProvider === 'icloud'}
                style={[
                  tw`flex-1 bg-[#A3CB31] rounded-2xl items-center`,
                  { paddingVertical: verticalScale(11.25) },
                ]}>
                {activeProvider === 'icloud' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={[tw`font-dm font-bold text-white`, { fontSize: moderateScale(13.125) }]}>
                    Connect
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

export default AppStack_SettingsScreen;
