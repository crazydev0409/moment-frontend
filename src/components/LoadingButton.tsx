import React from 'react';
import { TouchableOpacity, ActivityIndicator, Text, View, ViewStyle } from 'react-native';
import tw from '~/tailwindcss';

interface LoadingButtonProps {
  onPress: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: any;
  loadingColor?: string;
  activeOpacity?: number;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  onPress,
  isLoading = false,
  disabled = false,
  children,
  style,
  textStyle,
  loadingColor = '#FFFFFF',
  activeOpacity = 0.7,
}) => {
  const isDisabled = isLoading || disabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={activeOpacity}
      style={[
        style,
        isDisabled && tw`opacity-50`,
      ]}
    >
      {isLoading ? (
        <View style={tw`flex-row items-center justify-center`}>
          <ActivityIndicator size="small" color={loadingColor} />
        </View>
      ) : (
        typeof children === 'string' ? (
          <Text style={textStyle}>{children}</Text>
        ) : (
          children
        )
      )}
    </TouchableOpacity>
  );
};

export default LoadingButton;

