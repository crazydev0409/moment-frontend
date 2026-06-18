import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Device from 'expo-device';
import * as Linking from 'expo-linking';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_CalendarSettingsScreen'>;
type CalendarProvider = 'google' | 'icloud' | 'microsoft';

type CalendarIntegration = {
  provider: CalendarProvider;
  connected: boolean;
  status?: string;
  lastSyncedAt?: string | null;
};

const h = (n: number) => horizontalScale(n);
const v = (n: number) => verticalScale(n);
const ms = (n: number) => moderateScale(n);

const providerLabels: Record<CalendarProvider, string> = {
  google: 'Google Calendar',
  icloud: 'Apple Calendar',
  microsoft: 'Outlook Calendar',
};

async function getDeviceId(): Promise<string> {
  return Device.modelId || Device.deviceName || 'unknown';
}

const ProviderIcon = ({ provider }: { provider: CalendarProvider }) => {
  if (provider === 'google') {
    return (
      <View style={{ width: h(40), height: h(40), borderRadius: h(10), backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: ms(13) }}>31</Text>
      </View>
    );
  }
  if (provider === 'icloud') {
    return (
      <View style={{ width: h(40), height: h(40), borderRadius: h(10), backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: ms(8), fontWeight: 'bold' }}>July</Text>
        <Text style={{ color: '#fff', fontSize: ms(13), fontWeight: 'bold', marginTop: -2 }}>17</Text>
      </View>
    );
  }
  return (
    <View style={{ width: h(40), height: h(40), borderRadius: h(10), backgroundColor: '#0078D4', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: ms(15) }}>O</Text>
    </View>
  );
};

const HashIcon = () => (
  <Svg width={h(28)} height={h(28)} viewBox="0 0 28 28" fill="none">
    <Path
      d="M6 10h16M6 18h16M11 5l-2 18M19 5l-2 18"
      stroke={colors.green}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </Svg>
);

function formatSyncTime(isoString?: string | null): string {
  if (!isoString) return 'Synced';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Synced • just now';
  if (mins < 60) return `Synced • ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Synced • ${hrs}h ago`;
  return `Synced • ${Math.floor(hrs / 24)}d ago`;
}

const AppStack_CalendarSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<CalendarProvider | null>(null);

  const [showIcloudModal, setShowIcloudModal] = useState(false);
  const [icloudAppleId, setIcloudAppleId] = useState('');
  const [icloudPassword, setIcloudPassword] = useState('');

  const oauthRedirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'catch', path: 'calendar-integration' }),
    []
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await http.get('/users/calendar-integrations');
      setIntegrations(res.data.integrations || []);
    } catch {
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const syncProvider = async (provider: CalendarProvider) => {
    try {
      setSyncing(provider);
      await http.post(`/users/calendar-integrations/${provider}/sync`);
      await load();
    } catch (err: any) {
      Alert.alert('Sync failed', err?.response?.data?.error || 'Failed to sync calendar.');
    } finally {
      setSyncing(null);
    }
  };

  const connectProvider = async (provider: CalendarProvider) => {
    if (provider === 'icloud') {
      setShowIcloudModal(true);
      return;
    }
    try {
      setConnecting(true);
      const deviceId = await getDeviceId();
      const deviceName = Device.deviceName || Device.modelName || 'unknown-device';
      const response = await http.post(`/users/calendar-integrations/${provider}/start`, {
        device_id: deviceId,
        device_name: deviceName,
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
        if (parsed.queryParams?.status === 'success') {
          await load();
          await syncProvider(provider);
          return;
        }
      }
      Alert.alert('Connection failed', 'Calendar connection was not completed.');
    } catch (err: any) {
      Alert.alert('Connection failed', err?.response?.data?.error || 'Failed to connect calendar.');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectProvider = (provider: CalendarProvider) => {
    Alert.alert(
      `Disconnect ${providerLabels[provider]}`,
      'Your external calendar events will no longer appear in Catch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await http.delete(`/users/calendar-integrations/${provider}`);
              await load();
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to disconnect.');
            }
          },
        },
      ]
    );
  };

  const handleIcloudConnect = async () => {
    if (!icloudAppleId.trim() || !icloudPassword.trim()) {
      Alert.alert('Apple Calendar', 'Enter your Apple ID and app-specific password.');
      return;
    }
    try {
      setConnecting(true);
      await http.post('/users/calendar-integrations/icloud/connect', {
        appleId: icloudAppleId.trim(),
        appSpecificPassword: icloudPassword.trim(),
      });
      setShowIcloudModal(false);
      setIcloudAppleId('');
      setIcloudPassword('');
      await load();
      await syncProvider('icloud');
    } catch (err: any) {
      Alert.alert('Connection failed', err?.response?.data?.error || 'Failed to connect Apple Calendar.');
    } finally {
      setConnecting(false);
    }
  };

  const getIntegration = (provider: CalendarProvider) =>
    integrations.find((i) => i.provider === provider);

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      {/* Header */}
      <View
        style={[
          tw`flex-row items-center`,
          { paddingTop: insets.top + v(14), paddingHorizontal: '8%', paddingBottom: v(16) },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: h(24), height: h(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: ms(18.75) }]}>
            Calendar Settings
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      {loading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(60) }}
          showsVerticalScrollIndicator={false}>

          {/* Synced Calendar */}
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: ms(16), marginBottom: v(12) }]}>
            Synced Calendar
          </Text>
          <View
            style={[
              tw`flex-row items-center rounded-2xl`,
              {
                backgroundColor: colors.card,
                paddingHorizontal: h(16),
                paddingVertical: v(16),
                marginBottom: v(28),
              },
            ]}>
            <View
              style={[
                tw`rounded-xl items-center justify-center`,
                { width: h(40), height: h(40), backgroundColor: colors.greenTint, marginRight: h(14) },
              ]}>
              <HashIcon />
            </View>
            <Text style={[tw`font-dm font-bold flex-1`, { color: colors.ink, fontSize: ms(15) }]}>
              Catch Calendar
            </Text>
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: ms(13) }]}>
              Always up to date
            </Text>
          </View>

          {/* Other Calendars */}
          <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: ms(16), marginBottom: v(12) }]}>
            Other Calendars
          </Text>
          <View style={{ gap: v(10) }}>
            {(['google', 'icloud', 'microsoft'] as CalendarProvider[]).map((provider) => {
              const integration = getIntegration(provider);
              const isConnected = integration?.connected;
              const isSyncing = syncing === provider;
              return (
                <View
                  key={provider}
                  style={[
                    tw`flex-row items-center rounded-2xl`,
                    {
                      backgroundColor: colors.card,
                      paddingHorizontal: h(16),
                      paddingVertical: v(14),
                    },
                  ]}>
                  <View style={{ marginRight: h(14) }}>
                    <ProviderIcon provider={provider} />
                  </View>
                  <View style={tw`flex-1`}>
                    <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: ms(15) }]}>
                      {providerLabels[provider]}
                    </Text>
                    {isConnected && (
                      <Text style={[tw`font-dm`, { color: colors.grey, fontSize: ms(12), marginTop: 2 }]}>
                        {formatSyncTime(integration?.lastSyncedAt)}
                      </Text>
                    )}
                  </View>
                  {connecting && !isConnected ? (
                    <ActivityIndicator size="small" color={colors.green} />
                  ) : isConnected ? (
                    <View style={tw`flex-row items-center`}>
                      <TouchableOpacity
                        onPress={() => syncProvider(provider)}
                        activeOpacity={0.7}
                        disabled={isSyncing}
                        style={{ marginRight: h(14) }}>
                        {isSyncing ? (
                          <ActivityIndicator size="small" color={colors.green} />
                        ) : (
                          <Text style={[tw`font-dm`, { color: colors.green, fontSize: ms(13) }]}>↻ Sync</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => disconnectProvider(provider)} activeOpacity={0.7}>
                        <Text style={[tw`font-dm font-bold`, { color: colors.grey, fontSize: ms(13) }]}>
                          Connected
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => connectProvider(provider)} activeOpacity={0.7}>
                      <Text style={[tw`font-dm font-bold`, { color: colors.green, fontSize: ms(14) }]}>
                        Connect
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* iCloud Modal */}
      <Modal
        visible={showIcloudModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIcloudModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowIcloudModal(false)} />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: h(24),
              borderTopRightRadius: h(24),
              padding: h(24),
              paddingBottom: insets.bottom + v(24),
            }}>
            <Text style={[tw`font-dm font-bold`, { color: colors.ink, fontSize: ms(18), marginBottom: v(6) }]}>
              Connect Apple Calendar
            </Text>
            <Text style={[tw`font-dm`, { color: colors.grey, fontSize: ms(13), marginBottom: v(20) }]}>
              Use an app-specific password from appleid.apple.com
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.field,
                borderRadius: 12,
                paddingHorizontal: h(14),
                paddingVertical: v(12),
                fontFamily: 'DMSans',
                fontSize: ms(14),
                color: colors.ink,
                marginBottom: v(10),
              }}
              placeholder="Apple ID"
              placeholderTextColor={colors.grey}
              value={icloudAppleId}
              onChangeText={setIcloudAppleId}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={{
                backgroundColor: colors.field,
                borderRadius: 12,
                paddingHorizontal: h(14),
                paddingVertical: v(12),
                fontFamily: 'DMSans',
                fontSize: ms(14),
                color: colors.ink,
                marginBottom: v(20),
              }}
              placeholder="App-specific password"
              placeholderTextColor={colors.grey}
              value={icloudPassword}
              onChangeText={setIcloudPassword}
              secureTextEntry
            />
            <View style={tw`flex-row`} >
              <TouchableOpacity
                onPress={() => setShowIcloudModal(false)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  borderWidth: 1.5,
                  borderColor: colors.green,
                  borderRadius: h(28),
                  paddingVertical: v(14),
                  alignItems: 'center',
                  marginRight: h(10),
                }}>
                <Text style={[tw`font-dm font-bold`, { color: colors.green, fontSize: ms(15) }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleIcloudConnect}
                activeOpacity={0.85}
                disabled={connecting}
                style={{
                  flex: 1,
                  backgroundColor: colors.green,
                  borderRadius: h(28),
                  paddingVertical: v(14),
                  alignItems: 'center',
                  opacity: connecting ? 0.6 : 1,
                }}>
                {connecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[tw`font-dm font-bold`, { color: '#fff', fontSize: ms(15) }]}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_CalendarSettingsScreen;
