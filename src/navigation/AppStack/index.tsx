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
import { AddButtonProvider, useAddButton } from '~/contexts/AddButtonContext';
import tw from 'tailwindcss';

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

// Screens that should NOT show the bottom navigation bar
const SCREENS_WITHOUT_NAV_BAR = [
  'AppStack_DateDetailScreen',
  'AppStack_SearchScreen',
  'AppStack_NotificationScreen',
  'AppStack_SettingsScreen',
  'AppStack_ComingSoonScreen',
  'AppStack_ProfileScreen',
];

// Wrapper component that adds bottom navigation to screens
const ScreenWithNav = ({ component: Component, showNav, selectedTab }: any) => {
  return (props: any) => {
    const { onAddPress } = useAddButton();
    return (
      <View style={tw`flex-1`}>
        <Component {...props} />
        {showNav && (
          <BottomNavigationBar
            selectedTab={selectedTab}
            onAddPress={onAddPress}
          />
        )}
      </View>
    );
  };
};

const AppStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator initialRouteName="AppStack_HomePageScreen">
      <Stack.Screen
        name="AppStack_HomePageScreen"
        component={ScreenWithNav({ 
          component: AppStack_HomePageScreen, 
          showNav: true, 
          selectedTab: 'home' 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_ProfileScreen"
        component={ScreenWithNav({ 
          component: AppStack_ProfileScreen, 
          showNav: false 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_SettingsScreen"
        component={ScreenWithNav({ 
          component: AppStack_SettingsScreen, 
          showNav: false 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_CalendarScreen"
        component={ScreenWithNav({ 
          component: AppStack_CalendarScreen, 
          showNav: true, 
          selectedTab: 'calendar' 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_DateDetailScreen"
        component={ScreenWithNav({ 
          component: AppStack_DateDetailScreen, 
          showNav: false 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_ContactScreen"
        component={ScreenWithNav({ 
          component: AppStack_ContactScreen, 
          showNav: true, 
          selectedTab: 'profile' 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_ComingSoonScreen"
        component={ScreenWithNav({ 
          component: AppStack_ComingSoonScreen, 
          showNav: true,
          selectedTab: 'business'
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_SearchScreen"
        component={ScreenWithNav({ 
          component: AppStack_SearchScreen, 
          showNav: false 
        })}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AppStack_NotificationScreen"
        component={ScreenWithNav({ 
          component: AppStack_NotificationScreen, 
          showNav: false 
        })}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const AppStack: React.FC<Props> = ({ navigation, route }) => {
  return (
    <AddButtonProvider>
      <AppStackNavigator />
    </AddButtonProvider>
  );
};

export default AppStack;
