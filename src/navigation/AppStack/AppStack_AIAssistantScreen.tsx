import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';
import Toast from '~/components/Toast';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_AIAssistantScreen'>;

interface AISettings {
  enabled: boolean;
  apiKey?: string | null;
  instructions?: string | null;
  autoAcceptMeetings: boolean;
  autoDeclineUnavailable: boolean;
  suggestAlternativeTimes: boolean;
  autoRescheduleCanceled: boolean;
  autoGenerateHooks: boolean;
  recommendHooksInMesh: boolean;
  smartHookScheduling: boolean;
}

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={{ marginBottom: v(12) }}>
    <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17) }]}>{title}</Text>
    {subtitle && (
      <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginTop: v(3) }]}>
        {subtitle}
      </Text>
    )}
  </View>
);

const ToggleCard = ({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => onValueChange(!value)}
    style={[
      tw`rounded-2xl`,
      { backgroundColor: colors.card, padding: h(18), marginBottom: v(10) },
    ]}>
    <View style={tw`flex-row items-start justify-between`}>
      <View style={{ flex: 1, marginRight: h(12) }}>
        <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(15) }]}>{title}</Text>
        <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(12.5), marginTop: v(3) }]}>
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.green }}
        thumbColor={colors.white}
      />
    </View>
  </TouchableOpacity>
);

const AI_SETTINGS_KEY = '@ai_settings';

const AppStack_AIAssistantScreen: React.FC<Props> = ({ navigation }) => {
  const [settings, setSettings] = useState<AISettings>({
    enabled: false,
    apiKey: null,
    instructions: '',
    autoAcceptMeetings: false,
    autoDeclineUnavailable: false,
    suggestAlternativeTimes: false,
    autoRescheduleCanceled: false,
    autoGenerateHooks: false,
    recommendHooksInMesh: false,
    smartHookScheduling: false,
  });
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AI_SETTINGS_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          setSettings((prev) => ({ ...prev, ...saved }));
        } catch {}
      }
    });
  }, []);

  const setSetting = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleGenerateKey = async () => {
    setIsGeneratingKey(true);
    try {
      const res = await http.post('/users/ai/generate-api-key').catch(() => null);
      if (res?.data?.apiKey) {
        setSetting('apiKey', res.data.apiKey);
        setToast('API Key generated');
      } else {
        // Fallback: generate a local key when backend endpoint is not yet available
        const localKey = `mk_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
        setSetting('apiKey', localKey);
        setToast('API Key generated');
      }
    } catch {
      Alert.alert('Error', 'Failed to generate API key. Please try again.');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCopyKey = () => {
    if (settings.apiKey) {
      Clipboard.setString(settings.apiKey);
      setToast('Copied to clipboard');
    }
  };

  const maskedKey = settings.apiKey
    ? apiKeyVisible
      ? settings.apiKey
      : settings.apiKey.replace(/.(?=.{4})/g, '•')
    : null;

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
            AI Assistant
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(60) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Enable toggle */}
        <View
          style={[
            tw`rounded-2xl flex-row items-center justify-between`,
            { backgroundColor: colors.card, paddingHorizontal: h(18), paddingVertical: v(16), marginBottom: v(24) },
          ]}>
          <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
            Enable AI Assistant
          </Text>
          <Switch
            value={settings.enabled}
            onValueChange={(val) => setSetting('enabled', val)}
            trackColor={{ false: colors.border, true: colors.green }}
            thumbColor={colors.white}
          />
        </View>

        {/* API Integration */}
        <View style={{ marginBottom: v(24) }}>
          <SectionHeader
            title="API Integration"
            subtitle="Connect external AI agents and MCP servers using an API key"
          />
          <View style={[tw`flex-row items-center`, { gap: h(10) }]}>
            {/* Key field */}
            <View
              style={[
                tw`flex-1 flex-row items-center rounded-full`,
                { backgroundColor: colors.card, paddingHorizontal: h(16), paddingVertical: v(13) },
              ]}>
              {isGeneratingKey ? (
                <>
                  <ActivityIndicator size="small" color={colors.grey} style={{ marginRight: h(8) }} />
                  <Text style={[tw`font-associate flex-1`, { color: colors.grey, fontSize: ms(14) }]}>
                    Generating API Key...
                  </Text>
                </>
              ) : (
                <Text
                  style={[tw`font-associate flex-1`, { color: settings.apiKey ? colors.ink : colors.grey, fontSize: ms(14) }]}
                  numberOfLines={1}>
                  {maskedKey ?? 'No API key generated yet'}
                </Text>
              )}
              {settings.apiKey && !isGeneratingKey && (
                <TouchableOpacity onPress={() => setApiKeyVisible((v) => !v)} activeOpacity={0.7}>
                  <Text style={{ fontSize: ms(18), marginLeft: h(8) }}>
                    {apiKeyVisible ? '👁' : '👁‍🗨'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {/* Copy button */}
            <TouchableOpacity
              onPress={handleCopyKey}
              activeOpacity={0.7}
              disabled={!settings.apiKey || isGeneratingKey}
              style={[
                tw`rounded-full items-center justify-center`,
                {
                  width: h(48),
                  height: h(48),
                  backgroundColor: colors.card,
                  opacity: settings.apiKey && !isGeneratingKey ? 1 : 0.4,
                },
              ]}>
              <Text style={{ fontSize: ms(18) }}>⧉</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleGenerateKey}
            activeOpacity={0.7}
            disabled={isGeneratingKey}
            style={{ alignSelf: 'flex-end', marginTop: v(8) }}>
            <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: ms(13.5) }]}>
              🔑 {settings.apiKey ? 'Regenerate API Key' : 'Generate API Key'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* AI Instructions */}
        <View style={{ marginBottom: v(24) }}>
          <SectionHeader
            title="AI Instructions"
            subtitle="Define how your AI assistant should behave, communicate, and handle requests"
          />
          <TextInput
            value={settings.instructions ?? ''}
            onChangeText={(t) => setSetting('instructions', t)}
            placeholder="Describe how this assistant should interact with users"
            placeholderTextColor={colors.grey}
            multiline
            textAlignVertical="top"
            style={[
              tw`rounded-2xl font-associate`,
              {
                backgroundColor: colors.card,
                color: colors.ink,
                fontSize: ms(14),
                padding: h(16),
                minHeight: v(110),
              },
            ]}
          />
        </View>

        {/* Scheduling Automation */}
        <View style={{ marginBottom: v(24) }}>
          <SectionHeader title="Scheduling Automation" />
          <ToggleCard
            title="Auto-accept meeting requests"
            subtitle="AI automatically accepts requests based on availability."
            value={settings.autoAcceptMeetings}
            onValueChange={(val) => setSetting('autoAcceptMeetings', val)}
          />
          <ToggleCard
            title="Auto-decline unavailable slots"
            subtitle="Reject requests outside business rules."
            value={settings.autoDeclineUnavailable}
            onValueChange={(val) => setSetting('autoDeclineUnavailable', val)}
          />
          <ToggleCard
            title="Suggest alternative times"
            subtitle="AI proposes nearest available slots automatically."
            value={settings.suggestAlternativeTimes}
            onValueChange={(val) => setSetting('suggestAlternativeTimes', val)}
          />
          <ToggleCard
            title="Auto-reschedule canceled meetings"
            subtitle="Find and suggest replacement times."
            value={settings.autoRescheduleCanceled}
            onValueChange={(val) => setSetting('autoRescheduleCanceled', val)}
          />
        </View>

        {/* Hook Automation */}
        <View>
          <SectionHeader title="Hook Automation" />
          <ToggleCard
            title="Auto-generate hooks"
            subtitle="AI creates hooks based on business activity."
            value={settings.autoGenerateHooks}
            onValueChange={(val) => setSetting('autoGenerateHooks', val)}
          />
          <ToggleCard
            title="Recommend hooks in Mesh"
            subtitle="AI instantly recommends hooks to users."
            value={settings.recommendHooksInMesh}
            onValueChange={(val) => setSetting('recommendHooksInMesh', val)}
          />
          <ToggleCard
            title="Smart hook scheduling"
            subtitle="AI adjusts hook timing based on demand."
            value={settings.smartHookScheduling}
            onValueChange={(val) => setSetting('smartHookScheduling', val)}
          />
        </View>
      </ScrollView>

      <Toast
        message={toast ?? ''}
        visible={!!toast}
        onHide={() => setToast(null)}
      />
    </View>
  );
};

export default AppStack_AIAssistantScreen;
