import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from '~/tailwindcss';
// import { Cancel, Cross } from '../lib/images'; // Temporarily disabled
import { horizontalScale, moderateScale } from '~/helpers/responsive';
const DecreaseIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={[tw`bg-gray-600 rounded-full justify-center items-center`, { width: horizontalScale(16.875), height: horizontalScale(16.875) }]}>
      <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(13.125) }]}>-</Text>
    </TouchableOpacity>
  );
};

const IncreaseIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={[tw`bg-blue-500 rounded-full justify-center items-center`, { width: horizontalScale(16.875), height: horizontalScale(16.875) }]}>
      <Text style={[tw`text-white font-bold`, { fontSize: moderateScale(13.125) }]}>+</Text>
    </TouchableOpacity>
  );
};

export { IncreaseIcon, DecreaseIcon };
