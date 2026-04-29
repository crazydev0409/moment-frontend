import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_QRScannerScreen'>;

const SCANNER_SIZE = 250;

const AppStack_QRScannerScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);

    const match = data.match(/^catch:\/\/book\/(.+)$/);
    if (match && match[1]) {
      const bookingUserId = match[1];
      navigation.replace('AppStack_DateDetailScreen', { bookingUserId });
    } else {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid Catch booking code.', [
        { text: 'Scan Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  // Permission not yet determined
  if (!permission) {
    return <View style={tw`flex-1 bg-black`} />;
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={tw`flex-1 bg-black items-center justify-center px-8`}>
        <Text
          style={[
            tw`text-white font-bold font-dm text-center`,
            { fontSize: moderateScale(20), marginBottom: verticalScale(12) },
          ]}>
          Camera Access Needed
        </Text>
        <Text
          style={[
            tw`text-gray-400 font-dm text-center`,
            { fontSize: moderateScale(14), marginBottom: verticalScale(30) },
          ]}>
          To scan booking QR codes, Catch needs access to your camera.
        </Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            onPress={requestPermission}
            activeOpacity={0.7}
            style={[
              tw`bg-[#A3CB31] rounded-full items-center justify-center`,
              {
                paddingHorizontal: horizontalScale(30),
                height: verticalScale(50),
              },
            ]}>
            <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
              Grant Permission
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            activeOpacity={0.7}
            style={[
              tw`bg-[#A3CB31] rounded-full items-center justify-center`,
              {
                paddingHorizontal: horizontalScale(30),
                height: verticalScale(50),
              },
            ]}>
            <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
              Open Settings
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={{ marginTop: verticalScale(20) }}>
          <Text style={[tw`text-gray-400 font-dm`, { fontSize: moderateScale(14) }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scannerSize = horizontalScale(SCANNER_SIZE);
  const cornerSize = horizontalScale(24);
  const cornerThickness = 3;

  return (
    <View style={tw`flex-1 bg-black`}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/* Top dark region */}
        <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />

        {/* Middle row */}
        <View style={tw`flex-row`}>
          {/* Left dark */}
          <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />

          {/* Viewfinder */}
          <View style={{ width: scannerSize, height: scannerSize }}>
            {/* Top-left corner */}
            <View
              style={[
                tw`absolute top-0 left-0`,
                {
                  width: cornerSize,
                  height: cornerSize,
                  borderTopWidth: cornerThickness,
                  borderLeftWidth: cornerThickness,
                  borderColor: '#A3CB31',
                  borderTopLeftRadius: 4,
                },
              ]}
            />
            {/* Top-right corner */}
            <View
              style={[
                tw`absolute top-0 right-0`,
                {
                  width: cornerSize,
                  height: cornerSize,
                  borderTopWidth: cornerThickness,
                  borderRightWidth: cornerThickness,
                  borderColor: '#A3CB31',
                  borderTopRightRadius: 4,
                },
              ]}
            />
            {/* Bottom-left corner */}
            <View
              style={[
                tw`absolute bottom-0 left-0`,
                {
                  width: cornerSize,
                  height: cornerSize,
                  borderBottomWidth: cornerThickness,
                  borderLeftWidth: cornerThickness,
                  borderColor: '#A3CB31',
                  borderBottomLeftRadius: 4,
                },
              ]}
            />
            {/* Bottom-right corner */}
            <View
              style={[
                tw`absolute bottom-0 right-0`,
                {
                  width: cornerSize,
                  height: cornerSize,
                  borderBottomWidth: cornerThickness,
                  borderRightWidth: cornerThickness,
                  borderColor: '#A3CB31',
                  borderBottomRightRadius: 4,
                },
              ]}
            />
          </View>

          {/* Right dark */}
          <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />
        </View>

        {/* Bottom dark region */}
        <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />
      </View>

      {/* Header */}
      <View
        style={[
          tw`absolute top-0 left-0 right-0`,
          { paddingTop: insets.top + verticalScale(15), paddingHorizontal: horizontalScale(20) },
        ]}>
        <View style={tw`flex-row items-center justify-between`}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={[tw`text-white font-dm`, { fontSize: moderateScale(15) }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(18) }]}>
            Scan Booking QR
          </Text>
          <View style={{ width: horizontalScale(40) }} />
        </View>
      </View>

      {/* Instruction text */}
      <View
        style={[
          tw`absolute left-0 right-0 items-center`,
          { bottom: insets.bottom + verticalScale(80) },
        ]}>
        <Text
          style={[
            tw`text-white text-center font-dm`,
            { fontSize: moderateScale(14), paddingHorizontal: horizontalScale(40) },
          ]}>
          Point your camera at a Catch booking QR code
        </Text>
      </View>
    </View>
  );
};

export default AppStack_QRScannerScreen;
