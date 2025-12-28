import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { Background, BackArrow } from '~/lib/images';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<
  AppStackParamList,
  'AppStack_ComingSoonScreen'
>;

const AppStack_ComingSoonScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      {/* Header */}
      <View style={[{ paddingTop: verticalScale(60), paddingBottom: verticalScale(15) }, { paddingHorizontal: '4%' }]}>
        <View style={tw`flex-row items-center`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={{ marginRight: horizontalScale(15) }}
          >
            <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={[tw`font-bold font-dm text-black`, { fontSize: moderateScale(18.75) }]}>Business</Text>
        </View>
      </View>

      {/* Content */}
      <View style={[tw`flex-1 items-center justify-center`, { paddingHorizontal: '4%' }]}>
        <Text style={[tw`font-bold font-dm text-black`, { fontSize: moderateScale(33.75), marginBottom: verticalScale(15) }]}>
          Coming Soon
        </Text>
        <Text style={[tw`font-dm text-grey text-center`, { fontSize: moderateScale(15) }]}>
          This feature is currently under development.
        </Text>
        <Text style={[tw`font-dm text-grey text-center`, { fontSize: moderateScale(15), marginTop: verticalScale(7.5) }]}>
          Stay tuned for updates!
        </Text>
      </View>
    </View>
  );
};

export default AppStack_ComingSoonScreen;

