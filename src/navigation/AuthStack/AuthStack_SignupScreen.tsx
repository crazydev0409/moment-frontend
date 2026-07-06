import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AsYouType, getExampleNumber, isValidPhoneNumber } from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { Country, FlagType, getAllCountries } from 'react-native-country-picker-modal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthStackParamList } from '.';
import { http } from '../../helpers/http';

import { BackArrow, PhoneNumberpad } from '~/lib/images';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthStack_SignupScreen'>;

const initialCode = 'US';
const initialCallingCode = '1';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const getCountryDisplayName = (country: Country) =>
  typeof country.name === 'string' ? country.name : country.name.common;

const AuthStack_SignupScreen: React.FC<Props> = ({ navigation }) => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(initialCode);
  const [callingCode, setCallingCode] = useState(initialCallingCode);
  const [isSending, setIsSending] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const rememberMe = false;
  const isCompactHeight = height < 720;
  const sidePadding = clamp(width * 0.043, 16, 24);
  const contentHeight = height - insets.top - insets.bottom;
  const heroHeight = clamp(height * 0.19, 142, 154);
  const titleSize = clamp(width * 0.058, 21, 24);
  const inputHeight = clamp(height * 0.066, 56, 64);
  const buttonHeight = clamp(height * 0.068, 58, 64);
  const examplePhone = getExampleNumber(countryCode as any, examples);
  const maxPhoneDigits = examplePhone?.nationalNumber.length ?? 16;
  const formattedPhone = new AsYouType(countryCode as any).input(phone);
  const phonePlaceholder = examplePhone?.formatNational() ?? 'Phone number';
  const isPhoneValid = phone.length > 0 && isValidPhoneNumber(`+${callingCode}${phone}`, countryCode as any);
  const filteredCountries = useMemo(() => {
    const normalizedSearch = countrySearch.trim().toLowerCase();

    return countries
      .filter((country) => country.callingCode?.length)
      .filter((country) => {
        if (!normalizedSearch) return true;
        const countryName = getCountryDisplayName(country);

        return (
          countryName.toLowerCase().includes(normalizedSearch) ||
          country.cca2.toLowerCase().includes(normalizedSearch) ||
          country.callingCode.some((code) => code.includes(normalizedSearch.replace(/^\+/, '')))
        );
      });
  }, [countries, countrySearch]);

  useEffect(() => {
    getAllCountries(FlagType.EMOJI, 'common')
      .then((loadedCountries) => {
        setCountries(loadedCountries);
      })
      .catch((error) => {
        console.error('Error loading countries:', error);
      });
  }, []);

  const onSelectCountry = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(country.callingCode[0]);
    setCountrySearch('');
    setPickerVisible(false);
    setPhone('');
  };

  const onSendCode = () => {
    const phoneNumber = `+${callingCode}${phone}`;
    if (!isValidPhoneNumber(phoneNumber, countryCode as any)) {
      alert('Please Enter Phone Number');
      return;
    }
    if (isSending) return;

    setIsSending(true);
    http
      .post('/auth/generate-otp', { phoneNumber })
      .then((res) => {
        if (res.status === 200) {
          navigation.navigate('AuthStack_OTPScreen', {
            phoneNumber,
            countryCode,
            rememberMe,
          });
        } else {
          alert('Failed to send OTP. Please try again.');
        }
      })
      .catch((error) => {
        console.error('Error sending OTP:', error);
        alert('Failed to send OTP. Please try again.');
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              minHeight: contentHeight,
              paddingHorizontal: sidePadding,
              paddingTop: isCompactHeight ? 15 : 23,
              paddingBottom: Math.max(insets.bottom + 18, 28),
            },
          ]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.6}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.backButton}>
            <Image source={BackArrow} style={styles.backIcon} resizeMode="contain" />
          </TouchableOpacity>

          <View
            style={[
              styles.heroCard,
              {
                height: heroHeight,
                marginTop: isCompactHeight ? 22 : 39,
              },
            ]}>
            <Image
              source={PhoneNumberpad}
              resizeMode="contain"
              style={[
                styles.heroImage,
                {
                  height: heroHeight,
                  width: Math.min(width - sidePadding * 2, 350),
                },
              ]}
            />
          </View>

          <Text
            style={[
              styles.title,
              {
                fontSize: titleSize,
                lineHeight: titleSize * 1.2,
                marginTop: isCompactHeight ? 31 : 69,
              },
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}>
            What's your phone number?
          </Text>

          <View
            style={[
              styles.phoneInputShell,
              {
                height: inputHeight,
                marginTop: isCompactHeight ? 26 : 33,
              },
            ]}>
            <TouchableOpacity
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.65}
              style={styles.countryButton}>
              <View style={styles.flagCircle}>
                <Image
                  source={{
                    uri: `https://flagcdn.com/w320/${countryCode.toLowerCase()}.png`,
                  }}
                  style={styles.flag}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.callingCode}>+{callingCode}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TextInput
              style={styles.phoneInput}
              value={formattedPhone}
              placeholder={phonePlaceholder}
              placeholderTextColor="#A8B1BE"
              keyboardType="phone-pad"
              maxLength={phonePlaceholder.length}
              textContentType="telephoneNumber"
              selectionColor="#171827"
              onChangeText={(text) => {
                const numericValue = text.replace(/[^0-9]/g, '').slice(0, maxPhoneDigits);
                const isDeleting = text.length < formattedPhone.length;

                if (isDeleting && numericValue === phone) {
                  setPhone(phone.slice(0, -1));
                  return;
                }

                setPhone(numericValue);
              }}
            />
          </View>

          <TouchableOpacity
            onPress={onSendCode}
            activeOpacity={0.8}
            disabled={isSending || !isPhoneValid}
            style={[
              styles.continueButton,
              {
                height: buttonHeight,
                marginTop: isCompactHeight ? 74 : 116,
                backgroundColor: isPhoneValid ? '#9BC425' : '#CBE783',
                opacity: isSending ? 0.65 : 1,
              },
            ]}>
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View
            style={[
              styles.countrySheet,
              {
                height: height * 0.79,
                paddingBottom: Math.max(insets.bottom, 12),
                paddingHorizontal: sidePadding,
              },
            ]}>
            <View style={styles.sheetHandle} />
            <TextInput
              style={styles.countrySearchInput}
              value={countrySearch}
              placeholder="Enter country name"
              placeholderTextColor="#A8B1BE"
              selectionColor="#171827"
              onChangeText={setCountrySearch}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.cca2}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              contentContainerStyle={styles.countryListContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.65}
                  style={styles.countryRow}
                  onPress={() => onSelectCountry(item)}>
                  <View style={styles.countryFlagCircle}>
                    <Image
                      source={{
                        uri: `https://flagcdn.com/w80/${item.cca2.toLowerCase()}.png`,
                      }}
                      style={styles.countryFlag}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.countryName}>{getCountryDisplayName(item)}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  backIcon: {
    height: 22,
    tintColor: '#171827',
    width: 22,
  },
  heroCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#E7EBF0',
    borderRadius: 39,
    borderWidth: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroImage: {
    marginBottom: -2,
  },
  title: {
    color: '#171827',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0,
  },
  phoneInputShell: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderColor: '#CDE989',
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    paddingHorizontal: 19,
  },
  countryButton: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  flagCircle: {
    borderRadius: 19,
    height: 38,
    overflow: 'hidden',
    width: 38,
  },
  flag: {
    height: 38,
    width: 51,
  },
  callingCode: {
    color: '#171827',
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginLeft: 10,
  },
  divider: {
    backgroundColor: '#E5E9EE',
    height: 40,
    marginLeft: 18,
    marginRight: 12,
    width: 1,
  },
  phoneInput: {
    color: '#171827',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 22,
    letterSpacing: 0,
    padding: 0,
  },
  continueButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 999,
    justifyContent: 'center',
  },
  continueText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: 0,
    lineHeight: 24,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(23, 24, 39, 0.22)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  countrySheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingTop: 18,
    shadowColor: '#171827',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: '#D8DDE2',
    borderRadius: 999,
    height: 5,
    marginBottom: 26,
    width: 68,
  },
  countrySearchInput: {
    borderColor: '#E7EBF0',
    borderRadius: 999,
    borderWidth: 1.5,
    color: '#171827',
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    height: 58,
    letterSpacing: 0,
    marginBottom: 18,
    paddingHorizontal: 22,
  },
  countryListContent: {
    paddingBottom: 18,
  },
  countryRow: {
    alignItems: 'center',
    borderBottomColor: '#E7EBF0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  countryFlagCircle: {
    borderRadius: 12,
    height: 24,
    marginRight: 13,
    overflow: 'hidden',
    width: 24,
  },
  countryFlag: {
    height: 24,
    width: 32,
  },
  countryName: {
    color: '#171827',
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    letterSpacing: 0,
    lineHeight: 22,
  },
});

export default AuthStack_SignupScreen;
