import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { AuthStackParamList } from '.';
import tw from '~/tailwindcss';
import { CreateAccountBackground } from '~/lib/images';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'AuthStack_CreateAccountScreen'
>;
const AuthStack_CreateAccountScreen: React.FC<Props> = ({ navigation, route }) => {

  const onPressSignUp = () => {

    navigation.navigate('AuthStack_SignupScreen');

  }


  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={CreateAccountBackground} style={tw`absolute w-full h-full`} />
      <View style={[tw`absolute w-full flex-col items-center`, { bottom: verticalScale(75) }]}>
        <TouchableOpacity onPress={onPressSignUp} activeOpacity={0.7}>
          <View
            style={[
              tw`bg-[#A3CB31] rounded-full justify-center items-center shadow-lg`,
              {
                height: verticalScale(56),
                width: horizontalScale(225),
                marginBottom: verticalScale(37.5)
              }
            ]}>
            <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
              Create Account
            </Text>
          </View>
        </TouchableOpacity>
        <View style={tw`flex-row justify-around`}>
          {/* Privacy Policy */}
          <TouchableOpacity
            onPress={() => Linking.openURL("https://your-privacy-policy-url.com")}
            style={{ marginRight: horizontalScale(37.5) }}
          >
            <Text style={[tw`underline text-black font-semibold`, { fontSize: moderateScale(13) }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          {/* Terms & Conditions */}
          <TouchableOpacity
            onPress={() => Linking.openURL("https://your-terms-url.com")}
          >
            <Text style={[tw`underline text-black font-semibold`, { fontSize: moderateScale(13) }]}>
              Terms & Conditions
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default AuthStack_CreateAccountScreen;
