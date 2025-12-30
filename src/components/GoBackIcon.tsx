import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import tw from '~/tailwindcss';
// import { Cancel, Cross } from '../lib/images'; // Temporarily disabled
import { horizontalScale } from '~/helpers/responsive';
const GoBackIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      onPress={onPress}
      style={[tw`bg-red-500 rounded-full justify-center items-center`, { width: horizontalScale(35.625), height: horizontalScale(35.625) }]}>
      <View style={[tw`w-full justify-center items-center`, { top: horizontalScale(9.375), left: horizontalScale(9.375) }]}>
        <View style={[tw`bg-white`, { width: horizontalScale(16.875), height: horizontalScale(2) }]} />
        <View style={[tw`bg-white absolute`, { width: horizontalScale(2), height: horizontalScale(16.875) }]} />
      </View>
    </TouchableOpacity>
  );
};

export default GoBackIcon;
