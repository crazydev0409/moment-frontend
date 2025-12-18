import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import tw from '../../../tailwindcss';
import countries from '../../lib/countryCode';
import { AuthStackParamList } from '.';
import { http } from '../../helpers/http';
import { BackArrow, Background, PhoneNumberpad } from '~/lib/images';
type Props = NativeStackScreenProps<
  AuthStackParamList,
  'AuthStack_SignupScreen'
>;
const regexp = /^\+[0-9]?()[0-9](\s|\S)(\d[0-9]{8,16})$/;
const initialCode = 'US';
const AuthStack_SignupScreen: React.FC<Props> = ({ navigation, route }) => {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(initialCode);
  const [isSending, setIsSending] = useState(false);
  const countryNumber = countries.find(
    country => country.code === countryCode,
  )?.dial_code;

  const onSendCode = () => {
    const phoneNumber = `${countryNumber}${phone}`;
    if (!regexp.test(phoneNumber)) {
      alert('Please Enter Phone Number');
      return;
    }
    if (isSending) return;
    
    setIsSending(true);
    http.post('/auth/generate-otp', { phoneNumber: phoneNumber })
      .then(res => {
        if (res.status === 200) {
          navigation.navigate('AuthStack_OTPScreen', {
            phoneNumber,
            countryCode,
          });
        } else {
          alert('Failed to send OTP. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error sending OTP:', error);
        alert('Failed to send OTP. Please try again.');
      })
      .finally(() => {
        setIsSending(false);
      });
  }

  useEffect(() => {
    if (route.params?.countryCode) {
      setCountryCode(route.params.countryCode);
    }
  }, [route.params?.countryCode]);

  const onPressCountry = () => {
    navigation.navigate('AuthStack_CountryScreen');
  };

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      <View style={tw`mt-10 mb-10 px-10`}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.5} style={tw`mb-5`}>
          <Image source={BackArrow} />
        </TouchableOpacity>
        <Image source={PhoneNumberpad} style={tw`self-center mb-10`} />
        <Text style={tw`text-[22px] font-bold font-dm w-2/3 leading-[32px]`}>What's your phone number?</Text>
        <View style={tw`flex-row w-full justify-center`}>
          <View
            style={tw`flex-row items-center h-15 w-full bg-white rounded-full mt-10`}>
            <TouchableOpacity onPress={onPressCountry} activeOpacity={0.5}>
              <Image
                width={60}
                height={30}
                source={{
                  uri: `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`,
                }}
                style={tw`mx-2.5`}
              />
            </TouchableOpacity>
            <Text style={tw`text-black text-[18px] font-dm font-bold`}>
              {countryNumber}
            </Text>
            <TextInput
              style={tw`bg-white rounded-lg flex-1 font-dm font-bold text-[18px] mt-0.7`}
              value={phone}
              placeholder="Phone Number?"
              onChangeText={setPhone}
            />

          </View>
        </View>
      </View>
      <View style={tw`absolute bottom-0 w-full flex-col items-center`}>
        <TouchableOpacity 
          onPress={onSendCode} 
          activeOpacity={0.7}
          disabled={isSending}
        >
          <View
            style={tw`bg-[#A3CB31] rounded-full h-15 w-60 mb-10 justify-center items-center shadow-lg ${isSending ? 'opacity-50' : ''}`}>
            {isSending ? (
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

export default AuthStack_SignupScreen;
