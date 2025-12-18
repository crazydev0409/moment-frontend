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
import tw from 'tailwindcss';
import { CreateAccountBackground } from '~/lib/images';
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
      <View style={tw`absolute bottom-20 w-full flex-col items-center`}>
        <TouchableOpacity onPress={onPressSignUp} activeOpacity={0.7}>
          <View
            style={tw`bg-[#A3CB31] rounded-full h-15 w-60 mb-10 justify-center items-center shadow-lg`}>
            <Text style={tw`text-white text-base font-bold font-dm`}>
              Create Account
            </Text>
          </View>
        </TouchableOpacity>
        <View style={tw`flex-row justify-around`}>
          {/* Privacy Policy */}
          <TouchableOpacity
            onPress={() => Linking.openURL("https://your-privacy-policy-url.com")}
            style={tw`mr-10`}
          >
            <Text style={tw`underline text-black font-semibold`}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          {/* Terms & Conditions */}
          <TouchableOpacity
            onPress={() => Linking.openURL("https://your-terms-url.com")}
          >
            <Text style={tw`underline text-black font-semibold`}>
              Terms & Conditions
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default AuthStack_CreateAccountScreen;
