import React, { useCallback, useState } from 'react';
import { Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, ChevronIcon, EyeIcon, PayIcon } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_PaymentsScreen'>;
type PaymentMethod = 'wallet' | 'visa';

const RadioDot = ({ selected }: { selected: boolean }) => (
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
    }}>
    {selected && (
      <View style={{ width: h(8), height: h(8), borderRadius: h(4), backgroundColor: colors.white }} />
    )}
  </View>
);

const AppStack_PaymentsScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('wallet');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      http.get('/users/balance').then((res) => {
        if (res?.data?.balance !== undefined) setBalance(res.data.balance);
      }).catch(() => {});
    }, []),
  );

  const formatBalance = (cents: number | null) => {
    if (cents === null) return '$0';
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  const walletLabel = Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay';

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

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(40), gap: v(16) }}
        showsVerticalScrollIndicator={false}>

        {/* Account Balance card */}
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
              {balanceVisible ? formatBalance(balance) : '••••••'}
            </Text>
            <TouchableOpacity
              onPress={() => setBalanceVisible((b) => !b)}
              activeOpacity={0.7}
              style={{ marginLeft: h(14) }}>
              <Image
                source={EyeIcon}
                style={{ width: h(22), height: h(22) }}
                tintColor={colors.grey}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Add funds / Withdraw row */}
        <View style={[tw`flex-row`, { gap: h(12) }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Alert.alert('Add Funds', 'Enter the amount you want to add to your balance.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => {} }])}
            style={[
              tw`flex-1 rounded-full items-center justify-center`,
              { backgroundColor: colors.ink, paddingVertical: v(15) },
            ]}>
            <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
              ↗  Add funds
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Alert.alert('Withdraw', 'Enter the amount you want to withdraw from your balance.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => {} }])}
            style={[
              tw`flex-1 rounded-full items-center justify-center`,
              { backgroundColor: colors.ink, paddingVertical: v(15) },
            ]}>
            <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
              ↙  Withdraw
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment methods */}
        <View>
          <Text
            style={[
              tw`font-associate-bold`,
              { color: colors.ink, fontSize: ms(17), marginBottom: v(12) },
            ]}>
            Payment methods
          </Text>
          <View style={[tw`rounded-2xl overflow-hidden`, { backgroundColor: colors.card }]}>
            {/* Apple Pay / Google Pay */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('wallet')}
              activeOpacity={0.7}
              style={[
                tw`flex-row items-center justify-between`,
                { paddingVertical: v(16), paddingHorizontal: h(18) },
              ]}>
              <View style={tw`flex-row items-center`}>
                <View
                  style={[
                    tw`rounded-full items-center justify-center`,
                    { backgroundColor: colors.field, paddingHorizontal: h(10), paddingVertical: v(5), marginRight: h(12) },
                  ]}>
                  <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(12) }]}>
                    {Platform.OS === 'ios' ? '🍎' : 'G'} Pay
                  </Text>
                </View>
                <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
                  {walletLabel}
                </Text>
              </View>
              <RadioDot selected={selectedMethod === 'wallet'} />
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: h(18) }} />

            {/* VISA */}
            <TouchableOpacity
              onPress={() => setSelectedMethod('visa')}
              activeOpacity={0.7}
              style={[
                tw`flex-row items-center justify-between`,
                { paddingVertical: v(16), paddingHorizontal: h(18) },
              ]}>
              <View style={tw`flex-row items-center`}>
                <View
                  style={[
                    tw`rounded-lg items-center justify-center`,
                    {
                      backgroundColor: '#EEF2FF',
                      paddingHorizontal: h(10),
                      paddingVertical: v(5),
                      marginRight: h(12),
                    },
                  ]}>
                  <Text style={[tw`font-associate-bold`, { color: '#1A1F71', fontSize: ms(13) }]}>
                    VISA
                  </Text>
                </View>
                <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
                  **** 5665
                </Text>
              </View>
              <RadioDot selected={selectedMethod === 'visa'} />
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: h(18) }} />

            {/* Add card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert('Add Card', 'Card payment integration coming soon.')}
              style={[
                tw`flex-row items-center justify-between`,
                { paddingVertical: v(16), paddingHorizontal: h(18) },
              ]}>
              <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
                + Add card
              </Text>
              <Image
                source={ChevronIcon}
                style={{ width: h(16), height: h(16) }}
                tintColor={colors.grey}
                resizeMode="contain"
              />
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
            <Image
              source={PayIcon}
              style={{ width: h(20), height: h(20), marginRight: h(14) }}
              tintColor={colors.ink}
              resizeMode="contain"
            />
            <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>
              Payout details
            </Text>
          </View>
          <Image
            source={ChevronIcon}
            style={{ width: h(16), height: h(16) }}
            tintColor={colors.grey}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default AppStack_PaymentsScreen;
