import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, Text } from 'react-native';
import tw from '~/tailwindcss';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = {
  children: React.ReactNode;
  open: boolean;
  title: string;
  smallTitle: string;
  value: string;
  onPress: () => void;
  cardHeight?: number;
};
const AnimationCard: React.FC<Props> = ({
  children,
  open,
  title,
  smallTitle,
  value,
  onPress,
  cardHeight = Dimensions.get('window').height / 2.5,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const startHeight = screenWidth * 0.16; // Approx 64px equivalent (16vw)
  const titleHeight = screenWidth * 0.08; // Approx 30px equivalent (8vw)

  const height = useRef(new Animated.Value(startHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const fadeAnim1 = useRef(new Animated.Value(1)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const height1 = fadeAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, startHeight],
  });
  const height2 = fadeAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, titleHeight],
  });
  Animated.timing(height, {
    toValue: open ? cardHeight : startHeight,
    duration: 200,
    useNativeDriver: false,
  }).start();

  Animated.timing(opacity, {
    toValue: open ? 1 : 0,
    duration: 100,
    useNativeDriver: false,
  }).start();

  Animated.timing(fadeAnim1, {
    toValue: open ? 0 : 1,
    duration: 200,
    useNativeDriver: false,
  }).start();

  Animated.timing(fadeAnim2, {
    toValue: open ? 1 : 0,
    duration: 200,
    useNativeDriver: false,
  }).start();

  return (
    <Animated.View style={{ width: '100%', borderRadius: horizontalScale(13.125), backgroundColor: 'white', marginBottom: verticalScale(26.25), height }}>
      <Pressable onPress={onPress}>
        <Animated.View
          style={{
            width: '100%',
            borderRadius: horizontalScale(13.125),
            backgroundColor: 'white',
            marginBottom: verticalScale(26.25),
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: fadeAnim1,
            height: height1,
          }}>
          <Text
            style={[tw`mb-0 font-dm text-black font-bold`, { marginLeft: horizontalScale(22.5), fontSize: moderateScale(13.125), height: verticalScale(16.875) }]}>
            {smallTitle}
          </Text>
          <Text
            style={[tw`mb-0 font-dm text-black font-bold`, { marginRight: horizontalScale(22.5), fontSize: moderateScale(13.125), height: verticalScale(16.875) }]}>
            {value}
          </Text>
        </Animated.View>
      </Pressable>
      <Animated.Text
        style={{
          marginLeft: horizontalScale(22.5),
          marginBottom: verticalScale(26.25),
          fontFamily: 'Abril',
          color: 'black',
          fontSize: moderateScale(16.875),
          fontWeight: 'bold',
          opacity: fadeAnim2,
          height: height2,
        }}>
        {title}
      </Animated.Text>
      <Animated.View style={{ opacity }}>{children}</Animated.View>
    </Animated.View>
  );
};

export default AnimationCard;
