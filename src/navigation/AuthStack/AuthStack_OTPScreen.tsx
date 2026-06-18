import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAtom } from 'jotai';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthStackParamList } from '.';
import Loading from '../../components/Loading';
import { http } from '../../helpers/http';
import { getDeviceInfo } from '../../services/deviceService';
import { registerPushToken } from '../../services/notificationService';
import { userAtom } from '../../store';

import { BackArrow, SMSVerification } from '~/lib/images';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthStack_OTPScreen'>;

const OTP_LENGTH = 6;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const AuthStack_OTPScreen: React.FC<Props> = ({ navigation, route }) => {
  const [, setUser] = useAtom(userAtom);
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);

  const isCompactHeight = height < 720;
  const sidePadding = clamp(width * 0.043, 16, 24);
  const contentHeight = height - insets.top - insets.bottom;
  const heroHeight = clamp(height * 0.19, 142, 154);
  const titleSize = clamp(width * 0.074, 28, 31);
  const otpBoxHeight = clamp(height * 0.066, 56, 64);
  const buttonHeight = clamp(height * 0.068, 58, 64);
  const otpDigits = Array.from({ length: OTP_LENGTH }, (_, index) => code[index] ?? '');

  useEffect(() => {
    const timer = setInterval(() => {
      setResendSeconds((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const onResendCode = () => {
    if (isResending || resendSeconds > 0) return;

    setIsResending(true);
    http
      .post('/auth/generate-otp', { phoneNumber: route.params.phoneNumber })
      .then(async (res) => {
        if (res.status === 200) {
          setOtpSent(true);
          setResendSeconds(30);
          await new Promise((resolve) => setTimeout(resolve, 2000)).then(() => setOtpSent(false));
        } else {
          alert('Failed to send OTP. Please try again.');
        }
      })
      .catch((error) => {
        console.error('Error resending OTP:', error);
        alert('Failed to send OTP. Please try again.');
      })
      .finally(() => {
        setIsResending(false);
      });
  };

  const onPressConfirmCode = () => {
    if (code.length !== OTP_LENGTH) {
      alert('Please enter the verification code.');
      return;
    }

    setLoading(true);
    http
      .post('/auth/verify', { phoneNumber: route.params.phoneNumber, code })
      .then((confirmResponse) => {
        if (confirmResponse.status === 200) {
          http
            .post('/auth/register', { phoneNumber: route.params.phoneNumber })
            .then(async (res) => {
              if (res.data.accessToken) {
                const token = res.data.accessToken;

                http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                await AsyncStorage.setItem('accessToken', token);
                const response = await http.get('/users/profile');

                setUser(response.data);

                try {
                  const [deviceInfo, pushToken] = await Promise.all([
                    getDeviceInfo(),
                    registerPushToken(),
                  ]);

                  await http.post('/devices/register', {
                    ...deviceInfo,
                    rememberMe: route.params.rememberMe || false,
                    ...(pushToken ? { pushToken } : {}),
                  });
                } catch (error) {
                  console.error('Failed to register device:', error);
                }
              }
              if (res.data.isVerifiedUser) {
                navigation.navigate('AppStack');
              } else {
                navigation.navigate('AuthStack_ProfileScreen');
              }

              setLoading(false);
            })
            .catch((error) => {
              setLoading(false);
              console.log({ error });
            });
        } else {
          alert('Invalid OTP. Please try again.');
        }
      })
      .catch((error) => {
        alert(error.message);
      })
      .finally(() => setLoading(false));
  };

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              minHeight: contentHeight,
              paddingHorizontal: sidePadding,
              paddingTop: isCompactHeight ? 15 : 23,
              paddingBottom: Math.max(insets.bottom + 18, 28),
            },
          ]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.6}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.backButton}>
            <Image source={BackArrow} style={styles.backIcon} resizeMode="contain" />
          </TouchableOpacity>

          <View
            style={[
              styles.heroCard,
              {
                height: heroHeight,
                marginTop: isCompactHeight ? 22 : 39,
              },
            ]}>
            <Image
              source={SMSVerification}
              resizeMode="contain"
              style={[
                styles.heroImage,
                {
                  height: heroHeight,
                  width: Math.min(width - sidePadding * 2, 350),
                },
              ]}
            />
          </View>

          <Text
            style={[
              styles.title,
              {
                fontSize: titleSize,
                lineHeight: titleSize * 1.2,
                marginTop: isCompactHeight ? 31 : 69,
              },
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}>
            Enter verification code:
          </Text>

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => inputRef.current?.focus()}
            style={[
              styles.otpRow,
              {
                gap: clamp(width * 0.016, 5, 10),
                marginTop: isCompactHeight ? 26 : 33,
              },
            ]}>
            {otpDigits.map((digit, index) => (
              <View
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                style={[
                  styles.otpBox,
                  {
                    height: otpBoxHeight,
                    width: (width - sidePadding * 2 - clamp(width * 0.016, 5, 10) * 5) / 6,
                  },
                ]}>
                <Text style={styles.otpDigit}>{digit || '0'}</Text>
              </View>
            ))}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={code}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            onChangeText={(text) => {
              setCode(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH));
            }}
          />

          <View
            style={[
              styles.resendRow,
              {
                marginTop: isCompactHeight ? 21 : 25,
              },
            ]}>
            <View style={styles.resendCopy}>
              <Text style={styles.resendMuted}>Didn't get a code?</Text>
              <TouchableOpacity
                onPress={onResendCode}
                disabled={isResending || resendSeconds > 0}
                activeOpacity={0.7}>
                {isResending ? (
                  <ActivityIndicator size="small" color="#9BC425" />
                ) : (
                  <Text
                    style={[styles.resendAction, resendSeconds > 0 && styles.resendActionDisabled]}>
                    {otpSent ? 'Sent' : resendSeconds > 0 ? 'Resend In' : 'Resend'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.timerText}>{resendSeconds || 0} sec</Text>
          </View>

          <TouchableOpacity
            onPress={onPressConfirmCode}
            activeOpacity={0.8}
            disabled={loading}
            style={[
              styles.continueButton,
              {
                height: buttonHeight,
                marginTop: isCompactHeight ? 37 : 50,
                opacity: loading ? 0.65 : 1,
              },
            ]}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    height: 22,
    tintColor: '#171827',
    width: 22,
  },
  heroCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7EBF0',
    borderRadius: 39,
    borderWidth: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroImage: {
    marginBottom: -2,
  },
  title: {
    color: '#171827',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
  },
  otpRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  otpBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7EBF0',
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
  },
  otpDigit: {
    color: '#A8B1BE',
    fontFamily: 'Inter_400Regular',
    fontSize: 20,
    lineHeight: 25,
  },
  hiddenInput: {
    height: 1,
    opacity: 0,
    position: 'absolute',
    width: 1,
  },
  resendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resendCopy: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  resendMuted: {
    color: '#737B85',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
    marginRight: 8,
  },
  resendAction: {
    color: '#9BC425',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  resendActionDisabled: {
    opacity: 0.9,
  },
  timerText: {
    color: '#171827',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 22,
  },
  continueButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#CBE783',
    borderRadius: 999,
    justifyContent: 'center',
  },
  continueText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: 0,
    lineHeight: 24,
  },
});

export default AuthStack_OTPScreen;
