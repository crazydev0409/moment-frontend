// App.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import CustomSplashScreen from '~/components/SplashScreen';
import RootNavigator from './src';
import { useAtom } from 'jotai';
import { userAtom } from '~/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { http } from '~/helpers/http';
import { jwtDecode } from 'jwt-decode';
import { useDeviceContext } from 'twrnc';
import tw from '~/tailwindcss';
import {
  requestNotificationPermissions,
  registerForPushNotificationsAsync,
  setupNotificationResponseHandler,
  setupNotificationReceivedHandler,
} from '~/services/notificationService';
import { initializeSocket, disconnectSocket } from '~/services/socketService';
import { checkDeviceRegistration } from '~/services/deviceService';

SplashScreen.preventAutoHideAsync(); // don't let Expo hide it automatically

export default function App() {
  useDeviceContext(tw);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [__, setUser] = useAtom(userAtom);
  console.log({ __ });
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First, check if device is registered with remember me
        const deviceCheck = await checkDeviceRegistration();

        if (deviceCheck.registered && deviceCheck.accessToken && deviceCheck.user) {
          // Device is registered with remember me - auto login
          console.log('✅ Device registered with remember me - auto logging in');

          // Save access token
          await AsyncStorage.setItem('accessToken', deviceCheck.accessToken);
          http.defaults.headers.common['Authorization'] = `Bearer ${deviceCheck.accessToken}`;

          // Set user data
          setUser(deviceCheck.user);

          // Import and sync contacts after authentication
          await importAndSyncContacts();

          // Register for push notifications after authentication
          await setupNotifications();

          // Initialize Socket.IO for real-time updates
          await initializeSocket();

          // Show pending moment requests as notifications
          await showPendingRequests();
        } else {
          // No device registration, check for existing access token
          const accessToken = await AsyncStorage.getItem('accessToken');
          if (accessToken) {
            // request navigation to profile once the container is ready
            http.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            const response = await http.get('/users/profile');
            // Set to your global atom
            setUser(response.data);

            // Import and sync contacts after authentication
            await importAndSyncContacts();

            // Register for push notifications after authentication
            await setupNotifications();

            // Initialize Socket.IO for real-time updates
            await initializeSocket();

            // Show pending moment requests as notifications
            await showPendingRequests();
          } else {
            // Disconnect Socket.IO if user is not authenticated
            disconnectSocket();
          }
        }
      } catch (error) {
        console.error('Error during auth check:', error);
        // On error, disconnect socket and continue to login screen
        disconnectSocket();
      } finally {
        setAppIsReady(true);
      }
    };

    const importAndSyncContacts = async () => {
      try {
        // Check if contacts permission is granted
        const { status } = await Contacts.getPermissionsAsync();

        if (status === 'granted') {
          // Get contacts from device
          const { data } = await Contacts.getContactsAsync({
            fields: [
              Contacts.Fields.Name,
              Contacts.Fields.PhoneNumbers
            ],
          });

          // Prepare contacts for import
          const contactsToImport = data
            .filter(contact => {
              return contact.name &&
                contact.phoneNumbers &&
                contact.phoneNumbers.length > 0;
            })
            .map(contact => {
              const phoneNumber = contact.phoneNumbers![0].number;

              return {
                phoneNumber: phoneNumber || '',
                displayName: contact.name || 'Unknown',
                phoneBookId: contact.id
              };
            })
            .filter(contact => contact.phoneNumber);
          console.log({ contactsToImport })
          if (contactsToImport.length > 0) {
            // Import contacts to backend
            await http.post('/users/contacts/import', {
              contacts: contactsToImport
            });
            console.log('Contacts imported successfully');

            // Sync contacts with registered users
            await http.post('/users/contacts/sync');
            console.log('Contacts synced successfully');

            // Ensure default calendar exists for current user
            try {
              await http.get('/moments/default-calendar');
            } catch (error: any) {
              // If calendar doesn't exist, we can't create it from frontend
              // This is a backend issue - calendar should be created on user registration
              console.warn('Default calendar not found. Calendar visibility cannot be granted.');
              console.warn('Note: Default calendar should be created when user registers.');
            }

            // Grant calendar visibility to all registered contacts (bidirectional)
            try {
              const contactsResponse = await http.get('/users/contacts');
              const registeredContacts = contactsResponse.data.contacts.filter(
                (contact: any) => contact.contactUserId
              );

              // Grant calendar visibility for each registered contact
              for (const contact of registeredContacts) {
                try {
                  // First, ensure the contact has a default calendar by checking it
                  // If they don't have one, we skip granting visibility
                  try {
                    // Try to get their calendar (this will fail if they don't have one)
                    // We can't check this directly, so we'll just try to grant visibility
                    // and handle the error gracefully
                    await http.post('/users/visibility', {
                      userId: contact.contactUserId
                    });
                    console.log(`Calendar visibility granted to ${contact.displayName}`);
                  } catch (visibilityError: any) {
                    // If error is about calendar not found, log it but continue
                    if (visibilityError.response?.data?.error?.includes('calendar not found') ||
                      visibilityError.response?.data?.error?.includes('Default calendar not found')) {
                      console.warn(`Cannot grant visibility to ${contact.displayName}: They don't have a default calendar yet`);
                    } else if (!visibilityError.response?.data?.error?.includes('already')) {
                      console.error(`Failed to grant visibility to ${contact.displayName}:`, visibilityError.response?.data?.error || visibilityError.message);
                    }
                  }
                } catch (error: any) {
                  console.error(`Error processing contact ${contact.displayName}:`, error);
                }
              }
              console.log('Calendar visibility setup completed');
            } catch (error) {
              console.error('Error granting calendar visibility:', error);
              // Don't block app initialization if this fails
            }
          }
        }
      } catch (error) {
        console.error('Error importing/syncing contacts:', error);
        // Don't block app initialization if contact sync fails
      }
    };

    const requestContactsPermission = async () => {
      try {
        await Contacts.requestPermissionsAsync();
      } catch (error) {
        console.error('Error requesting contacts permission:', error);
      }
    };

    // Request location permissions on app initialization
    const requestLocationPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          console.log('✅ Location permission granted');
        } else {
          console.log('ℹ️ Location permission denied - will use default location');
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
      }
    };

    // Request notification permissions on app initialization
    const requestNotificationPerms = async () => {
      try {
        await requestNotificationPermissions();
      } catch (error) {
        console.error('Error requesting notification permissions:', error);
      }
    };

    // Register device for push notifications (only after authentication)
    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          console.log('✅ Push notifications registered successfully');
        } else {
          console.log('ℹ️ Push notifications not available (projectId required)');
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
        // Don't block app initialization if notifications fail
      }
    };

    // Show pending moment requests as notifications on app start
    const showPendingRequests = async () => {
      try {
        // Import the function dynamically to avoid circular dependencies
        const { showPendingMomentRequestNotifications } = await import('./src/services/notificationService');
        await showPendingMomentRequestNotifications();
      } catch (error) {
        console.error('Error showing pending moment requests:', error);
        // Don't block app initialization if this fails
      }
    };

    // Setup notification handlers
    setupNotificationResponseHandler(
      (requestId) => {
        Alert.alert('Success', 'Meeting request accepted!');
      },
      (requestId) => {
        Alert.alert('Request Rejected', 'Meeting request has been rejected.');
      }
    );

    setupNotificationReceivedHandler((notification) => {
      console.log('Notification received:', notification);
    });

    // Request permissions on app initialization
    requestNotificationPerms();
    requestContactsPermission();
    requestLocationPermission();

    // Check auth and setup notifications if already logged in
    checkAuth();

    // Cleanup: Disconnect Socket.IO when component unmounts
    return () => {
      disconnectSocket();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // 👇 hide the native (white) Expo splash
      await SplashScreen.hideAsync();

      // optional: keep your custom splash for a bit
      setTimeout(() => setShowCustomSplash(false), 1000);
    }
  }, [appIsReady]);

  if (!appIsReady) {
    // native splash is still showing here
    return null;
  }

  // Here JS is ready, we control what to show
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        {showCustomSplash ? (
          <CustomSplashScreen />
        ) : (
          <RootNavigator />
        )}
      </View>
    </SafeAreaProvider>
  );
}
