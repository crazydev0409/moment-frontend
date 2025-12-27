import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
// iPhone 11 Pro / X dimensions
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales a size horizontally based on the device screen width.
 * Useful for width, marginHorizontal, paddingHorizontal, etc.
 * @param size The size in standard design pixels (e.g. Figma)
 */
const horizontalScale = (size: number) => (width / guidelineBaseWidth) * size;

/**
 * Scales a size vertically based on the device screen height.
 * Useful for height, marginVertical, paddingVertical, etc.
 * @param size The size in standard design pixels (e.g. Figma)
 */
const verticalScale = (size: number) => (height / guidelineBaseHeight) * size;

/**
 * Scales a size moderately based on the device screen width.
 * Useful for font-size, borderRadius, etc. where you don't want linear scaling.
 * @param size The size in standard design pixels
 * @param factor The resize factor (default 0.5). 0 = no resize, 1 = full resize.
 */
const moderateScale = (size: number, factor = 0.5) => size + (horizontalScale(size) - size) * factor;

export { horizontalScale, verticalScale, moderateScale };
