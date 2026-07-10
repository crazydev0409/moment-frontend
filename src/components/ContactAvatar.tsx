import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

import { Avatar } from '../lib/images';
import { resolveContactAvatarUri } from '../helpers/contactAvatars';

type Props = {
  avatarMap?: Map<string, string>;
  hashedPhoneNumber?: string | null;
  profileAvatarUrl?: string | null;
  style?: StyleProp<ImageStyle>;
};

/**
 * Drop-in replacement for the old `cond ? <Image uri /> : <Image Avatar />`
 * pattern repeated across the app. Resolution order: local device-contact
 * photo, then the person's own app profile avatar, then the placeholder.
 */
export function ContactAvatar({ avatarMap, hashedPhoneNumber, profileAvatarUrl, style }: Props) {
  const uri = resolveContactAvatarUri(avatarMap, hashedPhoneNumber, profileAvatarUrl);
  return uri ? <Image source={{ uri }} style={style} /> : <Image source={Avatar} style={style} />;
}
