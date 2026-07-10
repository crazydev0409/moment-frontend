import { useCallback, useEffect, useState } from 'react';
import * as Contacts from 'expo-contacts';

import { hashPhoneNumber } from '../utils/phoneHash';

// Mirrors moment-backend/src/utils/phoneUtils.ts normalizePhoneNumber exactly.
// Device contacts must be normalized to the same E.164 string the backend
// hashed at registration time (e.g. a bare 10-digit US number becomes
// +1XXXXXXXXXX) — hashing anything less than that produces a SHA-256 digest
// that can never match User.phoneNumber, no matter how "close" the numbers
// look to a human.
function normalizePhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  if (phoneNumber.trim().startsWith('+')) return `+${cleaned}`;
  if (cleaned.length > 10) return `+${cleaned}`;
  return `+${cleaned}`;
}

// A contact's avatar can come from two independent places:
//   1. The photo attached to their entry in *this device's* system contacts.
//   2. The avatar they've set on their own app profile (if they're a
//      registered user), returned by the backend as `.avatar` on User /
//      MomentRequest sender/receiver / Contact.contactUser objects.
// Priority is (1) then (2): a locally-saved photo of someone always wins
// over whatever they've picked for their own profile, since it's presumably
// how the current user actually recognizes them.
//
// The device-contacts side is read once per app session and cached here
// (keyed by nothing — there's only one device) so every screen that needs
// it shares a single `Contacts.getContactsAsync` call instead of each
// re-scanning the whole address book independently.

// Module-level cache shared by every screen. Bottom-tab screens stay
// mounted (not remounted) when you switch tabs, so a screen that mounted
// before Contacts permission was granted elsewhere (e.g. HomePage, before
// the user ever visits the Contacts tab) would otherwise be stuck holding
// an empty map forever — there was no way for it to hear about a later
// successful fetch. `listeners` fixes that: every hook instance subscribes
// on mount, and any successful (re)build broadcasts to all of them.
let cachedMap: Map<string, string> = new Map();
let cachedMapPromise: Promise<Map<string, string>> | null = null;
const listeners = new Set<(map: Map<string, string>) => void>();

function broadcast(map: Map<string, string>) {
  cachedMap = map;
  listeners.forEach((listener) => listener(map));
}

async function loadSharedMap(requestPermission: boolean, forceRebuild = false): Promise<Map<string, string>> {
  if (forceRebuild || requestPermission || !cachedMapPromise) {
    cachedMapPromise = buildDeviceContactAvatarMap(requestPermission).then((map) => {
      broadcast(map);
      return map;
    });
  }
  return cachedMapPromise;
}

async function buildDeviceContactAvatarMap(requestPermission: boolean): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    let { status } = await Contacts.getPermissionsAsync();
    if (status !== 'granted' && requestPermission) {
      ({ status } = await Contacts.requestPermissionsAsync());
    }
    if (status !== 'granted') return map;

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.Image, Contacts.Fields.PhoneNumbers],
    });

    await Promise.all(
      data.map(async (contact) => {
        if (!contact.phoneNumbers?.length || !contact.image?.uri) return;
        // expo-contacts can return a bare filesystem path (no scheme) for a
        // device contact's cached thumbnail on iOS — <Image> silently fails
        // to render that (it needs a proper file:// URI to recognize it as
        // a local file), which looked identical to "no photo at all".
        const avatarUri = /^[a-z][a-z0-9+.-]*:/i.test(contact.image.uri)
          ? contact.image.uri
          : `file://${contact.image.uri}`;
        await Promise.all(
          contact.phoneNumbers.map(async (phone) => {
            if (!phone.number) return;
            const normalized = normalizePhoneNumber(phone.number);
            if (!normalized) return;
            // Local contacts are always hashed to match the backend's
            // hashed User.phoneNumber, which is what every screen looks
            // this map up by.
            const hashed = await hashPhoneNumber(normalized);
            map.set(hashed, avatarUri);
          })
        );
      })
    );
  } catch (error) {
    console.error('Error loading local contact avatars:', error);
  }
  return map;
}

/**
 * Shared, cached device-contact-photo map (hashed phone number -> local
 * image URI). Pass `requestPermission: true` from the one screen
 * responsible for actually prompting for Contacts access (the Contacts
 * tab); every other screen should just read whatever's already available.
 */
export function useDeviceContactAvatarMap(options?: { requestPermission?: boolean }) {
  const requestPermission = options?.requestPermission ?? false;
  // Start from whatever's already been resolved (if some other screen got
  // there first) instead of always starting empty and waiting.
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(cachedMap);

  useEffect(() => {
    listeners.add(setAvatarMap);
    loadSharedMap(requestPermission);
    return () => {
      listeners.delete(setAvatarMap);
    };
  }, [requestPermission]);

  // Explicit refresh (pull-to-refresh, or after importing contacts) always
  // forces a real rebuild — unlike the passive mount-time load above, which
  // reuses an existing cache entry even if it resolved empty.
  const refresh = useCallback(() => loadSharedMap(requestPermission, true), [requestPermission]);

  return { avatarMap, refreshAvatarMap: refresh };
}

/** Call after importing/syncing contacts so a subsequent refresh re-scans the device instead of reusing a stale cached map. */
export function invalidateDeviceContactAvatarCache() {
  cachedMapPromise = null;
}

/**
 * Resolve which avatar to show for a contact: their local device-contact
 * photo first, then their app profile avatar, else null (caller falls back
 * to the placeholder asset).
 */
export function resolveContactAvatarUri(
  avatarMap: Map<string, string> | undefined,
  hashedPhoneNumber: string | null | undefined,
  profileAvatarUrl: string | null | undefined
): string | null {
  const local = hashedPhoneNumber ? avatarMap?.get(hashedPhoneNumber) : undefined;
  return local || profileAvatarUrl || null;
}
