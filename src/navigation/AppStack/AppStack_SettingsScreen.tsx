import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Switch,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Background } from '~/lib/images';
import { http } from '~/helpers/http';
import { disconnectSocket } from '~/services/socketService';
import { useAtom } from 'jotai';
import { userAtom } from '../../store';
import { navigationRef } from '~/index';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<
    AppStackParamList,
    'AppStack_SettingsScreen'
>;

const AppStack_SettingsScreen: React.FC<Props> = ({ navigation, route }) => {
    const [lightTheme, setLightTheme] = useState(true);
    const [darkTheme, setDarkTheme] = useState(false);
    const [autoTheme, setAutoTheme] = useState(false);
    const [systemNotifications, setSystemNotifications] = useState(false);
    const [mailNotifications, setMailNotifications] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [, setUser] = useAtom(userAtom);

    const navigateToProfile = () => {
        navigation.navigate('AppStack_ProfileScreen');
    };

    const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
        if (theme === 'light') {
            setLightTheme(true);
            setDarkTheme(false);
            setAutoTheme(false);
        } else if (theme === 'dark') {
            setLightTheme(false);
            setDarkTheme(true);
            setAutoTheme(false);
        } else {
            setLightTheme(false);
            setDarkTheme(false);
            setAutoTheme(true);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoggingOut(true);
                        try {
                            // Clear tokens from storage
                            await AsyncStorage.removeItem('accessToken');
                            await AsyncStorage.removeItem('refreshToken');

                            // Clear authorization header
                            delete http.defaults.headers.common['Authorization'];

                            // Disconnect socket
                            disconnectSocket();

                            // Clear user atom
                            setUser({
                                id: '',
                                name: '',
                                email: '',
                                phoneNumber: '',
                                birthday: '',
                                bio: '',
                                meetingTypes: [],
                                verified: false
                            });

                            // Navigate to AuthStack - use reset to clear navigation stack
                            if (navigationRef.isReady()) {
                                navigationRef.reset({
                                    index: 0,
                                    routes: [{ name: 'AuthStack' }],
                                });
                            } else {
                                // If not ready, wait a bit and try again
                                setTimeout(() => {
                                    if (navigationRef.isReady()) {
                                        navigationRef.reset({
                                            index: 0,
                                            routes: [{ name: 'AuthStack' }],
                                        });
                                    }
                                }, 100);
                            }
                        } catch (error) {
                            console.error('Error during logout:', error);
                            // Even if there's an error, try to navigate to auth
                            setUser({
                                id: '',
                                name: '',
                                email: '',
                                phoneNumber: '',
                                birthday: '',
                                bio: '',
                                meetingTypes: [],
                                verified: false
                            });
                            if (navigationRef.isReady()) {
                                navigationRef.reset({
                                    index: 0,
                                    routes: [{ name: 'AuthStack' }],
                                });
                            }
                        } finally {
                            setIsLoggingOut(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Second confirmation
                        Alert.alert(
                            'Final Confirmation',
                            'This will permanently delete your account and all associated data. Are you absolutely sure?',
                            [
                                {
                                    text: 'Cancel',
                                    style: 'cancel',
                                },
                                {
                                    text: 'Delete Account',
                                    style: 'destructive',
                                    onPress: async () => {
                                        setIsDeletingAccount(true);
                                        try {
                                            // Call delete account API
                                            await http.delete('/users/account');

                                            // Clear tokens from storage
                                            await AsyncStorage.removeItem('accessToken');
                                            await AsyncStorage.removeItem('refreshToken');

                                            // Clear authorization header
                                            delete http.defaults.headers.common['Authorization'];

                                            // Disconnect socket
                                            disconnectSocket();

                                            // Clear user atom
                                            setUser({
                                                id: '',
                                                name: '',
                                                email: '',
                                                phoneNumber: '',
                                                birthday: '',
                                                bio: '',
                                                meetingTypes: [],
                                                verified: false
                                            });

                                            // Navigate to AuthStack - use reset to clear navigation stack
                                            if (navigationRef.isReady()) {
                                                navigationRef.reset({
                                                    index: 0,
                                                    routes: [{ name: 'AuthStack' }],
                                                });
                                            } else {
                                                // If not ready, wait a bit and try again
                                                setTimeout(() => {
                                                    if (navigationRef.isReady()) {
                                                        navigationRef.reset({
                                                            index: 0,
                                                            routes: [{ name: 'AuthStack' }],
                                                        });
                                                    }
                                                }, 100);
                                            }
                                        } catch (error: any) {
                                            console.error('Error deleting account:', error);
                                            Alert.alert(
                                                'Error',
                                                error.response?.data?.error || 'Failed to delete account. Please try again.',
                                                [{ text: 'OK' }]
                                            );
                                        } finally {
                                            setIsDeletingAccount(false);
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    return (
        <View style={tw`flex-1 relative bg-white`}>
            <Image source={Background} style={tw`absolute w-full h-full`} />
            <View style={tw`absolute w-full h-full bg-black opacity-5`} />

            <ScrollView
                style={tw`flex-1`}
                contentContainerStyle={tw`pb-10`}
                showsVerticalScrollIndicator={false}
            >
                <View style={[{ marginTop: verticalScale(60), marginBottom: verticalScale(37.5) }, { paddingHorizontal: '8%' }]}>
                    {/* Header */}
                    <View style={[tw`flex-row items-center relative`, { marginBottom: verticalScale(30) }]}>
                        <TouchableOpacity onPress={navigateToProfile} activeOpacity={0.5} style={tw`absolute left-0 z-10`}>
                            <Image source={BackArrow} style={{ width: horizontalScale(30), height: horizontalScale(30) }} resizeMode="contain" />
                        </TouchableOpacity>
                        <Text style={[tw`font-bold font-dm text-black flex-1 text-center`, { fontSize: moderateScale(22.5) }]}>Settings</Text>
                    </View>

                    {/* Application Theme Section */}
                    <View style={{ marginBottom: verticalScale(22.5) }}>
                        <Text style={[tw`font-bold font-dm text-black`, { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) }]}>
                            Application theme
                        </Text>
                        <View style={tw`bg-white rounded-2xl overflow-hidden`}>
                            {/* Light */}
                            <TouchableOpacity
                                style={[tw`flex-row items-center justify-between border-b border-gray-100`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}
                                activeOpacity={0.7}
                                onPress={() => handleThemeChange('light')}
                            >
                                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>Light</Text>
                                <Switch
                                    value={lightTheme}
                                    onValueChange={() => handleThemeChange('light')}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={lightTheme ? '#000000' : '#9CA3AF'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </TouchableOpacity>

                            {/* Dark */}
                            <TouchableOpacity
                                style={[tw`flex-row items-center justify-between border-b border-gray-100`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}
                                activeOpacity={0.7}
                                onPress={() => handleThemeChange('dark')}
                            >
                                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>Dark</Text>
                                <Switch
                                    value={darkTheme}
                                    onValueChange={() => handleThemeChange('dark')}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={darkTheme ? '#000000' : '#9CA3AF'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </TouchableOpacity>

                            {/* Automatically */}
                            <TouchableOpacity
                                style={[tw`flex-row items-center justify-between`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}
                                activeOpacity={0.7}
                                onPress={() => handleThemeChange('auto')}
                            >
                                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>Automatically</Text>
                                <Switch
                                    value={autoTheme}
                                    onValueChange={() => handleThemeChange('auto')}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={autoTheme ? '#000000' : '#9CA3AF'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Notifications Section */}
                    <View style={{ marginBottom: verticalScale(22.5) }}>
                        <Text style={[tw`font-bold font-dm text-black`, { fontSize: moderateScale(16.875), marginBottom: verticalScale(11.25) }]}>
                            Notifications
                        </Text>
                        <View style={tw`bg-white rounded-2xl overflow-hidden`}>
                            {/* Notifications in the system */}
                            <TouchableOpacity
                                style={[tw`flex-row items-center justify-between border-b border-gray-100`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}
                                activeOpacity={0.7}
                                onPress={() => setSystemNotifications(!systemNotifications)}
                            >
                                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                    Notifications in the system
                                </Text>
                                <Switch
                                    value={systemNotifications}
                                    onValueChange={setSystemNotifications}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={systemNotifications ? '#000000' : '#9CA3AF'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </TouchableOpacity>

                            {/* Notifications by mail */}
                            <TouchableOpacity
                                style={[tw`flex-row items-center justify-between`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}
                                activeOpacity={0.7}
                                onPress={() => setMailNotifications(!mailNotifications)}
                            >
                                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                    Notifications by mail
                                </Text>
                                <Switch
                                    value={mailNotifications}
                                    onValueChange={setMailNotifications}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={mailNotifications ? '#000000' : '#9CA3AF'}
                                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Application Version */}
                    <View style={[tw`items-center`, { marginTop: verticalScale(15) }]}>
                        <Text style={[tw`font-dm text-grey`, { fontSize: moderateScale(13.125) }]}>
                            Application version 1.86
                        </Text>
                    </View>

                    {/* Logout Section */}
                    <View style={{ marginTop: verticalScale(30) }}>
                        <TouchableOpacity
                            style={tw`bg-white rounded-2xl overflow-hidden`}
                            activeOpacity={0.7}
                            onPress={handleLogout}
                            disabled={isLoggingOut || isDeletingAccount}
                        >
                            <View style={[tw`flex-row items-center justify-between`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}>
                                <Text style={[tw`font-dm text-black`, { fontSize: moderateScale(15) }]}>
                                    Logout
                                </Text>
                                {isLoggingOut ? (
                                    <ActivityIndicator size="small" color="#000000" />
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Delete Account Section */}
                    <View style={{ marginTop: verticalScale(15), marginBottom: verticalScale(30) }}>
                        <TouchableOpacity
                            style={tw`bg-white rounded-2xl overflow-hidden border border-red-500`}
                            activeOpacity={0.7}
                            onPress={handleDeleteAccount}
                            disabled={isLoggingOut || isDeletingAccount}
                        >
                            <View style={[tw`flex-row items-center justify-between`, { paddingHorizontal: horizontalScale(18.75), paddingVertical: verticalScale(15) }]}>
                                <Text style={[tw`font-dm text-red-500`, { fontSize: moderateScale(15) }]}>
                                    Delete Account
                                </Text>
                                {isDeletingAccount ? (
                                    <ActivityIndicator size="small" color="#EF4444" />
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

export default AppStack_SettingsScreen;

