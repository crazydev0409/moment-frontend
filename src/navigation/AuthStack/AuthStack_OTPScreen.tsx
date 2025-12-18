import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '.';
import { View, Text, Image, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import tw from '../../../tailwindcss';
import { http } from '../../helpers/http';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Loading from '../../components/Loading';
import { BackArrow, Background, SMSVerification } from '~/lib/images';
import { registerForPushNotificationsAsync } from '../../services/notificationService';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthStack_OTPScreen'>;

const AuthStack_OTPScreen: React.FC<Props> = ({ navigation, route }) => {
  const [_, setUser] = useAtom(userAtom);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const onResendCode = () => {
    if (isResending) return;

    setIsResending(true);
    http.post('/auth/generate-otp', { phoneNumber: route.params.phoneNumber })
      .then(async res => {
        if (res.status === 200) {
          setOtpSent(true);
          await new Promise(resolve => setTimeout(resolve, 2000)).then(() => setOtpSent(false));
        } else {
          alert('Failed to send OTP. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error resending OTP:', error);
        alert('Failed to send OTP. Please try again.');
      })
      .finally(() => {
        setIsResending(false);
      });
  }

  const onPressConfirmCode = () => {
    setLoading(true);
    http.post('/auth/verify', { phoneNumber: route.params.phoneNumber, code: code })
      .then(confirmResponse => {
        if (confirmResponse.status === 200) {
          http
            .post('/auth/register', { phoneNumber: route.params.phoneNumber })
            .then(async res => {
              if (res.data.isVerifiedUser) {
                navigation.navigate('AppStack');
              } else {
                navigation.navigate('AuthStack_ProfileScreen');
              }
              if (res.data.accessToken) {
                const token = res.data.accessToken;
                console.log({ token });
                // Save to axios + storage
                http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                await AsyncStorage.setItem('accessToken', token);
                const response = await http.get('/users/profile');

                // Set to your global atom
                setUser(response.data);

                // Register device for push notifications after successful OTP verification
                try {
                  await registerForPushNotificationsAsync();
                  console.log('✅ Push notifications registered after OTP verification');
                } catch (error) {
                  console.error('Failed to register push notifications:', error);
                  // Don't block navigation if notification registration fails
                }
              }

              setLoading(false);
            })
            .catch(error => {
              setLoading(false);
              console.log({ error });
            });
        } else {
          alert('Invalid OTP. Please try again.');
        }
      })
      .catch(error => {
        alert(error.message);
      })
      .finally(() => setLoading(false));
  };

  if (loading) return <Loading />;

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      <View style={tw`mt-10 mb-10 px-10`}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.5} style={tw`mb-5`}>
          <Image source={BackArrow} />
        </TouchableOpacity>
        <Image source={SMSVerification} style={tw`self-center mb-10`} />
        <Text style={tw`text-[22px] font-bold font-dm w-2/3 leading-[32px]`}>Enter Verification Code:</Text>
        <View style={tw`flex-row w-full justify-center mb-5`}>
          <View
            style={tw`flex-row items-center h-15 w-full bg-white rounded-full mt-10`}>
            <TextInput
              style={tw`bg-white rounded-lg flex-1 font-dm font-bold text-[18px]`}
              value={code}
              placeholder="Code"
              onChangeText={setCode}
              textAlign='center'
              textAlignVertical='center'
            />
          </View>
        </View>
        {otpSent ? (
          <Text style={tw`text-black font-semibold`}>
            The code sent successfully!
          </Text>
        ) : (
          <TouchableOpacity
            onPress={onResendCode}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#A3CB31" />
            ) : (
              <Text style={tw`underline text-black font-semibold`}>
                Didn't Get A Code?
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      <View style={tw`absolute bottom-0 w-full flex-col items-center`}>
        <TouchableOpacity
          onPress={onPressConfirmCode}
          activeOpacity={0.7}
          disabled={loading}
        >
          <View
            style={tw`bg-[#A3CB31] rounded-full h-15 w-60 mb-10 justify-center items-center shadow-lg ${loading ? 'opacity-50' : ''}`}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={tw`text-white text-base font-bold font-dm`}>
                Send
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default AuthStack_OTPScreen;
