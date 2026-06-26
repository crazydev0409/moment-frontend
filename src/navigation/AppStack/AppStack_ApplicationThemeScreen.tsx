import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow } from '~/lib/images';
import { horizontalScale as h, verticalScale as v, moderateScale as ms } from '~/helpers/responsive';
import { colors } from '~/lib/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_ApplicationThemeScreen'>;
type ThemeOption = 'light' | 'dark' | 'auto';

const STORAGE_KEY = '@app_theme';

const RadioRow = ({
  label,
  selected,
  onPress,
  showDivider,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  showDivider: boolean;
}) => (
  <>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        tw`flex-row items-center justify-between`,
        { paddingVertical: v(17), paddingHorizontal: h(18) },
      ]}>
      <Text style={[tw`font-associate`, { color: colors.ink, fontSize: ms(15) }]}>{label}</Text>
      <View
        style={{
          width: h(22),
          height: h(22),
          borderRadius: h(11),
          borderWidth: 2,
          borderColor: selected ? colors.green : colors.border,
          backgroundColor: selected ? colors.green : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {selected && (
          <View style={{ width: h(8), height: h(8), borderRadius: h(4), backgroundColor: colors.white }} />
        )}
      </View>
    </TouchableOpacity>
    {showDivider && (
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: h(18) }} />
    )}
  </>
);

const AppStack_ApplicationThemeScreen: React.FC<Props> = ({ navigation }) => {
  const [theme, setTheme] = useState<ThemeOption>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'auto') setTheme(val);
    });
  }, []);

  const handleSelect = async (val: ThemeOption) => {
    setTheme(val);
    await AsyncStorage.setItem(STORAGE_KEY, val);
  };

  const options: { key: ThemeOption; label: string }[] = [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'auto', label: 'Automatically' },
  ];

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.pageBg }]}>
      <View
        style={[
          tw`flex-row items-center`,
          { marginTop: v(55), marginBottom: v(20), paddingHorizontal: '8%' },
        ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Image source={BackArrow} style={{ width: h(24), height: h(24) }} resizeMode="contain" />
        </TouchableOpacity>
        <View style={tw`flex-1 items-center`}>
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: ms(18.75) }]}>
            Application Theme
          </Text>
        </View>
        <View style={{ width: h(24) }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: '8%' }} showsVerticalScrollIndicator={false}>
        <View style={[tw`rounded-2xl overflow-hidden`, { backgroundColor: colors.card }]}>
          {options.map((opt, idx) => (
            <RadioRow
              key={opt.key}
              label={opt.label}
              selected={theme === opt.key}
              onPress={() => handleSelect(opt.key)}
              showDivider={idx < options.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default AppStack_ApplicationThemeScreen;
