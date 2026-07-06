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
    };
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

