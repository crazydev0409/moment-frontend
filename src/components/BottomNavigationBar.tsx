import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Modal,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import {
  HomeIcon,
  CalendarIcon,
  MeshIcon,
  HookIcon,
  PlusIcon,
  CrossIcon,
  SearchIcon,
  Avatar,
  TwoPeople,
  ChevronIcon,
} from '~/lib/images';
import { AppStackParamList } from '~/navigation/AppStack';
import tw from '~/tailwindcss';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type HomeOnboardingStep = 0 | 1 | 2 | 3 | 4;
type ButtonFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const HOME_ONBOARDING_KEY = 'hasSeenHomeOnboardingTour';
const ONBOARDING_GREEN = '#9AC51F';
const ONBOARDING_INK = '#171927';
const ONBOARDING_MUTED = '#6F7780';

interface BottomNavigationBarProps {
  selectedTab?: string;
  onHomePress?: () => void;
  onCalendarPress?: () => void;
  onBusinessPress?: () => void;
  onProfilePress?: () => void;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  selectedTab = 'home',
  onHomePress,
  onCalendarPress,
  onBusinessPress,
  onProfilePress,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // State for Modals
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showMeetingTypeModal, setShowMeetingTypeModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearchText, setContactSearchText] = useState('');
  const isTransitioning = false;
  const [homeOnboardingStep, setHomeOnboardingStep] = useState<HomeOnboardingStep | null>(null);
  const [addButtonFrame, setAddButtonFrame] = useState<ButtonFrame | null>(null);

  // Animation values for smooth modal transitions
  const addButtonRef = useRef<View>(null);
  const contactModalSlideAnim = useRef(new Animated.Value(0)).current;
  const contactModalOpacityAnim = useRef(new Animated.Value(0)).current;
  const [contactModalContentHeight, setContactModalContentHeight] = useState(
    Dimensions.get('window').height
  );
  const contactScrollMaxHeight = Math.max(
    contactModalContentHeight - verticalScale(130),
    verticalScale(150)
  );
  const screenWidth = Dimensions.get('window').width;
  const navGap = horizontalScale(6);
  const addButtonSize = horizontalScale(57);
  const showHomeOnboarding = selectedTab === 'home' && homeOnboardingStep !== null;
  const showOnboardingAddMenu =
    showHomeOnboarding &&
    homeOnboardingStep !== null &&
    homeOnboardingStep >= 2 &&
    !showContactModal &&
    !isTransitioning;

  useEffect(() => {
    const t = setTimeout(() => {
      addButtonRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0) setAddButtonFrame({ x, y, width, height });
      });
    }, 150);
    return () => clearTimeout(t);
  }, [insets.bottom]);

  useEffect(() => {
    let mounted = true;

    const loadHomeOnboarding = async () => {
      if (selectedTab !== 'home') return;

      try {
        const hasSeen = await AsyncStorage.getItem(HOME_ONBOARDING_KEY);
        if (!hasSeen && mounted) {
          setHomeOnboardingStep(0);
        }
      } catch (error) {
        console.error('Error loading home onboarding state:', error);
      }
    };

    loadHomeOnboarding();

    return () => {
      mounted = false;
    };
  }, [selectedTab]);

  const completeHomeOnboarding = async () => {
    setHomeOnboardingStep(null);
    setShowAddMenu(false);
    try {
      await AsyncStorage.setItem(HOME_ONBOARDING_KEY, 'true');
    } catch (error) {
      console.error('Error saving home onboarding state:', error);
    }
  };

  const handleHomeOnboardingNext = () => {
    if (homeOnboardingStep === null) return;
    if (homeOnboardingStep >= 4) {
      completeHomeOnboarding();
      return;
    }
    setHomeOnboardingStep((homeOnboardingStep + 1) as HomeOnboardingStep);
  };

  // Handle Tab Navigation
  const handleHomePress = () => {
    if (onHomePress) {
      onHomePress();
    } else {
      navigation.navigate('AppStack_HomePageScreen');
    }
  };

  const handleCalendarPress = () => {
    if (onCalendarPress) {
      onCalendarPress();
    } else {
      navigation.navigate('AppStack_CalendarScreen');
    }
  };

  const handleBusinessPress = () => {
    if (onBusinessPress) {
      onBusinessPress();
    } else {
      navigation.navigate('AppStack_MeshScreen');
    }
  };

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      navigation.navigate('AppStack_ContactScreen');
    }
  };

  // Add Button & Modal Logic
  const handleAddPress = () => {
    addButtonRef.current?.measureInWindow((x, y, width, height) => {
      setAddButtonFrame({ x, y, width, height });
    });

    if (showHomeOnboarding && homeOnboardingStep !== null && homeOnboardingStep < 2) {
      setHomeOnboardingStep(2);
      return;
    }
    setShowAddMenu(true);
  };

  const handleBookMeeting = () => {
    setShowAddMenu(false);
    setShowMeetingTypeModal(true);
  };

  const handleMeetingTypeSelect = (mode: 'one' | 'group') => {
    setShowMeetingTypeModal(false);
    navigation.navigate('AppStack_SendCatchScreen', { mode });
  };

  const handleManageAvailability = () => {
    setShowAddMenu(false);
    navigation.navigate('AppStack_AvailabilityScreen');
  };

  const handleMyHooks = () => {
    setShowAddMenu(false);
    navigation.navigate('AppStack_MyHooksScreen');
  };

  const loadContacts = useCallback(async () => {
    try {
      const response = await http.get('/users/contacts');
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.', [{ text: 'OK' }]);
      setShowContactModal(false);
    }
  }, []);

  useEffect(() => {
    if (showContactModal) {
      loadContacts();
    }
  }, [showContactModal, loadContacts]);

  const filteredContacts = contacts
    .filter((contact) =>
      contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase())
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const handleContactSelect = (contact: any) => {
    setShowContactModal(false);
    setContactSearchText('');
    // Navigate to CalendarScreen with selected contact
    const today = new Date().toISOString().split('T')[0];
    navigation.navigate('AppStack_CalendarScreen', {
      date: today,
      contact,
    });
  };

  const handleCloseContactModal = () => {
    Animated.parallel([
      Animated.timing(contactModalSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(contactModalOpacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowContactModal(false);
      setContactSearchText('');
    });
  };

  const renderDashboardPreview = () => (
    <View style={{ gap: verticalScale(6), width: horizontalScale(144) }}>
      <View style={tw`flex-row gap-2`}>
        <View
          style={[
            tw`rounded-xl items-center justify-center`,
            {
              backgroundColor: '#DDEFA2',
              height: horizontalScale(58),
              width: horizontalScale(34),
            },
          ]}>
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 3,
                height: verticalScale(4),
                marginVertical: verticalScale(3),
                width: horizontalScale(14),
              }}
            />
          ))}
        </View>
        <View
          style={[
            tw`rounded-xl justify-center`,
            {
              backgroundColor: '#F4F5F6',
              flex: 1,
              height: horizontalScale(58),
              paddingHorizontal: horizontalScale(12),
            },
          ]}>
          <View
            style={{
              backgroundColor: '#D6DDE3',
              borderRadius: 4,
              height: verticalScale(5),
              marginBottom: verticalScale(10),
              width: horizontalScale(32),
            }}
          />
          <View style={tw`flex-row items-center gap-2`}>
            <View
              style={{
                backgroundColor: '#C9D1D8',
                borderRadius: horizontalScale(8),
                height: horizontalScale(16),
                width: horizontalScale(16),
              }}
            />
            <View>
              <View
                style={{
                  backgroundColor: '#C9D1D8',
                  borderRadius: 4,
                  height: verticalScale(5),
                  marginBottom: verticalScale(5),
                  width: horizontalScale(54),
                }}
              />
              <View
                style={{
                  backgroundColor: '#D6DDE3',
                  borderRadius: 4,
                  height: verticalScale(4),
                  width: horizontalScale(30),
                }}
              />
            </View>
          </View>
        </View>
      </View>
      <View
        style={[
          tw`rounded-xl flex-row items-center justify-between`,
          {
            backgroundColor: '#F4F5F6',
            height: horizontalScale(58),
            paddingHorizontal: horizontalScale(12),
          },
        ]}>
        <View>
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              style={{
                backgroundColor: item === 0 ? '#D6DDE3' : '#C9D1D8',
                borderRadius: 4,
                height: verticalScale(6),
                marginVertical: verticalScale(3),
                width: item === 0 ? horizontalScale(28) : horizontalScale(item === 1 ? 72 : 50),
              }}
            />
          ))}
        </View>
        <View
          style={{
            backgroundColor: '#C9D1D8',
            borderRadius: horizontalScale(20),
            height: horizontalScale(40),
            width: horizontalScale(40),
          }}
        />
      </View>
    </View>
  );

  const renderMeetingsPreview = () => (
    <View
      style={[
        tw`rounded-xl`,
        {
          backgroundColor: '#F6F7F8',
          height: horizontalScale(138),
          padding: horizontalScale(16),
          width: horizontalScale(118),
        },
      ]}>
      <View style={tw`flex-row gap-1 mb-3`}>
        {[34, 36, 38].map((width) => (
          <View
            key={width}
            style={{
              backgroundColor: '#D1D8DE',
              borderRadius: 4,
              height: verticalScale(6),
              width: horizontalScale(width),
            }}
          />
        ))}
      </View>
      {[0, 1, 2].map((item) => (
        <View
          key={item}
          style={{
            backgroundColor: '#D8DEE4',
            borderRadius: 5,
            height: verticalScale(30),
            marginBottom: verticalScale(7),
          }}
        />
      ))}
    </View>
  );

  const renderOnboardingCard = ({
    title,
    body,
    top,
    left,
    right,
    width,
    tail = 'bottom-left',
    preview,
  }: {
    title: string;
    body: string;
    top?: number;
    left?: number;
    right?: number;
    width: number;
    tail?: 'bottom-left' | 'right' | 'none';
    preview?: React.ReactNode;
  }) => (
    <View
      style={[
        tw`absolute bg-white`,
        {
          borderRadius: horizontalScale(16),
          left,
          right,
          top,
          width,
          paddingHorizontal: horizontalScale(16),
          paddingVertical: verticalScale(14),
        },
      ]}>
      <View style={tw`flex-row items-center justify-between`}>
        <View style={{ flex: 1, paddingRight: preview ? horizontalScale(14) : 0 }}>
          <Text
            style={[
              tw`font-associate`,
              {
                color: ONBOARDING_INK,
                fontSize: moderateScale(21),
                lineHeight: moderateScale(27),
                marginBottom: verticalScale(7),
              },
            ]}>
            {title}
          </Text>
          <Text
            style={[
              tw`font-associate`,
              {
                color: ONBOARDING_MUTED,
                fontSize: moderateScale(16),
                lineHeight: moderateScale(20),
              },
            ]}>
            {body}
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleHomeOnboardingNext}>
            <Text
              style={[
                tw`font-associate-bold`,
                {
                  color: ONBOARDING_GREEN,
                  fontSize: moderateScale(17),
                  marginTop: verticalScale(13),
                },
              ]}>
              Got It
            </Text>
          </TouchableOpacity>
        </View>
        {preview}
      </View>
      {tail === 'bottom-left' && (
        <View
          style={[
            tw`absolute bg-white`,
            {
              bottom: -horizontalScale(9),
              height: horizontalScale(22),
              left: horizontalScale(34),
              transform: [{ rotate: '45deg' }],
              width: horizontalScale(22),
            },
          ]}
        />
      )}
      {tail === 'right' && (
        <View
          style={[
            tw`absolute bg-white`,
            {
              height: horizontalScale(22),
              right: -horizontalScale(8),
              top: '58%',
              transform: [{ rotate: '45deg' }],
              width: horizontalScale(22),
            },
          ]}
        />
      )}
    </View>
  );

  return (
    <>
      <View
        style={[
          tw`absolute left-0 right-0 justify-center flex-row`,
          { gap: navGap, bottom: Math.max(insets.bottom, 30) },
          showContactModal && { opacity: 0 },
        ]}>
        <View
          style={[
            tw`flex-row items-center rounded-full overflow-hidden`,
            {
              backgroundColor: '#1C1D26',
              gap: horizontalScale(6),
              padding: verticalScale(7.5),
            },
          ]}>
          {([
            { tab: 'home', icon: HomeIcon, tint: true, onPress: handleHomePress },
            { tab: 'calendar', icon: CalendarIcon, tint: true, onPress: handleCalendarPress },
            { tab: 'business', icon: MeshIcon, tint: true, onPress: handleBusinessPress },
            { tab: 'profile', icon: TwoPeople, tint: true, onPress: handleProfilePress },
          ] as const).map(({ tab, icon, tint, onPress }) => (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              onPress={onPress}
              style={{
                backgroundColor: selectedTab === tab ? '#97B92A' : '#2D2F3C',
                borderRadius: 9999,
                alignItems: 'center',
                justifyContent: 'center',
                padding: horizontalScale(12),
              }}>
              <Image
                source={icon}
                tintColor="#FFFFFF"
                style={{ width: horizontalScale(18), height: horizontalScale(18) }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          ref={addButtonRef}
          style={{
            backgroundColor: '#2D2F3C',
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
            width: addButtonSize,
            height: addButtonSize,
          }}
          activeOpacity={0.7}
          onPress={handleAddPress}>
          <Image
            source={PlusIcon}
            tintColor="#FFFFFF"
            style={{ width: horizontalScale(18), height: horizontalScale(18) }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {showHomeOnboarding && homeOnboardingStep !== null && homeOnboardingStep < 2 && (
        <Modal visible transparent animationType="fade" onRequestClose={completeHomeOnboarding}>
          <View style={tw`flex-1`}>
            <BlurView intensity={10} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-20`} />
            </BlurView>
            {homeOnboardingStep === 0 &&
              renderOnboardingCard({
                title: 'Dashboard',
                body: 'Your next scheduled meeting will appear here.',
                top: Math.max(insets.top + verticalScale(136), verticalScale(190)),
                left: horizontalScale(16),
                width: screenWidth - horizontalScale(32),
                preview: renderDashboardPreview(),
              })}
            {homeOnboardingStep === 1 &&
              renderOnboardingCard({
                title: 'Your meetings',
                body: 'Your meetings for this day will appear here, grouped by hooks.',
                top: verticalScale(532),
                left: horizontalScale(16),
                width: screenWidth - horizontalScale(48),
                preview: renderMeetingsPreview(),
              })}
          </View>
        </Modal>
      )}

      {/* Add Menu Popup Modal - Only render when contact modal is not active */}
      {!showContactModal && !isTransitioning && (
        <Modal
          visible={showAddMenu || showOnboardingAddMenu}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (showOnboardingAddMenu) {
              completeHomeOnboarding();
              return;
            }
            setShowAddMenu(false);
          }}>
          <View style={tw`flex-1`}>
            <TouchableOpacity
              style={tw`flex-1`}
              activeOpacity={1}
              onPress={() => {
                if (showOnboardingAddMenu) return;
                setShowAddMenu(false);
              }}>
              <BlurView intensity={12} tint="dark" style={tw`absolute inset-0`}>
                <View style={tw`flex-1 bg-black opacity-25`} />
              </BlurView>
            </TouchableOpacity>

            <View
              style={[
                tw`absolute right-0 items-end`,
                {
                  bottom: Math.max(insets.bottom + verticalScale(77), verticalScale(107)),
                  gap: verticalScale(9),
                  paddingRight: horizontalScale(28),
                },
              ]}>
              <View style={[tw`items-end`, { gap: verticalScale(9) }]}>
                <TouchableOpacity
                  style={[
                    tw`bg-white rounded-full flex-row items-center`,
                    {
                      minWidth: horizontalScale(172),
                      paddingLeft: horizontalScale(12),
                      paddingRight: horizontalScale(18),
                      paddingVertical: verticalScale(8),
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleBookMeeting}>
                  <View
                    style={[
                      tw`rounded-full bg-gray-200 items-center justify-center`,
                      {
                        width: horizontalScale(35),
                        height: horizontalScale(35),
                        marginRight: horizontalScale(10),
                      },
                    ]}>
                    <Image source={ChevronIcon} style={{ width: horizontalScale(22), height: horizontalScale(22) }} tintColor="#000000" />
                  </View>
                  <Text style={[tw`text-black font-associate`, { fontSize: moderateScale(17) }]}>
                    Send a Catch
                  </Text>
                </TouchableOpacity>
                <View style={{ display: 'none', height: 0 }} />
                <TouchableOpacity
                  style={[
                    tw`bg-white rounded-full flex-row items-center`,
                    {
                      minWidth: horizontalScale(150),
                      paddingLeft: horizontalScale(12),
                      paddingRight: horizontalScale(18),
                      paddingVertical: verticalScale(8),
                    },
                  ]}
                  activeOpacity={0.82}
                  onPress={handleMyHooks}>
                  <View
                    style={[
                      tw`rounded-full bg-gray-200 items-center justify-center`,
                      {
                        width: horizontalScale(35),
                        height: horizontalScale(35),
                        marginRight: horizontalScale(10),
                      },
                    ]}>
                    <Image source={HookIcon} tintColor="#171927" style={{ width: horizontalScale(20), height: horizontalScale(20) }} resizeMode="contain" />
                  </View>
                  <Text style={[tw`text-black font-associate`, { fontSize: moderateScale(17) }]}>
                    My Hooks
                  </Text>
                </TouchableOpacity>
                <View style={{ display: 'none', height: 0 }} />
                <TouchableOpacity
                  style={[
                    tw`bg-white rounded-full flex-row items-center`,
                    {
                      minWidth: horizontalScale(202),
                      paddingLeft: horizontalScale(12),
                      paddingRight: horizontalScale(18),
                      paddingVertical: verticalScale(8),
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleManageAvailability}>
                  <View
                    style={[
                      tw`rounded-full bg-gray-200 items-center justify-center`,
                      {
                        width: horizontalScale(35),
                        height: horizontalScale(35),
                        marginRight: horizontalScale(10),
                      },
                    ]}>
                    <Image
                      source={CalendarIcon}
                      tintColor="#171927"
                      style={{ width: horizontalScale(20), height: horizontalScale(20) }}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={[tw`text-black font-associate`, { fontSize: moderateScale(17) }]}>
                    Manage availability
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {showOnboardingAddMenu &&
              homeOnboardingStep === 2 &&
              renderOnboardingCard({
                title: 'Send a Catch',
                body: 'Use this to create and send a new meeting request.',
                top: verticalScale(576),
                left: horizontalScale(16),
                width: horizontalScale(270),
                tail: 'right',
              })}
            {showOnboardingAddMenu &&
              homeOnboardingStep === 3 &&
              renderOnboardingCard({
                title: 'My Hooks',
                body: 'Hooks are reusable meeting templates you can use again and again.',
                top: verticalScale(583),
                left: horizontalScale(16),
                width: horizontalScale(298),
                tail: 'right',
              })}
            {showOnboardingAddMenu &&
              homeOnboardingStep === 4 &&
              renderOnboardingCard({
                title: 'Manage availability',
                body: 'Set your availability so others can see when you’re free to meet.',
                top: verticalScale(546),
                left: horizontalScale(16),
                width: horizontalScale(214),
                tail: 'right',
              })}
            <View
              style={[
                tw`absolute`,
                addButtonFrame
                  ? {
                      height: addButtonFrame.height,
                      left: addButtonFrame.x,
                      top: addButtonFrame.y,
                      width: addButtonFrame.width,
                    }
                  : {
                      bottom: Math.max(insets.bottom, 30),
                      right: horizontalScale(28),
                    },
              ]}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#2D2F3C',
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: addButtonSize,
                  height: addButtonSize,
                }}
                activeOpacity={0.8}
                onPress={() => {
                  if (showOnboardingAddMenu) {
                    completeHomeOnboarding();
                    return;
                  }
                  setShowAddMenu(false);
                }}>
                <Image
                  source={CrossIcon}
                  tintColor="#FFFFFF"
                  style={{ width: horizontalScale(18), height: horizontalScale(18) }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={showMeetingTypeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeetingTypeModal(false)}>
        <View style={tw`flex-1`}>
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={() => setShowMeetingTypeModal(false)}>
            <BlurView intensity={12} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-20`} />
            </BlurView>
          </TouchableOpacity>

          <View
            style={[
              tw`absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl`,
              {
                paddingHorizontal: horizontalScale(16),
                paddingTop: verticalScale(16),
                paddingBottom: Math.max(insets.bottom + verticalScale(20), verticalScale(34)),
              },
            ]}>
            <View
              style={[
                tw`self-center rounded-full bg-gray-300`,
                {
                  width: horizontalScale(64),
                  height: verticalScale(4),
                  marginBottom: verticalScale(22),
                },
              ]}
            />
            <Text
              style={[
                tw`font-associate-bold text-black`,
                { fontSize: moderateScale(28), marginBottom: verticalScale(18) },
              ]}>
              Select catch type
            </Text>

            {[
              { mode: 'one' as const, title: '1-on-1', subtitle: 'Send to one person' },
              { mode: 'group' as const, title: 'Group', subtitle: 'Send to multiple people' },
            ].map((item, index) => (
              <TouchableOpacity
                key={item.mode}
                activeOpacity={0.8}
                onPress={() => handleMeetingTypeSelect(item.mode)}
                style={[
                  tw`flex-row items-center`,
                  {
                    paddingVertical: verticalScale(18),
                    borderBottomWidth: index === 0 ? 1 : 0,
                    borderBottomColor: '#E8EDF2',
                  },
                ]}>
                <View
                  style={[
                    tw`rounded-full bg-gray-100 items-center justify-center`,
                    {
                      width: horizontalScale(56),
                      height: horizontalScale(56),
                      marginRight: horizontalScale(16),
                    },
                  ]}>
                  <Image
                    source={TwoPeople}
                    tintColor="#79828B"
                    style={{ width: horizontalScale(28), height: horizontalScale(28) }}
                    resizeMode="contain"
                  />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(22) }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[tw`font-associate text-grey`, { fontSize: moderateScale(16), marginTop: 2 }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Text style={[tw`font-associate text-gray-400`, { fontSize: moderateScale(24) }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Contact Selection Modal - Only render when add menu is not active */}
      {!showAddMenu && !showMeetingTypeModal && (
        <Modal
          visible={showContactModal && !isTransitioning}
          transparent
          animationType="none"
          onRequestClose={handleCloseContactModal}
          onShow={() => {
            // Animate in when modal becomes visible
            Animated.parallel([
              Animated.timing(contactModalSlideAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(contactModalOpacityAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start();
          }}>
          <Animated.View style={[tw`flex-1`, { opacity: contactModalOpacityAnim }]}>
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
            <KeyboardAvoidingView
              style={tw`flex-1`}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}>
              <TouchableOpacity
                style={tw`flex-1`}
                activeOpacity={1}
                onPress={handleCloseContactModal}>
                <View
                  style={tw`flex-1 justify-end`}
                  onLayout={(e) => setContactModalContentHeight(e.nativeEvent.layout.height)}>
                  <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                    <Animated.View
                      style={[
                        tw`bg-white rounded-t-3xl`,
                        {
                          transform: [
                            {
                              translateY: contactModalSlideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [300, 0],
                              }),
                            },
                          ],
                        },
                      ]}>
                      {/* Header - Fixed */}
                      <View
                        style={[
                          tw`flex-row justify-between items-center`,
                          {
                            paddingTop: verticalScale(22.5),
                            paddingHorizontal: horizontalScale(15),
                            paddingBottom: verticalScale(15),
                          },
                        ]}>
                        <Text
                          style={[
                            tw`text-black font-associate-bold`,
                            { fontSize: moderateScale(18.75) },
                          ]}>
                          Select Contact
                        </Text>
                        <TouchableOpacity onPress={handleCloseContactModal} activeOpacity={0.7}>
                          <Text
                            style={[tw`text-[#A3CB31] font-associate`, { fontSize: moderateScale(15) }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Search Bar - Fixed */}
                      <View
                        style={[
                          tw`bg-gray-100 rounded-2xl flex-row items-center`,
                          {
                            paddingHorizontal: horizontalScale(15),
                            paddingVertical: verticalScale(11.25),
                            marginBottom: verticalScale(15),
                            marginHorizontal: horizontalScale(15),
                          },
                        ]}>
                        <Image
                          source={SearchIcon}
                          style={{
                            width: horizontalScale(18.75),
                            height: horizontalScale(18.75),
                            marginRight: horizontalScale(7.5),
                          }}
                        />
                        <TextInput
                          style={tw`flex-1 text-black font-associate`}
                          placeholder="Search contacts"
                          placeholderTextColor="#999"
                          value={contactSearchText}
                          onChangeText={setContactSearchText}
                        />
                      </View>

                      {/* Contacts List - Scrollable */}
                      <ScrollView
                        style={{ maxHeight: contactScrollMaxHeight }}
                        contentContainerStyle={{
                          paddingHorizontal: horizontalScale(15),
                          paddingBottom: verticalScale(30),
                        }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled">
                        {filteredContacts.length > 0 ? (
                          (() => {
                            const registered = filteredContacts.filter((c) => !!c.contactUser?.id);
                            const unregistered = filteredContacts.filter((c) => !c.contactUser?.id);
                            const renderRow = (contact: any, isDisabled: boolean) => (
                              <TouchableOpacity
                                key={contact.id}
                                style={[
                                  tw`flex-row items-center border-b border-gray-100`,
                                  { paddingVertical: verticalScale(15) },
                                ]}
                                activeOpacity={isDisabled ? 1 : 0.7}
                                onPress={() => !isDisabled && handleContactSelect(contact)}
                                disabled={isDisabled}>
                                <View
                                  style={[
                                    tw`rounded-full items-center justify-center overflow-hidden`,
                                    {
                                      width: horizontalScale(45),
                                      height: horizontalScale(45),
                                      marginRight: horizontalScale(15),
                                      backgroundColor: isDisabled ? '#EAEEF2' : '#E0E4E8',
                                    },
                                  ]}>
                                  {contact.contactUser?.avatar ? (
                                    <Image
                                      source={{ uri: contact.contactUser.avatar }}
                                      style={{ width: horizontalScale(45), height: horizontalScale(45), borderRadius: 9999 }}
                                    />
                                  ) : (
                                    <Image
                                      source={Avatar}
                                      style={{ width: horizontalScale(30), height: horizontalScale(30) }}
                                    />
                                  )}
                                </View>
                                <View style={tw`flex-1`}>
                                  <Text
                                    style={[
                                      tw`font-associate-bold`,
                                      { fontSize: moderateScale(15), color: isDisabled ? '#9AA3AC' : '#1C1D26' },
                                    ]}>
                                    {contact.displayName}
                                  </Text>
                                  {contact.contactPhone && (
                                    <Text style={[tw`text-grey font-associate`, { fontSize: moderateScale(13) }]}>
                                      {contact.contactPhone}
                                    </Text>
                                  )}
                                </View>
                                {isDisabled && (
                                  <View
                                    style={{
                                      borderWidth: 1,
                                      borderColor: '#D8DEE4',
                                      borderRadius: 999,
                                      paddingHorizontal: horizontalScale(10),
                                      paddingVertical: verticalScale(4),
                                    }}>
                                    <Text style={[tw`font-associate-bold`, { color: '#9AA3AC', fontSize: moderateScale(11.5) }]}>
                                      Invite
                                    </Text>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                            return (
                              <>
                                {registered.map((c) => renderRow(c, false))}
                                {unregistered.map((c) => renderRow(c, true))}
                              </>
                            );
                          })()
                        ) : (
                          <View
                            style={{ paddingVertical: verticalScale(37.5), alignItems: 'center' }}>
                            <Text style={[tw`text-grey font-associate`, { fontSize: moderateScale(15) }]}>
                              No contacts found
                            </Text>
                          </View>
                        )}
                      </ScrollView>
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </Animated.View>
        </Modal>
      )}
    </>
  );
};

export default BottomNavigationBar;
