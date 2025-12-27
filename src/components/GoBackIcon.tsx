import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import tw from '~/tailwindcss';
import { Cancel, Cross } from '../lib/images';
import { horizontalScale } from '~/helpers/responsive';
const GoBackIcon = ({ onPress }: { onPress: () => void }) => {
  return (
    <TouchableOpacity activeOpacity={0.5} onPress={onPress}>
      <Image source={Cancel} style={{ width: horizontalScale(35.625), height: horizontalScale(35.625) }} />
      <View style={[tw`absolute w-full`, { top: horizontalScale(9.375), left: horizontalScale(9.375) }]}>
        <Image source={Cross} style={[tw`z-50`, { width: horizontalScale(16.875), height: horizontalScale(16.875) }]} />
      </View>
    </TouchableOpacity>
  );
};

export default GoBackIcon;
