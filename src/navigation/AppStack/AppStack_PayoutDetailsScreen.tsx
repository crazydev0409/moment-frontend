import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_PayoutDetailsScreen'>;

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

const StatusRow = ({ label, done }: { label: string; done: boolean }) => (
  <View style={[tw`flex-row items-center justify-between`, { paddingVertical: v(12) }]}>
    <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(14) }]}>{label}</Text>
    <View
      style={{
        paddingHorizontal: h(10),
        paddingVertical: v(3),
        borderRadius: 999,
        backgroundColor: done ? colors.greenTint : colors.field,
      }}>
      <Text
        style={[
          tw`font-associate-bold`,
          { color: done ? colors.greenText : colors.grey, fontSize: ms(11.5) },
        ]}>
        {done ? 'Done' : 'Pending'}
      </Text>
    </View>
  </View>
);

const AppStack_PayoutDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState<ConnectStatus | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await http.get('/payments/connect-status');
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePrimaryAction = async () => {
    if (isWorking) return;
    setIsWorking(true);
    try {
      if (status?.detailsSubmitted) {
        const res = await http.post('/payments/connect/dashboard-link');
        await WebBrowser.openBrowserAsync(res.data.url);
      } else {
        const res = await http.post('/payments/connect/onboarding-link');
        await WebBrowser.openAuthSessionAsync(res.data.url, 'catch://payout-details');
        await load();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to open Stripe.');
    } finally {
      setIsWorking(false);
    }
  };

  const primaryLabel = !status?.connected
    ? 'Set up payouts'
    : status?.detailsSubmitted
      ? 'View Stripe dashboard'
      : 'Continue setup';

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
            Payout Details
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      {isLoading ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(40) }}
          showsVerticalScrollIndicator={false}>
          <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13.5), marginBottom: v(20), lineHeight: ms(19) }]}>
            Payouts are handled by Stripe. Your bank details are entered directly with Stripe — Catch never sees or stores them.
          </Text>

          {status?.connected && (
            <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, paddingHorizontal: h(18), marginBottom: v(24) }]}>
              <StatusRow label="Details submitted" done={status.detailsSubmitted} />
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <StatusRow label="Charges enabled" done={status.chargesEnabled} />
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <StatusRow label="Payouts enabled" done={status.payoutsEnabled} />
            </View>
          )}

          <TouchableOpacity
            onPress={handlePrimaryAction}
            activeOpacity={0.85}
            disabled={isWorking}
            style={[
              tw`rounded-full items-center justify-center`,
              { backgroundColor: colors.green, paddingVertical: v(12), opacity: isWorking ? 0.6 : 1 },
            ]}>
            {isWorking ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
                {primaryLabel}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

export default AppStack_PayoutDetailsScreen;
