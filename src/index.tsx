import React, { useEffect, useState } from 'react';
import AuthStack from './navigation/AuthStack';
import AppStack from './navigation/AppStack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAtom } from 'jotai';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { userAtom } from './store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import tw from '../tailwindcss';

export type RootStackParamList = {
    AuthStack: {
        screen?: string;
    };
    AppStack: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();

// navigation ref used for programmatic navigation (to nested screens on first run)
export const navigationRef = createNavigationContainerRef<any>();

const RootNavigator = () => {
    const [user] = useAtom(userAtom);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [initialRoute, setInitialRoute] = useState<'AppStack' | 'AuthStack'>('AuthStack');

    useEffect(() => {
        const checkAuthToken = async () => {
            try {
                const accessToken = await AsyncStorage.getItem('accessToken');
                if (accessToken) {
                    // Token exists, go to AppStack
                    setInitialRoute('AppStack');
                } else {
                    // No token, go to AuthStack
                    setInitialRoute('AuthStack');
                }
            } catch (error) {
                console.error('Error checking auth token:', error);
                // On error, default to AuthStack
                setInitialRoute('AuthStack');
            } finally {
                setIsCheckingAuth(false);
            }
        };

        checkAuthToken();
    }, []);

    // Show loading indicator while checking auth
    if (isCheckingAuth) {
        return (
            <View style={tw`flex-1 items-center justify-center bg-white`}>
                <ActivityIndicator size="large" color="#A3CB31" />
            </View>
        );
    }

    return (
        <NavigationContainer
            ref={navigationRef}
            onReady={() => {
                // Additional check: if user is not set but we're on AppStack, navigate to AuthStack
                if (!user?.id && initialRoute === 'AppStack' && navigationRef.isReady()) {
                    navigationRef.navigate('AuthStack');
                }
            }}>
            <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{ headerShown: false }}>
                <Stack.Screen name="AppStack" component={AppStack} />
                <Stack.Screen name="AuthStack" component={AuthStack} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default RootNavigator;
