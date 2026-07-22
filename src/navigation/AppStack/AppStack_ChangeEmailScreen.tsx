import React, { useEffect, useRef, useState } from 'react';
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

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ChangeEmailScreen'>;

const CODE_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AppStack_ChangeEmailScreen: React.FC<Props> = ({ navigation, route }) => {
  const [step, setStep] = useState<'input' | 'code'>('input');
  const [email, setEmail] = useState(route.params?.currentEmail || '');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);
  const codeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (step !== 'code') return;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const codeDigits = Array.from({ length: CODE_LENGTH }, (_, index) => code[index] ?? '');

  const sendCode = async () => {
    if (!isEmailValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await http.post('/users/change-email/start', { newEmail: email.trim().toLowerCase() });
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
      await http.post('/users/change-email/start', { newEmail: email.trim().toLowerCase() });
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
      await http.post('/users/change-email/confirm', { code });
      Alert.alert('Email updated', 'Your email address has been updated.', [
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
            <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(18.75) }]}>
              Change your email
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
                Enter email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoFocus
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: colors.greenSoft,
                  paddingHorizontal: h(20),
                  paddingVertical: v(16),
                  fontFamily: 'AssociateSansRegular',
                  fontSize: ms(16),
                  color: colors.ink,
                }}
              />

              <TouchableOpacity
                onPress={sendCode}
                activeOpacity={0.85}
                disabled={!isEmailValid || isSubmitting}
                style={[
                  tw`rounded-full items-center justify-center`,
                  {
                    backgroundColor: isEmailValid ? colors.green : colors.greenTint,
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
                We sent a verification code to {email.trim().toLowerCase()}. Enter it below.
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
    </View>
  );
};

export default AppStack_ChangeEmailScreen;
