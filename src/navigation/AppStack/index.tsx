import React from 'react';
import { View } from 'react-native';
import AppStack_HomePageScreen from './AppStack_HomePageScreen';
import AppStack_ProfileScreen from './AppStack_ProfileScreen';
import AppStack_SettingsScreen from './AppStack_SettingsScreen';
import AppStack_CalendarScreen from './AppStack_CalendarScreen';
import AppStack_DateDetailScreen from './AppStack_DateDetailScreen';
import AppStack_ContactScreen from './AppStack_ContactScreen';
import AppStack_ComingSoonScreen from './AppStack_ComingSoonScreen';
import AppStack_SearchScreen from './AppStack_SearchScreen';
import AppStack_NotificationScreen from './AppStack_NotificationScreen';
import {
  NativeStackScreenProps,
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import { RootStackParamList } from '../../index';
import BottomNavigationBar from '~/components/BottomNavigationBar';
import tw from '~/tailwindcss';

export type AppStackParamList = {
  AppStack_HomePageScreen: undefined;
  AppStack_ProfileScreen: undefined;
  AppStack_SettingsScreen: undefined;
  AppStack_CalendarScreen: undefined;
  AppStack_DateDetailScreen: { date?: string; contact?: Contact; momentRequestId?: string };
  AppStack_ContactScreen: undefined;
  AppStack_ComingSoonScreen: undefined;
  AppStack_SearchScreen: undefined;
  AppStack_NotificationScreen: undefined;
};

interface Contact {
  id: string;
  displayName: string;
  contactPhone?: string;
  contactUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

type Props = NativeStackScreenProps<RootStackParamList, 'AppStack'>;
const Stack = createNativeStackNavigator<AppStackParamList>();


const AppStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="AppStack_HomePageScreen"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="AppStack_HomePageScreen">
        {(props: any) => (
          <View style={tw`flex-1`}>
            <AppStack_HomePageScreen {...props} />
            <BottomNavigationBar selectedTab="home" />
          </View>
        )}
      </Stack.Screen>

      <Stack.Screen name="AppStack_CalendarScreen">
        {(props: any) => (
          <View style={tw`flex-1`}>
            <AppStack_CalendarScreen {...props} />
            <BottomNavigationBar selectedTab="calendar" />
          </View>
        )}
      </Stack.Screen>

      <Stack.Screen name="AppStack_ContactScreen">
        {(props: any) => (
          <View style={tw`flex-1`}>
            <AppStack_ContactScreen {...props} />
            <BottomNavigationBar selectedTab="profile" />
          </View>
        )}
      </Stack.Screen>

      <Stack.Screen name="AppStack_ComingSoonScreen">
        {(props: any) => (
          <View style={tw`flex-1`}>
            <AppStack_ComingSoonScreen {...props} />
            <BottomNavigationBar selectedTab="business" />
          </View>
        )}
      </Stack.Screen>

      <Stack.Screen name="AppStack_ProfileScreen" component={AppStack_ProfileScreen} />
      <Stack.Screen name="AppStack_SettingsScreen" component={AppStack_SettingsScreen} />
      <Stack.Screen name="AppStack_DateDetailScreen" component={AppStack_DateDetailScreen} />
      <Stack.Screen name="AppStack_SearchScreen" component={AppStack_SearchScreen} />
      <Stack.Screen name="AppStack_NotificationScreen" component={AppStack_NotificationScreen} />
    </Stack.Navigator>
  );
};

const AppStack: React.FC<any> = ({ navigation, route }) => {
  return (
    <AppStackNavigator />
  );
};

export default AppStack;
