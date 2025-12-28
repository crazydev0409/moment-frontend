import * as Crypto from 'expo-crypto';

/**
 * Hash a phone number using SHA-256 (Frontend version)
 * This provides a deterministic, one-way hash for storing phone numbers securely
 * 
 * @param phoneNumber - The phone number to hash (should be in E.164 format)
 * @returns A Promise that resolves to the SHA-256 hash of the phone number as a hex string
 */
export const hashPhoneNumber = async (phoneNumber: string): Promise<string> => {
    if (!phoneNumber) {
        throw new Error('Phone number is required for hashing');
    }

    // Normalize the phone number
    const normalized = phoneNumber.trim();

    // Create SHA-256 hash using expo-crypto
    const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        normalized
    );

    return hash;
};
