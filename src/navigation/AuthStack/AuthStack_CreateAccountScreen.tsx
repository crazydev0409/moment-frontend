import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthStackParamList } from '.';

import { horizontalScale, moderateScale, verticalScale } from '~/helpers/responsive';
import { CreateAccountHero } from '~/lib/images';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthStack_CreateAccountScreen'>;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const AuthStack_CreateAccountScreen: React.FC<Props> = ({ navigation }) => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompactHeight = height < 720;
  const sidePadding = clamp(horizontalScale(16), 16, 28);
  const contentHeight = height - insets.top - insets.bottom;
  const heroHeight = clamp(
    height * (isCompactHeight ? 0.4 : 0.48),
    verticalScale(260),
    verticalScale(398)
  );
  const heroWidth = Math.min(width, horizontalScale(390));

  const onPressSignUp = () => {
    navigation.navigate('AuthStack_SignupScreen');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            minHeight: contentHeight,
            paddingHorizontal: sidePadding,
            paddingTop: isCompactHeight ? verticalScale(6) : verticalScale(14),
            paddingBottom: Math.max(insets.bottom + verticalScale(24), verticalScale(42)),
          },
        ]}>
        <Image
          source={CreateAccountHero}
          resizeMode="contain"
          style={[
            styles.hero,
            {
              width: heroWidth,
              height: heroHeight,
              marginBottom: isCompactHeight ? verticalScale(14) : verticalScale(26),
            },
          ]}
        />

        <View style={styles.copyBlock}>
          <Text
            style={[
              styles.title,
              {
                fontSize: moderateScale(isCompactHeight ? 40 : 44),
                lineHeight: moderateScale(isCompactHeight ? 46 : 50),
              },
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}>
            WELCOME
          </Text>
          <Text
            style={[
              styles.description,
              {
                fontSize: moderateScale(isCompactHeight ? 13 : 14),
                lineHeight: moderateScale(isCompactHeight ? 19 : 21),
                marginTop: verticalScale(11),
              },
            ]}>
            Catch is your key to easier planning. From business meetings to friendly hangouts, it
            helps you organize time, connect with people, and make every moment count.
          </Text>
        </View>

        <TouchableOpacity
          onPress={onPressSignUp}
          activeOpacity={0.8}
          style={[
            styles.button,
            {
              height: verticalScale(56),
              marginTop: isCompactHeight ? verticalScale(28) : verticalScale(44),
            },
          ]}>
          <Text
            style={[
              styles.buttonText,
              {
                fontSize: moderateScale(18),
                lineHeight: moderateScale(22),
              },
            ]}>
            Get Started
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.links,
            {
              marginTop: isCompactHeight ? verticalScale(28) : verticalScale(39),
              gap: clamp(horizontalScale(38), 24, 55),
            },
          ]}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://catch-policy.vercel.app/')}
            activeOpacity={0.7}>
            <Text style={[styles.linkText, { fontSize: moderateScale(15) }]}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Linking.openURL('https://catch-terms.vercel.app/')}
            activeOpacity={0.7}>
            <Text style={[styles.linkText, { fontSize: moderateScale(15) }]}>
              Terms & Conditions
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  scrollContent: {
    alignItems: 'center',
  },
  hero: {
    alignSelf: 'center',
  },
  copyBlock: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    color: '#171827',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
    textAlign: 'center',
  },
  description: {
    color: '#737B85',
    fontFamily: 'Inter_400Regular',
    maxWidth: horizontalScale(340),
    letterSpacing: 0,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#9BC425',
    borderRadius: 999,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
    textAlign: 'center',
  },
  links: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  linkText: {
    color: '#171827',
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});

export default AuthStack_CreateAccountScreen;
