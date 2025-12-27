import React from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tw from '~/tailwindcss';
import countries from '../../lib/countryCode';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '.';
import GoBackIcon from '../../components/GoBackIcon';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'AuthStack_CountryScreen'
>;

interface CountryCodeCardProps {
  flag: string;
  country: string;
  code: string;
  onPress: (flag: string) => void;
}

const CountryCodeCard: React.FC<CountryCodeCardProps> = ({ flag, country, code, onPress }) => {
  return (
    <TouchableOpacity onPress={() => onPress(flag)} activeOpacity={0.5}>
      <View
        style={[tw`flex-row items-center bg-white rounded-[13px] w-full font-dm font-bold`, { height: verticalScale(65.625), marginBottom: verticalScale(26.25), paddingHorizontal: horizontalScale(3.75), fontSize: moderateScale(13.125), letterSpacing: horizontalScale(0.375) }]}>
        <View style={tw`w-1/2 flex-row items-center`}>
          <View
            style={[tw`rounded-[13px] overflow-hidden`, { height: verticalScale(28.125), width: horizontalScale(56.25), marginLeft: horizontalScale(5.625), marginRight: horizontalScale(18.75) }]}>
            <Image
              style={{ width: horizontalScale(56.25), height: verticalScale(28.125) }}
              source={{
                uri: `https://flagcdn.com/w320/${flag.toLowerCase()}.png`,
              }}
              resizeMode="cover"
            />
          </View>
          {/* <Image source={flag} style={tw`w-[15vw] h-[7.5vw] ml-1.5 mr-5`} /> */}
          <Text style={[tw`text-[#93999A] font-dm font-bold`, { fontSize: moderateScale(13.125) }]}>
            {code}
          </Text>
        </View>
        <Text style={[tw`text-black font-bold font-dm flex-shrink`, { fontSize: moderateScale(13.125) }]}>
          {String(country).toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
const AuthStack_CountryScreen: React.FC<Props> = ({ navigation, route }) => {
  const onPressGoBack = () => {
    navigation.goBack();
  };
  const onPressCode = (flag: string) => {
    navigation.navigate('AuthStack_SignupScreen', {
      countryCode: flag,
    });
  };
  return (
    <LinearGradient
      colors={['#FFF', '#1BF2DD']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={tw`flex-1 relative`}>
      <View style={tw`flex-1`}>
        <View style={[tw`flex-row items-center`, { marginTop: verticalScale(18.75), marginLeft: horizontalScale(18.75), marginBottom: verticalScale(37.5) }]}>
          <TouchableOpacity onPress={onPressGoBack} activeOpacity={0.5}>
            <View>
              <GoBackIcon onPress={() => navigation.goBack()} />
            </View>
          </TouchableOpacity>
          <Text style={[tw`font-abril text-black`, { fontSize: moderateScale(16.875), marginLeft: horizontalScale(18.75) }]}>
            Country Code
          </Text>
        </View>
        <View style={{ marginHorizontal: horizontalScale(11.25) }}>
          <FlatList
            data={countries}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item: { name, dial_code, code } }) => (
              <CountryCodeCard
                flag={code}
                country={name}
                code={dial_code}
                onPress={onPressCode}
              />
            )}
          />
        </View>
      </View>
    </LinearGradient>
  );
};

export default AuthStack_CountryScreen;
