import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Switch,
    ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '../../../tailwindcss';
import { AppStackParamList } from '.';
import { BackArrow, Background } from '~/lib/images';

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

    return (
        <View style={tw`flex-1 relative bg-white`}>
            <Image source={Background} style={tw`absolute w-full h-full`} />
            <View style={tw`absolute w-full h-full bg-black opacity-5`} />

            <ScrollView
                style={tw`flex-1`}
                contentContainerStyle={tw`pb-10`}
                showsVerticalScrollIndicator={false}
            >
                <View style={[tw`mt-16 mb-10`, { paddingHorizontal: '8%' }]}>
          {/* Header */}
          <View style={tw`flex-row items-center mb-8 relative`}>
            <TouchableOpacity onPress={navigateToProfile} activeOpacity={0.5} style={tw`absolute left-0 z-10`}>
              <Image source={BackArrow} />
            </TouchableOpacity>
            <Text style={tw`text-2xl font-bold font-dm text-black flex-1 text-center`}>Settings</Text>
          </View>

                    {/* Application Theme Section */}
                    <View style={tw`mb-6`}>
                        <Text style={tw`text-lg font-bold font-dm text-black mb-3`}>
                            Application theme
                        </Text>
                        <View style={tw`bg-white rounded-2xl overflow-hidden`}>
                            {/* Light */}
                            <TouchableOpacity
                                style={tw`flex-row items-center justify-between px-5 py-4 border-b border-gray-100`}
                                activeOpacity={0.7}
                                onPress={() => handleThemeChange('light')}
                            >
                                <Text style={tw`text-base font-dm text-black`}>Light</Text>
                                <Switch
                                    value={lightTheme}
                                    onValueChange={() => handleThemeChange('light')}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={lightTheme ? '#000000' : '#9CA3AF'}
                                />
                            </TouchableOpacity>

                            {/* Dark */}
                            <TouchableOpacity
                                style={tw`flex-row items-center justify-between px-5 py-4 border-b border-gray-100`}
                                activeOpacity={0.7}
                                onPress={() => handleThemeChange('dark')}
                            >
                                <Text style={tw`text-base font-dm text-black`}>Dark</Text>
                                <Switch
                                    value={darkTheme}
                                    onValueChange={() => handleThemeChange('dark')}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={darkTheme ? '#000000' : '#9CA3AF'}
                                />
                            </TouchableOpacity>

                            {/* Automatically */}
                            <TouchableOpacity
                                style={tw`flex-row items-center justify-between px-5 py-4`}
                                activeOpacity={0.7}
                                onPress={() => handleThemeChange('auto')}
                            >
                                <Text style={tw`text-base font-dm text-black`}>Automatically</Text>
                                <Switch
                                    value={autoTheme}
                                    onValueChange={() => handleThemeChange('auto')}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={autoTheme ? '#000000' : '#9CA3AF'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Notifications Section */}
                    <View style={tw`mb-6`}>
                        <Text style={tw`text-lg font-bold font-dm text-black mb-3`}>
                            Notifications
                        </Text>
                        <View style={tw`bg-white rounded-2xl overflow-hidden`}>
                            {/* Notifications in the system */}
                            <TouchableOpacity
                                style={tw`flex-row items-center justify-between px-5 py-4 border-b border-gray-100`}
                                activeOpacity={0.7}
                                onPress={() => setSystemNotifications(!systemNotifications)}
                            >
                                <Text style={tw`text-base font-dm text-black`}>
                                    Notifications in the system
                                </Text>
                                <Switch
                                    value={systemNotifications}
                                    onValueChange={setSystemNotifications}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={systemNotifications ? '#000000' : '#9CA3AF'}
                                />
                            </TouchableOpacity>

                            {/* Notifications by mail */}
                            <TouchableOpacity
                                style={tw`flex-row items-center justify-between px-5 py-4`}
                                activeOpacity={0.7}
                                onPress={() => setMailNotifications(!mailNotifications)}
                            >
                                <Text style={tw`text-base font-dm text-black`}>
                                    Notifications by mail
                                </Text>
                                <Switch
                                    value={mailNotifications}
                                    onValueChange={setMailNotifications}
                                    trackColor={{ false: '#E5E7EB', true: '#E5E7EB' }}
                                    thumbColor={mailNotifications ? '#000000' : '#9CA3AF'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Application Version */}
                    <View style={tw`items-center mt-4`}>
                        <Text style={tw`text-sm font-dm text-grey`}>
                            Application version 1.86
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

export default AppStack_SettingsScreen;

