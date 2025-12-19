import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '../../../tailwindcss';
import { AppStackParamList } from '.';
import { Background, BackArrow } from '~/lib/images';

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
      <View style={[tw`pt-16 pb-4`, { paddingHorizontal: '4%' }]}>
        <View style={tw`flex-row items-center`}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={tw`mr-4`}
          >
            <Image source={BackArrow} />
          </TouchableOpacity>
          <Text style={tw`text-lg font-bold font-dm text-black`}>Business</Text>
        </View>
      </View>

      {/* Content */}
      <View style={[tw`flex-1 items-center justify-center`, { paddingHorizontal: '4%' }]}>
        <Text style={tw`text-4xl font-bold font-dm text-black mb-4`}>
          Coming Soon
        </Text>
        <Text style={tw`text-base font-dm text-grey text-center`}>
          This feature is currently under development.
        </Text>
        <Text style={tw`text-base font-dm text-grey text-center mt-2`}>
          Stay tuned for updates!
        </Text>
      </View>
    </View>
  );
};

export default AppStack_ComingSoonScreen;

