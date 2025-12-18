import React, { useEffect } from 'react';
import AuthStack_SignupScreen from './AuthStack_SignupScreen';
import AuthStack_CountryScreen from './AuthStack_CountryScreen';
import AuthStack_OTPScreen from './AuthStack_OTPScreen';
import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { RootStackParamList } from '../../index';
import AppStack from '../../navigation/AppStack';
import AppStack_HomePageScreen from '../AppStack/AppStack_HomePageScreen';
import AuthStack_CreateAccountScreen from './AuthStack_CreateAccountScreen';
import AuthStack_ProfileScreen from './AuthStack_ProfileScreen';
import AuthStack_MeetingTypesScreen from './AuthStack_MeetingTypesScreen';

export type AuthStackParamList = {
  AuthStack_SignupScreen?: {
    countryCode: string;
  };
  AuthStack_OTPScreen: {
    phoneNumber: string;
    countryCode: string;
    from?: string;
    type?: string;
    value?: string;
  };
  AuthStack_CountryScreen: undefined;
  AuthStack_CreateAccountScreen: undefined;
  AuthStack_ProfileScreen: undefined;
  AuthStack_MeetingTypesScreen: undefined;
  AppStack: undefined;

};

type Props = NativeStackScreenProps<RootStackParamList, 'AuthStack'>;
const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack: React.FC<Props> = ({ navigation, route }) => {
  return (
    <Stack.Navigator initialRouteName="AuthStack_CreateAccountScreen">
      <Stack.Screen
        name="AuthStack_SignupScreen"
        component={AuthStack_SignupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AuthStack_OTPScreen"
        component={AuthStack_OTPScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AuthStack_CountryScreen"
        component={AuthStack_CountryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AuthStack_CreateAccountScreen"
        component={AuthStack_CreateAccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AuthStack_ProfileScreen"
        component={AuthStack_ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AuthStack_MeetingTypesScreen"
        component={AuthStack_MeetingTypesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack"
        component={AppStack}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
