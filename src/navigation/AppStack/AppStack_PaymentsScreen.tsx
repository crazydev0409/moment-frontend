import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useStripe } from '@stripe/stripe-react-native';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, ChevronIcon, EyeIcon, PayIcon, TrashIcon } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_PaymentsScreen'>;

interface PaymentMethodSummary {
  id: string;
  brand?: string;
  last4?: string;
}

interface PayoutSummary {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
}

const cardBrandLabel = (brand?: string) => {
  if (!brand) return 'Card';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
};

const formatCents = (cents: number, currency = 'usd') => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
};

const AppStack_PaymentsScreen: React.FC<Props> = ({ navigation }) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [isLoading, setIsLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [balance, setBalance] = useState<{ availableCents: number; pendingCents: number; currency: string } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSummary[]>([]);
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isStartingPayoutSetup, setIsStartingPayoutSetup] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statusRes, methodsRes] = await Promise.all([
        http.get('/payments/connect-status'),
        http.get('/payments/payment-methods'),
      ]);
      const enabled = Boolean(statusRes.data?.chargesEnabled);
      setChargesEnabled(enabled);
      setPaymentMethods(methodsRes.data?.paymentMethods || []);

      if (enabled) {
        const [balanceRes, payoutsRes] = await Promise.all([
          http.get('/payments/balance').catch(() => null),
          http.get('/payments/payouts').catch(() => ({ data: { payouts: [] } })),
        ]);
        setBalance(balanceRes?.data || null);
        setPayouts(payoutsRes?.data?.payouts || []);
      } else {
        setBalance(null);
        setPayouts([]);
      }
    } catch {
      // leave defaults on failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSetUpPayouts = async () => {
    if (isStartingPayoutSetup) return;
    setIsStartingPayoutSetup(true);
    try {
      const res = await http.post('/payments/connect/onboarding-link');
      await WebBrowser.openAuthSessionAsync(res.data.url, 'catch://payout-details');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to start payout setup.');
    } finally {
      setIsStartingPayoutSetup(false);
    }
  };

  const handleAddCard = async () => {
    if (isAddingCard) return;
    setIsAddingCard(true);
    try {
      const res = await http.post('/payments/setup-intent');
      const { clientSecret, customerId, ephemeralKeySecret } = res.data;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Catch',
        customerId,
        customerEphemeralKeySecret: ephemeralKeySecret,
        setupIntentClientSecret: clientSecret,
      });
      if (initError) {
        Alert.alert('Error', initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Error', presentError.message);
        }
        return;
      }

      await load();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add card.');
    } finally {
      setIsAddingCard(false);
    }
  };

  const handleRemoveCard = (paymentMethodId: string) => {
    Alert.alert('Remove card', 'Remove this saved card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await http.delete(`/payments/payment-methods/${paymentMethodId}`);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to remove card.');
          }
        },
      },
    ]);
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
            Payments
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
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(40), gap: v(16) }}
          showsVerticalScrollIndicator={false}>

          {/* Balance card (hosts who've finished payout setup) or a setup CTA */}
          {chargesEnabled ? (
            <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, padding: h(20) }]}>
              <Text
                style={[
                  tw`font-associate`,
                  { color: colors.grey, fontSize: ms(11), letterSpacing: 1.2, marginBottom: v(8) },
                ]}>
                ACCOUNT BALANCE
              </Text>
              <View style={tw`flex-row items-center`}>
                <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(38) }]}>
                  {balanceVisible ? formatCents(balance?.availableCents ?? 0, balance?.currency) : '••••••'}
                </Text>
                <TouchableOpacity
                  onPress={() => setBalanceVisible((b) => !b)}
                  activeOpacity={0.7}
                  style={{ marginLeft: h(14) }}>
                  <Image source={EyeIcon} style={{ width: h(22), height: h(22) }} tintColor={colors.grey} resizeMode="contain" />
                </TouchableOpacity>
              </View>
              {!!balance?.pendingCents && (
                <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(12.5), marginTop: v(6) }]}>
                  {formatCents(balance.pendingCents, balance.currency)} pending
                </Text>
              )}
            </View>
          ) : (
            <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, padding: h(20) }]}>
              <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(15), marginBottom: v(6) }]}>
                Get paid for your Hooks
              </Text>
              <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginBottom: v(14) }]}>
                Set up payouts to start accepting paid bookings.
              </Text>
              <TouchableOpacity
                onPress={handleSetUpPayouts}
                activeOpacity={0.7}
                disabled={isStartingPayoutSetup}
                style={[
                  tw`rounded-full items-center justify-center`,
                  { backgroundColor: colors.green, paddingVertical: v(13) },
                ]}>
                {isStartingPayoutSetup ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(14) }]}>
                    Set up payouts
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Payout history (only relevant once payouts are actually possible) */}
          {chargesEnabled && (
            <View>
              <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17), marginBottom: v(12) }]}>
                Payout history
              </Text>
              {payouts.length === 0 ? (
                <View style={[tw`rounded-2xl`, { backgroundColor: colors.card, padding: h(18) }]}>
                  <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13) }]}>
                    No payouts yet
                  </Text>
                </View>
              ) : (
                <View style={[tw`rounded-2xl overflow-hidden`, { backgroundColor: colors.card }]}>
                  {payouts.map((payout, idx) => (
                    <View key={payout.id}>
                      <View
                        style={[
                          tw`flex-row items-center justify-between`,
                          { paddingVertical: v(14), paddingHorizontal: h(18) },
                        ]}>
                        <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(14) }]}>
                          {formatCents(payout.amountCents, payout.currency)}
                        </Text>
                        <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(12.5) }]}>
                          {payout.status}
                        </Text>
                      </View>
                      {idx < payouts.length - 1 && (
                        <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: h(18) }} />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Saved payment methods (for booking paid Hooks as a payer) */}
          <View>
            <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17), marginBottom: v(12) }]}>
              Payment methods
            </Text>
            <View style={[tw`rounded-2xl overflow-hidden`, { backgroundColor: colors.card }]}>
              {paymentMethods.map((method) => (
                <View key={method.id}>
                  <View
                    style={[
                      tw`flex-row items-center justify-between`,
                      { paddingVertical: v(16), paddingHorizontal: h(18) },
                    ]}>
                    <View style={tw`flex-row items-center`}>
                      <View
                        style={[
                          tw`rounded-lg items-center justify-center`,
                          { backgroundColor: '#EEF2FF', paddingHorizontal: h(10), paddingVertical: v(5), marginRight: h(12) },
                        ]}>
                        <Text style={[tw`font-associate-bold`, { color: '#1A1F71', fontSize: ms(12) }]}>
                          {cardBrandLabel(method.brand)}
                        </Text>
                      </View>
                      <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
                        •••• {method.last4}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveCard(method.id)} activeOpacity={0.7}>
                      <Image source={TrashIcon} style={{ width: h(18), height: h(18) }} tintColor={colors.grey} resizeMode="contain" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: h(18) }} />
                </View>
              ))}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleAddCard}
                disabled={isAddingCard}
                style={[
                  tw`flex-row items-center justify-between`,
                  { paddingVertical: v(16), paddingHorizontal: h(18) },
                ]}>
                <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
                  + Add card
                </Text>
                {isAddingCard ? (
                  <ActivityIndicator size="small" color={colors.grey} />
                ) : (
                  <Image source={ChevronIcon} style={{ width: h(16), height: h(16) }} tintColor={colors.grey} resizeMode="contain" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Payout details */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AppStack_PayoutDetailsScreen')}
            style={[
              tw`rounded-2xl flex-row items-center justify-between`,
              { backgroundColor: colors.card, paddingHorizontal: h(18), paddingVertical: v(16) },
            ]}>
            <View style={tw`flex-row items-center`}>
              <Image source={PayIcon} style={{ width: h(20), height: h(20), marginRight: h(14) }} tintColor={colors.ink} resizeMode="contain" />
              <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
                Payout details
              </Text>
            </View>
            <Image source={ChevronIcon} style={{ width: h(16), height: h(16) }} tintColor={colors.grey} resizeMode="contain" />
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

export default AppStack_PaymentsScreen;
