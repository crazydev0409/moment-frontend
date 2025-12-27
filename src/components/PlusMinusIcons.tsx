import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import tw from '~/tailwindcss';
import { Cancel, Cross } from '../lib/images';
import { horizontalScale, moderateScale } from '~/helpers/responsive';
const DecreaseIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={tw`opacity-50`}>
      <Image source={Cancel} style={{ width: horizontalScale(16.875), height: horizontalScale(16.875) }} />
      <View style={tw`absolute -top-[1.5px] left-[6px] w-full`}>
        <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(13.125) }]}>-</Text>
      </View>
    </TouchableOpacity>
  );
};

const IncreaseIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity activeOpacity={0.5} onPress={onPress}>
      <Image source={Cancel} style={{ width: horizontalScale(16.875), height: horizontalScale(16.875) }} />
      <View style={tw`absolute -top-[1px] left-[5px] w-full`}>
        <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(13.125) }]}>+</Text>
      </View>
    </TouchableOpacity>
  );
};

export { IncreaseIcon, DecreaseIcon };
