import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Modal,
  Text,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import {
  HomeIcon,
  CalendarIcon,
  MeshIcon,
  HookIcon,
  PlusIcon,
  CrossIcon,
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
  const [homeOnboardingStep, setHomeOnboardingStep] = useState<HomeOnboardingStep | null>(null);
  const [addButtonFrame, setAddButtonFrame] = useState<ButtonFrame | null>(null);

  // Animation values for smooth modal transitions
  const addButtonRef = useRef<View>(null);
  const screenWidth = Dimensions.get('window').width;
  const navGap = horizontalScale(6);
  const addButtonSize = horizontalScale(57);
  const showHomeOnboarding = selectedTab === 'home' && homeOnboardingStep !== null;
  const showOnboardingAddMenu =
    showHomeOnboarding && homeOnboardingStep !== null && homeOnboardingStep >= 2;

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
                paddingTop: verticalScale(14),
                paddingBottom: Math.max(insets.bottom + verticalScale(16), verticalScale(28)),
              },
            ]}>
            <View
              style={[
                tw`self-center rounded-full bg-gray-300`,
                {
                  width: horizontalScale(56),
                  height: verticalScale(4),
                  marginBottom: verticalScale(18),
                },
              ]}
            />
            <Text
              style={[
                tw`font-associate-bold text-black`,
                { fontSize: moderateScale(22), marginBottom: verticalScale(14) },
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
                    paddingVertical: verticalScale(14),
                    borderBottomWidth: index === 0 ? 1 : 0,
                    borderBottomColor: '#E8EDF2',
                  },
                ]}>
                <View
                  style={[
                    tw`rounded-full bg-gray-100 items-center justify-center`,
                    {
                      width: horizontalScale(46),
                      height: horizontalScale(46),
                      marginRight: horizontalScale(14),
                    },
                  ]}>
                  <Image
                    source={TwoPeople}
                    tintColor="#79828B"
                    style={{ width: horizontalScale(22), height: horizontalScale(22) }}
                    resizeMode="contain"
                  />
                </View>
                <View style={tw`flex-1`}>
                  <Text style={[tw`font-associate text-black`, { fontSize: moderateScale(18) }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[tw`font-associate text-grey`, { fontSize: moderateScale(13), marginTop: 2 }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Text style={[tw`font-associate text-gray-400`, { fontSize: moderateScale(20) }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

    </>
  );
};

export default BottomNavigationBar;
