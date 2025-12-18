import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from '../../tailwindcss';
import { HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, AddIcon } from '~/lib/images';
import { AppStackParamList } from '~/navigation/AppStack';

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
    <View style={tw`absolute left-0 right-0 bottom-5 justify-center flex-row gap-2`}>
      <View style={tw`flex-row items-center gap-2 rounded-full p-[10px] bg-black overflow-hidden`}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleHomePress}
          style={tw`${selectedTab === 'home' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full p-4 items-center justify-center`}
        >
          <Image source={HomeIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCalendarPress}
          style={tw`${selectedTab === 'calendar' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full p-4 items-center justify-center`}
        >
          <Image source={CalendarIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBusinessPress}
          style={tw`${selectedTab === 'business' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full p-4 items-center justify-center`}
        >
          <Image source={BusinessIcon} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleProfilePress}
          style={tw`${selectedTab === 'profile' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full p-4 items-center justify-center`}
        >
          <Image source={ProfileIcon} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={tw`p-[26px] bg-black rounded-full items-center justify-center`}
        activeOpacity={0.7}
        onPress={onAddPress}
      >
        <Image source={AddIcon} tintColor="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

export default BottomNavigationBar;

