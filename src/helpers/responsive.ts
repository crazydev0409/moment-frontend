import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
// iPhone 11 Pro / X dimensions
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

// Real phones (from an iPhone SE at 320pt wide up to a Pro Max at ~430pt, and
// the equivalent spread on Android) stay within roughly this ratio of the
// guideline baseline. Clamping to it means scaling is still proportional
// across ordinary devices, but a tablet-sized or otherwise unusual
// emulator/simulator canvas can't blow every card up (or shrink it) past a
// sane bound — which is what made cards look "scaled" on some emulators and
// not others.
const MIN_SCALE_RATIO = 0.85;
const MAX_SCALE_RATIO = 1.3;
const clampRatio = (ratio: number) => Math.min(Math.max(ratio, MIN_SCALE_RATIO), MAX_SCALE_RATIO);

const widthRatio = clampRatio(width / guidelineBaseWidth);
const heightRatio = clampRatio(height / guidelineBaseHeight);

/**
 * Scales a size horizontally based on the device screen width.
 * Useful for width, marginHorizontal, paddingHorizontal, etc.
 * @param size The size in standard design pixels (e.g. Figma)
 */
const horizontalScale = (size: number) => widthRatio * size;

/**
 * Scales a size vertically based on the device screen height.
 * Useful for height, marginVertical, paddingVertical, etc.
 * @param size The size in standard design pixels (e.g. Figma)
 */
const verticalScale = (size: number) => heightRatio * size;

/**
 * Scales a size moderately based on the device screen width.
 * Useful for font-size, borderRadius, etc. where you don't want linear scaling.
 * @param size The size in standard design pixels
 * @param factor The resize factor (default 0.5). 0 = no resize, 1 = full resize.
 */
const moderateScale = (size: number, factor = 0.5) => size + (horizontalScale(size) - size) * factor;

export { horizontalScale, verticalScale, moderateScale };
