import React, { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import tw from '~/tailwindcss';
import { AuthStackParamList } from '.';
import { http } from '../../helpers/http';
import { BackArrow, Background, PhoneNumberpad } from '~/lib/images';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import CountryPicker, { Country } from 'react-native-country-picker-modal';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'AuthStack_SignupScreen'
>;
const regexp = /^\+[0-9]?()[0-9](\s|\S)(\d[0-9]{8,16})$/;
const initialCode = 'US';
const initialCallingCode = '1';

const AuthStack_SignupScreen: React.FC<Props> = ({ navigation, route }) => {
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(initialCode);
  const [callingCode, setCallingCode] = useState(initialCallingCode);
  const [isSending, setIsSending] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const onSendCode = () => {
    const phoneNumber = `+${callingCode}${phone}`;
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
            rememberMe,
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

  // Removed useEffect for route params since we use local state for picker
  // Removed onPressCountry since we use the modal picker directly

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />
      <View style={[{ marginTop: verticalScale(37.5), marginBottom: verticalScale(37.5) }, { paddingHorizontal: '8%' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.5} style={{ marginBottom: verticalScale(18.75) }}>
          <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <Image source={PhoneNumberpad} style={[tw`self-center`, { marginBottom: verticalScale(37.5) }]} />
        <Text style={[tw`font-bold font-dm w-2/3`, { fontSize: moderateScale(20.625), lineHeight: moderateScale(30) }]}>What's your phone number?</Text>
        <View style={tw`flex-row w-full justify-center`}>
          <View
            style={[tw`flex-row items-center w-full bg-white rounded-full`, { height: verticalScale(56.25), marginTop: verticalScale(37.5) }]}>

            <View style={{ marginLeft: horizontalScale(9.375), marginRight: horizontalScale(5) }}>
              <TouchableOpacity onPress={() => setPickerVisible(true)} activeOpacity={0.5} style={tw`flex-row items-center`}>
                <Image
                  source={{
                    uri: `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`,
                  }}
                  style={{ width: horizontalScale(56.25), height: verticalScale(28.125) }}
                  resizeMode="cover"
                />
              </TouchableOpacity>

              <Modal
                visible={pickerVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPickerVisible(false)}
              >
                <View style={tw`flex-1 justify-center bg-black/50`}>
                  <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
                    <View style={tw`absolute w-full h-full`} />
                  </TouchableWithoutFeedback>
                  <View style={{
                    height: verticalScale(500),
                    marginTop: verticalScale(150),
                    backgroundColor: 'white',
                    marginHorizontal: horizontalScale(20),
                    borderRadius: 20,
                    shadowColor: '#000',
                    shadowOffset: {
                      width: 0,
                      height: 2,
                    },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5,
                    overflow: 'hidden',
                    padding: horizontalScale(20),
                  }}>
                    <CountryPicker
                      countryCode={countryCode as any}
                      withFilter
                      withFlag
                      withCallingCode
                      withAlphaFilter={false}
                      withCurrencyButton={false}
                      onSelect={(country: Country) => {
                        setCountryCode(country.cca2);
                        setCallingCode(country.callingCode[0]);
                        setPickerVisible(false);
                      }}
                      visible={true}
                      withModal={false}
                    />
                  </View>
                </View>
              </Modal>
            </View>

            <Text style={[tw`text-black font-dm font-bold`, { fontSize: moderateScale(16.875) }]}>
              +{callingCode}
            </Text>
            <TextInput
              style={[tw`bg-white rounded-lg flex-1 font-dm font-bold`, { fontSize: moderateScale(16.875), marginTop: verticalScale(2.625) }]}
              value={phone}
              placeholder="Phone Number?"
              onChangeText={setPhone}
            />

          </View>
        </View>

        {/* Remember Me Checkbox */}
        <TouchableOpacity
          onPress={() => setRememberMe(!rememberMe)}
          activeOpacity={0.7}
          style={[tw`flex-row items-center`, { marginTop: verticalScale(15) }]}
        >
          <View
            style={[
              tw`border-2 rounded-md items-center justify-center`,
              { width: horizontalScale(20), height: horizontalScale(20), borderColor: rememberMe ? '#A3CB31' : '#D1D5DB' },
              rememberMe && tw`bg-[#A3CB31]`
            ]}
          >
            {rememberMe && (
              <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(14) }]}>✓</Text>
            )}
          </View>
          <Text style={[tw`text-black font-dm ml-2`, { fontSize: moderateScale(13) }]}>
            Remember me on this device
          </Text>
        </TouchableOpacity>
      </View>
      <View style={tw`absolute bottom-0 w-full flex-col items-center`}>
        <TouchableOpacity
          onPress={onSendCode}
          activeOpacity={0.7}
          disabled={isSending}
        >
          <View
            style={[tw`bg-[#A3CB31] rounded-full justify-center items-center shadow-lg ${isSending ? 'opacity-50' : ''}`, { height: verticalScale(56.25), width: horizontalScale(225), marginBottom: verticalScale(37.5) }]}>
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
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
