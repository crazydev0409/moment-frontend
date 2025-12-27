import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from '~/tailwindcss';
import { HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, AddIcon } from '~/lib/images';
import { AppStackParamList } from '~/navigation/AppStack';
import { horizontalScale, verticalScale } from '~/helpers/responsive';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface BottomNavigationBarProps {
  selectedTab?: string;
  onAddPress?: () => void;
  onHomePress?: () => void;
  onCalendarPress?: () => void;
  onBusinessPress?: () => void;
  onProfilePress?: () => void;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  selectedTab = 'home',
  onAddPress,
  onHomePress,
  onCalendarPress,
  onBusinessPress,
  onProfilePress
}) => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const handleHomePress = () => {
    if (onHomePress) {
      onHomePress();
    } else {
      navigation.navigate('AppStack_HomePageScreen');
    }
  };

  const handleCalendarPress = () => {
    if (onCalendarPress) {
      onCalendarPress();
    } else {
      navigation.navigate('AppStack_CalendarScreen');
    }
  };

  const handleBusinessPress = () => {
    if (onBusinessPress) {
      onBusinessPress();
    } else {
      navigation.navigate('AppStack_ComingSoonScreen');
    }
  };

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      navigation.navigate('AppStack_ContactScreen');
    }
  };

  return (
    <View style={[tw`absolute left-0 right-0 justify-center flex-row`, { gap: horizontalScale(7.5), bottom: Math.max(insets.bottom, 20) }]}>
      <View style={[tw`flex-row items-center rounded-full bg-black overflow-hidden`, { gap: horizontalScale(7.5), padding: verticalScale(9.375) }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleHomePress}
          style={[tw`${selectedTab === 'home' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
        >
          <Image source={HomeIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCalendarPress}
          style={[tw`${selectedTab === 'calendar' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
        >
          <Image source={CalendarIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBusinessPress}
          style={[tw`${selectedTab === 'business' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
        >
          <Image source={BusinessIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleProfilePress}
          style={[tw`${selectedTab === 'profile' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
        >
          <Image source={ProfileIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[tw`bg-black rounded-full items-center justify-center`, { padding: horizontalScale(24.375) }]}
        activeOpacity={0.7}
        onPress={onAddPress}
      >
        <Image source={AddIcon} tintColor="#FFFFFF" style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
      </TouchableOpacity>
    </View>
  );
};

export default BottomNavigationBar;

