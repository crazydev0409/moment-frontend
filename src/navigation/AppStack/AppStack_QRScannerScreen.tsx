import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAtom } from 'jotai';

import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { colors } from '~/lib/theme';
import { userAtom } from '../../store';
import Toast from '~/components/Toast';

type Props = NativeStackScreenProps<AppStackParamList, 'AppStack_QRScannerScreen'>;

type TabKey = 'scan' | 'my_code';

const SCANNER_SIZE = 220;

const AppStack_QRScannerScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('my_code');
  const [user] = useAtom(userAtom);
  const [toast, setToast] = useState<string | null>(null);

  const qrValue = (user as any)?.id ? `catch://book/${(user as any).id}` : '';
  const deepLink = `https://getcatch.app/book/${(user as any)?.id || ''}`;

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    const match = data.match(/^catch:\/\/book\/(.+)$/);
    if (match && match[1]) {
      navigation.replace('AppStack_CalendarScreen', { bookingUserId: match[1] });
    } else {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid Catch booking code.', [
        { text: 'Scan Again', onPress: () => setScanned(false) },
      ]);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Book time with me on Catch: ${deepLink}`, url: deepLink });
    } catch {}
  };

  const handleCopyLink = async () => {
    const { Clipboard } = require('react-native');
    Clipboard.setString(deepLink);
    setToast('Link copied!');
  };

  const scannerSize = horizontalScale(SCANNER_SIZE);
  const cornerSize = horizontalScale(24);
  const cornerThickness = 3;

  const renderHeader = () => (
    <View
      style={[
        tw`absolute top-0 left-0 right-0`,
        { paddingTop: insets.top + verticalScale(10), paddingHorizontal: '8%' },
      ]}>
      <View style={tw`flex-row items-center justify-between`}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[tw`font-associate`, { color: activeTab === 'scan' ? colors.white : colors.grey, fontSize: moderateScale(15) }]}>
            Close
          </Text>
        </TouchableOpacity>
        <Text style={[tw`font-associate-bold`, { color: activeTab === 'scan' ? colors.white : colors.ink, fontSize: moderateScale(17) }]}>
          Connect with QR
        </Text>
        <View style={{ width: horizontalScale(40) }} />
      </View>
      {activeTab === 'scan' && (
        <Text
          style={[
            tw`text-center font-associate`,
            { color: colors.greyLight, fontSize: moderateScale(13), marginTop: verticalScale(4) },
          ]}>
          Scan someone's code or show your own to connect instantly
        </Text>
      )}
    </View>
  );

  const renderToggle = (isDark = false) => (
    <View
      style={[
        tw`flex-row rounded-full`,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : colors.field,
          padding: 4,
          marginHorizontal: '8%',
        },
      ]}>
      {(['scan', 'my_code'] as TabKey[]).map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
            style={[
              tw`flex-1 rounded-full items-center`,
              {
                paddingVertical: verticalScale(10),
                backgroundColor: active ? (isDark ? colors.white : colors.green) : 'transparent',
              },
            ]}>
            <Text
              style={[
                tw`font-associate-bold`,
                {
                  fontSize: moderateScale(14),
                  color: active
                    ? isDark
                      ? colors.ink
                      : colors.white
                    : isDark
                    ? 'rgba(255,255,255,0.7)'
                    : colors.grey,
                },
              ]}>
              {tab === 'scan' ? 'Scan' : 'My Code'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Scan tab ──────────────────────────────────────────────────────────────
  if (activeTab === 'scan') {
    if (!permission) {
      return <View style={tw`flex-1 bg-black`} />;
    }
    if (!permission.granted) {
      return (
        <View style={[tw`flex-1 bg-black items-center justify-center`, { paddingHorizontal: '8%' }]}>
          <Text style={[tw`text-white font-associate-bold text-center`, { fontSize: moderateScale(20), marginBottom: verticalScale(12) }]}>
            Camera Access Needed
          </Text>
          <Text style={[tw`text-gray-400 font-associate text-center`, { fontSize: moderateScale(14), marginBottom: verticalScale(30) }]}>
            To scan booking QR codes, Catch needs access to your camera.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity
              onPress={requestPermission}
              activeOpacity={0.7}
              style={[tw`rounded-full items-center`, { backgroundColor: colors.green, paddingHorizontal: horizontalScale(30), paddingVertical: verticalScale(14) }]}>
              <Text style={[tw`text-white font-associate-bold`, { fontSize: moderateScale(15) }]}>Grant Permission</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => Linking.openSettings()} activeOpacity={0.7} style={[tw`rounded-full items-center`, { backgroundColor: colors.green, paddingHorizontal: horizontalScale(30), paddingVertical: verticalScale(14) }]}>
              <Text style={[tw`text-white font-associate-bold`, { fontSize: moderateScale(15) }]}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setActiveTab('my_code')} activeOpacity={0.7} style={{ marginTop: verticalScale(20) }}>
            <Text style={[tw`text-gray-400 font-associate`, { fontSize: moderateScale(14) }]}>Show My Code instead</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={tw`flex-1 bg-black`}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />
          <View style={tw`flex-row`}>
            <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />
            <View style={{ width: scannerSize, height: scannerSize }}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                <View
                  key={corner}
                  style={[
                    tw`absolute`,
                    {
                      width: cornerSize,
                      height: cornerSize,
                      borderColor: colors.green,
                      top: corner[0] === 't' ? 0 : undefined,
                      bottom: corner[0] === 'b' ? 0 : undefined,
                      left: corner[1] === 'l' ? 0 : undefined,
                      right: corner[1] === 'r' ? 0 : undefined,
                      borderTopWidth: corner[0] === 't' ? cornerThickness : 0,
                      borderBottomWidth: corner[0] === 'b' ? cornerThickness : 0,
                      borderLeftWidth: corner[1] === 'l' ? cornerThickness : 0,
                      borderRightWidth: corner[1] === 'r' ? cornerThickness : 0,
                      borderTopLeftRadius: corner === 'tl' ? 4 : 0,
                      borderTopRightRadius: corner === 'tr' ? 4 : 0,
                      borderBottomLeftRadius: corner === 'bl' ? 4 : 0,
                      borderBottomRightRadius: corner === 'br' ? 4 : 0,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />
          </View>
          <View style={[tw`bg-black opacity-60`, { flex: 1 }]} />
        </View>

        {renderHeader()}

        {/* Toggle */}
        <View style={[tw`absolute left-0 right-0`, { top: insets.top + verticalScale(80) }]}>
          {renderToggle(true)}
        </View>
      </View>
    );
  }

  // ── My Code tab ───────────────────────────────────────────────────────────
  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.card }]}>
      {/* Inline header with subtitle */}
      <View style={{ paddingTop: insets.top + verticalScale(10), paddingHorizontal: '8%' }}>
        <View style={tw`flex-row items-center justify-between`}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(15) }]}>
              Close
            </Text>
          </TouchableOpacity>
          <Text style={[tw`font-associate-bold`, { color: colors.ink, fontSize: moderateScale(17) }]}>
            Connect with QR
          </Text>
          <View style={{ width: horizontalScale(40) }} />
        </View>
        <Text
          style={[
            tw`font-associate text-center`,
            { color: colors.grey, fontSize: moderateScale(13), marginTop: verticalScale(4) },
          ]}>
          Share your booking link or scan codes to connect
        </Text>
      </View>

      {/* Toggle below header */}
      <View style={{ marginTop: verticalScale(16), marginBottom: verticalScale(8) }}>
        {renderToggle(false)}
      </View>

      {/* QR code */}
      <View style={tw`flex-1 items-center justify-center`}>
        <View
          style={[
            tw`rounded-3xl items-center justify-center`,
            {
              backgroundColor: colors.card,
              padding: moderateScale(24),
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 4,
              marginHorizontal: '8%',
            },
          ]}>
          {qrValue ? (
            <QRCode
              value={qrValue}
              size={horizontalScale(220)}
              backgroundColor={colors.card}
              color={colors.ink}
            />
          ) : (
            <View style={{ width: horizontalScale(220), height: horizontalScale(220), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[tw`font-associate`, { color: colors.grey, fontSize: moderateScale(14) }]}>Sign in to see your code</Text>
            </View>
          )}
        </View>
      </View>

      {/* Share / Copy link CTAs */}
      <View
        style={[
          tw``,
          {
            paddingHorizontal: '8%',
            paddingBottom: insets.bottom + verticalScale(20),
            gap: verticalScale(10),
          },
        ]}>
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.85}
          style={[tw`rounded-full items-center`, { backgroundColor: colors.green, paddingVertical: verticalScale(15) }]}>
          <Text style={[tw`font-associate-bold`, { color: colors.white, fontSize: moderateScale(16) }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCopyLink}
          activeOpacity={0.85}
          style={[
            tw`rounded-full items-center`,
            {
              borderWidth: 1.5,
              borderColor: colors.green,
              paddingVertical: verticalScale(14),
            },
          ]}>
          <Text style={[tw`font-associate-bold`, { color: colors.green, fontSize: moderateScale(16) }]}>Copy Link</Text>
        </TouchableOpacity>
      </View>

      <Toast message={toast || ''} visible={!!toast} onHide={() => setToast(null)} />
    </View>
  );
};

export default AppStack_QRScannerScreen;
