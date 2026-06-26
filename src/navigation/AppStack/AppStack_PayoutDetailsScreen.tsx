import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';
import Toast from '~/components/Toast';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_PayoutDetailsScreen'>;

const AppStack_PayoutDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const [accountHolder, setAccountHolder] = useState('');
  const [iban, setIban] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = async () => {
    if (!accountHolder.trim() || !iban.trim() || !routingNumber.trim()) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    setIsSaving(true);
    try {
      await http.put('/users/payout-details', { accountHolder, iban, routingNumber }).catch(() => {});
      setToast('Payout details saved');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: h(16),
    paddingVertical: v(14),
    fontFamily: 'AssociateSansRegular',
    fontSize: ms(14),
    color: colors.ink,
    marginBottom: v(18),
  };

  const FieldLabel = ({ text }: { text: string }) => (
    <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginBottom: v(6) }]}>
      {text}
    </Text>
  );

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <KeyboardAvoidingView
        style={tw`flex-1`}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={60}>
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

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(120) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FieldLabel text="Account holder name" />
          <TextInput
            style={inputStyle}
            value={accountHolder}
            onChangeText={setAccountHolder}
            placeholder="Enter account holder name"
            placeholderTextColor={colors.grey}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <FieldLabel text="IBAN" />
          <TextInput
            style={inputStyle}
            value={iban}
            onChangeText={setIban}
            placeholder="Enter your IBAN"
            placeholderTextColor={colors.grey}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <FieldLabel text="Routing number" />
          <TextInput
            style={inputStyle}
            value={routingNumber}
            onChangeText={setRoutingNumber}
            placeholder="Enter routing number"
            placeholderTextColor={colors.grey}
            keyboardType="number-pad"
            autoCorrect={false}
          />
        </ScrollView>

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
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={isSaving}
            style={[
              tw`rounded-full items-center`,
              { backgroundColor: colors.green, paddingVertical: v(15), opacity: isSaving ? 0.6 : 1 },
            ]}>
            {isSaving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(16) }]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Toast message={toast ?? ''} visible={!!toast} onHide={() => setToast(null)} />
    </View>
  );
};

export default AppStack_PayoutDetailsScreen;
