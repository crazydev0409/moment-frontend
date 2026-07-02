import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View } from 'react-native';

import AppStack_AvailabilityScreen from './AppStack_AvailabilityScreen';
import AppStack_AvailableTimesScreen from './AppStack_AvailableTimesScreen';
import AppStack_CalendarScreen from './AppStack_CalendarScreen';
import AppStack_CalendarSettingsScreen from './AppStack_CalendarSettingsScreen';
import AppStack_ComingSoonScreen from './AppStack_ComingSoonScreen';
import AppStack_MeshScreen from './AppStack_MeshScreen';
import AppStack_ContactScreen from './AppStack_ContactScreen';
import AppStack_ContactProfileScreen from './AppStack_ContactProfileScreen';

import AppStack_HomePageScreen from './AppStack_HomePageScreen';
import AppStack_HookEditorScreen from './AppStack_HookEditorScreen';
import AppStack_MeetingHistoryScreen from './AppStack_MeetingHistoryScreen';
import AppStack_MyHooksScreen from './AppStack_MyHooksScreen';
import AppStack_NotificationDetailScreen from './AppStack_NotificationDetailScreen';
import AppStack_NotificationScreen from './AppStack_NotificationScreen';
import AppStack_ProfileScreen from './AppStack_ProfileScreen';
import AppStack_ProfileSettingsScreen from './AppStack_ProfileSettingsScreen';
import AppStack_QRScannerScreen from './AppStack_QRScannerScreen';
import AppStack_SearchScreen from './AppStack_SearchScreen';
import AppStack_SendCatchScreen from './AppStack_SendCatchScreen';
import AppStack_SettingsScreen from './AppStack_SettingsScreen';
import AppStack_ApplicationThemeScreen from './AppStack_ApplicationThemeScreen';
import AppStack_NotificationSettingsScreen from './AppStack_NotificationSettingsScreen';
import AppStack_AccountSecurityScreen from './AppStack_AccountSecurityScreen';
import AppStack_ChangeEmailScreen from './AppStack_ChangeEmailScreen';
import AppStack_ChangePhoneScreen from './AppStack_ChangePhoneScreen';
import AppStack_PaymentsScreen from './AppStack_PaymentsScreen';
import AppStack_AIAssistantScreen from './AppStack_AIAssistantScreen';
import AppStack_PayoutDetailsScreen from './AppStack_PayoutDetailsScreen';

import BottomNavigationBar from '~/components/BottomNavigationBar';
import tw from '~/tailwindcss';

export type AppStackParamList = {
  AppStack_HomePageScreen: {
    toast?: {
      title: string;
      subtitle: string;
      calendarDate?: string; // YYYY-MM-DD — when tapped navigates to this date in CalendarScreen
    };
  } | undefined;
  AppStack_ProfileScreen: undefined;
  AppStack_ProfileSettingsScreen: undefined;
  AppStack_SettingsScreen: undefined;
  AppStack_AvailabilityScreen: undefined;
  AppStack_CalendarSettingsScreen: undefined;
  AppStack_CalendarScreen: {
    date?: string;
    contact?: Contact;
    momentRequestId?: string;
    bookingUserId?: string;
  } | undefined;
  AppStack_ContactScreen: undefined;
  AppStack_ContactProfileScreen: {
    contactId: string;
    contactUserId?: string;
    contactName?: string;
  };
  AppStack_AvailableTimesScreen: {
    contactId: string;
    contactUserId: string;
    contactName: string;
  };
  AppStack_MeetingHistoryScreen: {
    contactUserId: string;
    contactName: string;
  };
  AppStack_ComingSoonScreen: undefined;
  AppStack_MeshScreen: undefined;
  AppStack_SearchScreen: undefined;
  AppStack_NotificationScreen: undefined;
  AppStack_NotificationDetailScreen: {
    notificationId: string;
  };
  AppStack_QRScannerScreen: undefined;
  AppStack_SendCatchScreen: {
    mode: 'one' | 'group';
    initialDate?: string;
    initialTime?: string;
    initialContact?: Contact;
  };
  AppStack_MyHooksScreen: {
    toast?: string;
  } | undefined;
  AppStack_HookEditorScreen: {
    hookId?: string;
    source?: string;
  } | undefined;
  AppStack_ApplicationThemeScreen: undefined;
  AppStack_NotificationSettingsScreen: undefined;
  AppStack_AccountSecurityScreen: undefined;
  AppStack_ChangeEmailScreen: {
    currentEmail?: string;
  } | undefined;
  AppStack_ChangePhoneScreen: undefined;
  AppStack_PaymentsScreen: undefined;
  AppStack_AIAssistantScreen: undefined;
  AppStack_PayoutDetailsScreen: undefined;
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
  avatar?: string;
}

const Stack = createNativeStackNavigator<AppStackParamList>();

const AppStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="AppStack_HomePageScreen"
      screenOptions={{ headerShown: false }}>
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

      <Stack.Screen name="AppStack_MeshScreen">
        {(props: any) => (
          <View style={tw`flex-1`}>
            <AppStack_MeshScreen {...props} />
            <BottomNavigationBar selectedTab="business" />
          </View>
        )}
      </Stack.Screen>

      <Stack.Screen name="AppStack_ProfileScreen" component={AppStack_ProfileScreen} />
      <Stack.Screen name="AppStack_ProfileSettingsScreen" component={AppStack_ProfileSettingsScreen} />
      <Stack.Screen name="AppStack_SettingsScreen" component={AppStack_SettingsScreen} />
      <Stack.Screen name="AppStack_AvailabilityScreen" component={AppStack_AvailabilityScreen} />
      <Stack.Screen name="AppStack_CalendarSettingsScreen" component={AppStack_CalendarSettingsScreen} />
      <Stack.Screen name="AppStack_SearchScreen" component={AppStack_SearchScreen} />
      <Stack.Screen name="AppStack_NotificationScreen" component={AppStack_NotificationScreen} />
      <Stack.Screen name="AppStack_NotificationDetailScreen" component={AppStack_NotificationDetailScreen} />
      <Stack.Screen name="AppStack_QRScannerScreen" component={AppStack_QRScannerScreen} />
      <Stack.Screen name="AppStack_SendCatchScreen" component={AppStack_SendCatchScreen} />
      <Stack.Screen name="AppStack_MyHooksScreen" component={AppStack_MyHooksScreen} />
      <Stack.Screen name="AppStack_HookEditorScreen" component={AppStack_HookEditorScreen} />
      <Stack.Screen name="AppStack_ContactProfileScreen" component={AppStack_ContactProfileScreen} />
      <Stack.Screen name="AppStack_AvailableTimesScreen" component={AppStack_AvailableTimesScreen} />
      <Stack.Screen name="AppStack_MeetingHistoryScreen" component={AppStack_MeetingHistoryScreen} />
      <Stack.Screen name="AppStack_ApplicationThemeScreen" component={AppStack_ApplicationThemeScreen} />
      <Stack.Screen name="AppStack_NotificationSettingsScreen" component={AppStack_NotificationSettingsScreen} />
      <Stack.Screen name="AppStack_AccountSecurityScreen" component={AppStack_AccountSecurityScreen} />
      <Stack.Screen name="AppStack_ChangeEmailScreen" component={AppStack_ChangeEmailScreen} />
      <Stack.Screen name="AppStack_ChangePhoneScreen" component={AppStack_ChangePhoneScreen} />
      <Stack.Screen name="AppStack_PaymentsScreen" component={AppStack_PaymentsScreen} />
      <Stack.Screen name="AppStack_AIAssistantScreen" component={AppStack_AIAssistantScreen} />
      <Stack.Screen name="AppStack_PayoutDetailsScreen" component={AppStack_PayoutDetailsScreen} />
    </Stack.Navigator>
  );
};

const AppStack: React.FC<any> = ({ navigation, route }) => {
  return <AppStackNavigator />;
};

export default AppStack;
