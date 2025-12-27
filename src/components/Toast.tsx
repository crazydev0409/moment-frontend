import React, { useEffect, useState } from 'react';
import { Text, View, Animated } from 'react-native';
import tw from '~/tailwindcss';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

interface ToastProps {
  message: string;
  visible: boolean;
  duration?: number;
  onHide?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, visible, duration = 3000, onHide }) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto hide after duration
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (onHide) onHide();
        });
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, fadeAnim, duration, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        tw`absolute bg-black rounded-2xl`,
        { bottom: verticalScale(90), left: horizontalScale(18.75), right: horizontalScale(18.75), paddingHorizontal: horizontalScale(15), paddingVertical: verticalScale(11.25), opacity: fadeAnim }
      ]}
    >
      <Text style={[tw`text-white text-center font-dm`, { fontSize: moderateScale(13.125) }]}>{message}</Text>
    </Animated.View>
  );
};

export default Toast;

