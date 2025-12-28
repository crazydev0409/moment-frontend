import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { http } from '~/helpers/http';

/**
 * Get a unique device identifier
 */
export const getDeviceId = async (): Promise<string> => {
    // Try to get a persistent device ID
    // On Android, use androidId which persists across app reinstalls
    // On iOS, use identifierForVendor
    if (Device.osName === 'Android') {
        const androidId = await Application.getAndroidId();
        return androidId || Device.modelId || 'unknown-android';
    } else if (Device.osName === 'iOS') {
        const iosId = await Application.getIosIdForVendorAsync();
        return iosId || Device.modelId || 'unknown-ios';
    }

    return Device.modelId || 'unknown-device';
};

/**
 * Get device information for registration
 */
export const getDeviceInfo = async () => {
    const deviceId = await getDeviceId();

    return {
        deviceId,
        platform: Device.osName?.toLowerCase() || 'unknown',
        appVersion: Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0',
        expoVersion: Constants.expoVersion || 'unknown'
    };
};

/**
 * Register device with backend
 */
export const registerDevice = async (
    userId: string,
    expoPushToken: string,
    rememberMe: boolean
): Promise<boolean> => {
    try {
        const deviceInfo = await getDeviceInfo();
        console.log({ rememberMe })
        const response = await http.post('/devices/register', {
            userId,
            expoPushToken,
            rememberMe,
            ...deviceInfo,
        });

        return response.status === 200;
    } catch (error) {
        console.error('Error registering device:', error);
        return false;
    }
};

/**
 * Check if current device is registered with remember me enabled
 */
export const checkDeviceRegistration = async (): Promise<{
    registered: boolean;
    user?: any;
    accessToken?: string;
}> => {
    try {
        const deviceId = await getDeviceId();

        const response = await http.post('/devices/check', {
            deviceId
        });

        if (response.data.registered) {
            return {
                registered: true,
                user: response.data.user,
                accessToken: response.data.accessToken
            };
        }

        return { registered: false };
    } catch (error) {
        console.error('Error checking device registration:', error);
        return { registered: false };
    }
};

/**
 * Update remember me preference for current device
 */
export const updateRememberMe = async (rememberMe: boolean): Promise<boolean> => {
    try {
        const deviceId = await getDeviceId();

        const response = await http.post('/devices/update-remember', {
            deviceId,
            rememberMe
        });

        return response.status === 200;
    } catch (error) {
        console.error('Error updating remember me:', error);
        return false;
    }
};
