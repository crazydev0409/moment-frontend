import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AsYouType, getExampleNumber, isValidPhoneNumber } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import { Country, FlagType, getAllCountries } from 'react-native-country-picker-modal';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { http } from '~/helpers/http';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ChangePhoneScreen'>;

const CODE_LENGTH = 6;
const initialCountryCode = 'US';
const initialCallingCode = '1';

const getCountryDisplayName = (country: Country) =>
  typeof country.name === 'string' ? country.name : country.name.common;

const AppStack_ChangePhoneScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [callingCode, setCallingCode] = useState(initialCallingCode);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const codeInputRef = useRef<TextInput>(null);

  const examplePhone = getExampleNumber(countryCode as any, examples);
  const maxPhoneDigits = examplePhone?.nationalNumber.length ?? 16;
  const formattedPhone = new AsYouType(countryCode as any).input(phone);
  const phonePlaceholder = examplePhone?.formatNational() ?? 'Phone number';
  const fullPhoneNumber = `+${callingCode}${phone}`;
  const isPhoneValid = phone.length > 0 && isValidPhoneNumber(fullPhoneNumber, countryCode as any);
  const codeDigits = Array.from({ length: CODE_LENGTH }, (_, index) => code[index] ?? '');

  const filteredCountries = useMemo(() => {
    const normalizedSearch = countrySearch.trim().toLowerCase();
    return countries
      .filter((country) => country.callingCode?.length)
      .filter((country) => {
        if (!normalizedSearch) return true;
        const countryName = getCountryDisplayName(country);
        return (
          countryName.toLowerCase().includes(normalizedSearch) ||
          country.cca2.toLowerCase().includes(normalizedSearch) ||
          country.callingCode.some((code) => code.includes(normalizedSearch.replace(/^\+/, '')))
        );
      });
  }, [countries, countrySearch]);

  useEffect(() => {
    getAllCountries(FlagType.EMOJI, 'common')
      .then((loadedCountries) => setCountries(loadedCountries))
      .catch((error) => console.error('Error loading countries:', error));
  }, []);

  useEffect(() => {
    if (step !== 'code') return;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const onSelectCountry = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
    setCountrySearch('');
    setPickerVisible(false);
    setPhone('');
  };

  const sendCode = async () => {
    if (!isPhoneValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await http.post('/users/change-phone/start', { newPhoneNumber: fullPhoneNumber });
      setStep('code');
      setCode('');
      setResendSeconds(30);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResend = async () => {
    if (isResending || resendSeconds > 0) return;
    setIsResending(true);
    try {
      await http.post('/users/change-phone/start', { newPhoneNumber: fullPhoneNumber });
      setResendSeconds(30);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to resend verification code.');
    } finally {
      setIsResending(false);
    }
  };

  const confirmCode = async () => {
    if (code.length !== CODE_LENGTH || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await http.post('/users/change-phone/confirm', { newPhoneNumber: fullPhoneNumber, code });
      Alert.alert('Phone number updated', 'Your phone number has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Invalid verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onBack = () => {
    if (step === 'code') {
      setStep('input');
      return;
    }
    navigation.goBack();
  };

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <KeyboardAvoidingView style={tw`flex-1`} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View
          style={[
            tw`flex-row items-center`,
            { marginTop: v(55), marginBottom: v(20), paddingHorizontal: '8%' },
          ]}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Image source={BackArrow} style={{ width: h(24), height: h(24) }} resizeMode="contain" />
          </TouchableOpacity>
          <View style={tw`flex-1 items-center`}>
            <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(17) }]}>
              Change your phone number
            </Text>
          </View>
          <View style={{ width: h(24) }} />
        </View>

        <ScrollView
          style={tw`flex-1`}
          contentContainerStyle={{ paddingHorizontal: '8%', paddingBottom: v(40) }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 'input' ? (
            <>
              <Text
                style={[
                  tw`font-associate`,
                  { color: colors.grey, fontSize: ms(13), marginBottom: v(8) },
                ]}>
                Phone number
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.card,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: colors.greenSoft,
                  paddingHorizontal: h(16),
                  paddingVertical: v(10),
                }}>
                <TouchableOpacity
                  onPress={() => setPickerVisible(true)}
                  activeOpacity={0.7}
                  style={tw`flex-row items-center`}>
                  <View style={{ width: h(30), height: h(30), borderRadius: h(15), overflow: 'hidden' }}>
                    <Image
                      source={{ uri: `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png` }}
                      style={{ width: h(30), height: h(30) }}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(15), marginLeft: h(8) }]}>
                    +{callingCode}
                  </Text>
                </TouchableOpacity>

                <View style={{ width: 1, height: h(24), backgroundColor: colors.border, marginHorizontal: h(14) }} />

                <TextInput
                  value={formattedPhone}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '').slice(0, maxPhoneDigits);
                    const isDeleting = text.length < formattedPhone.length;
                    if (isDeleting && numericValue === phone) {
                      setPhone(phone.slice(0, -1));
                      return;
                    }
                    setPhone(numericValue);
                  }}
                  placeholder={phonePlaceholder}
                  placeholderTextColor={colors.placeholder}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoFocus
                  style={{
                    flex: 1,
                    fontFamily: 'AssociateSansRegular',
                    fontSize: ms(16),
                    color: colors.ink,
                    padding: 0,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={sendCode}
                activeOpacity={0.85}
                disabled={!isPhoneValid || isSubmitting}
                style={[
                  tw`rounded-full items-center justify-center`,
                  {
                    backgroundColor: isPhoneValid ? colors.green : colors.greenTint,
                    paddingVertical: v(12),
                    marginTop: v(28),
                  },
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
                    Continue
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={[
                  tw`font-associate`,
                  { color: colors.grey, fontSize: ms(14), marginBottom: v(24), lineHeight: ms(20) },
                ]}>
                We sent a verification code to +{callingCode} {formattedPhone}. Enter it below.
              </Text>

              <TouchableOpacity
                activeOpacity={1}
                onPress={() => codeInputRef.current?.focus()}
                style={[tw`flex-row justify-between`, { marginBottom: v(16) }]}>
                {codeDigits.map((digit, index) => (
                  <View
                    key={index}
                    style={{
                      width: h(46),
                      height: h(54),
                      borderRadius: h(16),
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ color: colors.ink, fontFamily: 'AssociateSansBold', fontSize: ms(20) }}>
                      {digit}
                    </Text>
                  </View>
                ))}
              </TouchableOpacity>

              <TextInput
                ref={codeInputRef}
                value={code}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={CODE_LENGTH}
                autoFocus
                style={{ height: 1, width: 1, opacity: 0, position: 'absolute' }}
                onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
              />

              <View style={[tw`flex-row items-center justify-between`, { marginBottom: v(28) }]}>
                <View style={tw`flex-row items-center`}>
                  <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13), marginRight: h(6) }]}>
                    Didn't get a code?
                  </Text>
                  <TouchableOpacity onPress={onResend} disabled={isResending || resendSeconds > 0} activeOpacity={0.7}>
                    {isResending ? (
                      <ActivityIndicator size="small" color={colors.green} />
                    ) : (
                      <Text
                        style={[
                          tw`font-associate-bold`,
                          { color: colors.green, fontSize: ms(13), opacity: resendSeconds > 0 ? 0.6 : 1 },
                        ]}>
                        {resendSeconds > 0 ? 'Resend in' : 'Resend'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {resendSeconds > 0 && (
                  <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(13) }]}>
                    {resendSeconds} sec
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={confirmCode}
                activeOpacity={0.85}
                disabled={code.length !== CODE_LENGTH || isSubmitting}
                style={[
                  tw`rounded-full items-center justify-center`,
                  {
                    backgroundColor: code.length === CODE_LENGTH ? colors.green : colors.greenTint,
                    paddingVertical: v(12),
                  },
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: ms(15) }]}>
                    Continue
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23, 24, 39, 0.22)' }}>
          <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: v(18),
              paddingBottom: v(24),
              paddingHorizontal: '8%',
              height: '75%',
            }}>
            <View
              style={{
                alignSelf: 'center',
                backgroundColor: colors.border,
                borderRadius: 999,
                height: 5,
                width: 68,
                marginBottom: v(20),
              }}
            />
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Enter country name"
              placeholderTextColor={colors.placeholder}
              style={{
                borderColor: colors.border,
                borderRadius: 999,
                borderWidth: 1.5,
                color: colors.ink,
                fontFamily: 'AssociateSansRegular',
                fontSize: ms(15),
                paddingHorizontal: h(18),
                paddingVertical: v(12),
                marginBottom: v(14),
              }}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.cca2}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onSelectCountry(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: v(10),
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}>
                  <View style={{ width: h(24), height: h(24), borderRadius: h(12), overflow: 'hidden', marginRight: h(12) }}>
                    <Image
                      source={{ uri: `https://flagcdn.com/w80/${item.cca2.toLowerCase()}.png` }}
                      style={{ width: h(24), height: h(24) }}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(14), flex: 1 }]}>
                    {getCountryDisplayName(item)}
                  </Text>
                  <Text style={[tw`font-associate`, { color: colors.grey, fontSize: ms(13) }]}>
                    +{item.callingCode[0]}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AppStack_ChangePhoneScreen;
