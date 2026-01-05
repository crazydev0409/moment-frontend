import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Image, Modal, Text, TextInput, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import tw from '~/tailwindcss';
import { HomeIcon, CalendarIcon, BusinessIcon, AddIcon, Search, Avatar, TwoPeople } from '~/lib/images';
import { AppStackParamList } from '~/navigation/AppStack';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { http } from '~/helpers/http';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

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
  onProfilePress
}) => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // State for Modals
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearchText, setContactSearchText] = useState('');

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
      navigation.navigate('AppStack_ComingSoonScreen');
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
    setShowAddMenu(true);
  };

  const handleBookMeeting = () => {
    setShowAddMenu(false);
    setShowContactModal(true);
  };

  const loadContacts = async () => {
    try {
      const response = await http.get('/users/contacts');
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  useEffect(() => {
    if (showContactModal) {
      loadContacts();
    }
  }, [showContactModal]);

  const filteredContacts = contacts.filter(contact =>
    contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase())
  );

  const handleContactSelect = (contact: any) => {
    setShowContactModal(false);
    // Navigate to DateDetailScreen with selected contact
    const today = new Date().toISOString().split('T')[0];
    navigation.navigate('AppStack_DateDetailScreen', {
      date: today,
      contact: contact
    });
  };

  return (
    <>
      <View style={[tw`absolute left-0 right-0 justify-center flex-row`, { gap: horizontalScale(7.5), bottom: Math.max(insets.bottom, 20) }]}>
        <View style={[tw`flex-row items-center rounded-full bg-black overflow-hidden`, { gap: horizontalScale(7.5), padding: verticalScale(9.375) }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleHomePress}
            style={[tw`${selectedTab === 'home' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
          >
            <Image source={HomeIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCalendarPress}
            style={[tw`${selectedTab === 'calendar' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
          >
            <Image source={CalendarIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBusinessPress}
            style={[tw`${selectedTab === 'business' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
          >
            <Image source={BusinessIcon} style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleProfilePress}
            style={[tw`${selectedTab === 'profile' ? 'bg-[#A3CB31]' : 'bg-[#222222]'} rounded-full items-center justify-center`, { padding: horizontalScale(15) }]}
          >
            <Image source={TwoPeople} tintColor="#FFFFFF" style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[tw`bg-black rounded-full items-center justify-center`, { padding: horizontalScale(24.375) }]}
          activeOpacity={0.7}
          onPress={handleAddPress}
        >
          <Image source={AddIcon} tintColor="#FFFFFF" style={{ width: horizontalScale(22.5), height: horizontalScale(22.5) }} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      {/* Add Menu Popup Modal */}
      <Modal
        visible={showAddMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <View style={tw`flex-1`}>
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={() => setShowAddMenu(false)}
          >
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
          </TouchableOpacity>

          <View style={[tw`absolute bottom-0 left-0 right-0 items-center`, { paddingBottom: verticalScale(90) }]}>
            <View style={[tw`bg-white rounded-3xl w-11/12 overflow-hidden`, { paddingHorizontal: horizontalScale(15) }]}>
              <TouchableOpacity
                style={[tw`flex-row items-center`, { paddingHorizontal: horizontalScale(22.5), paddingVertical: verticalScale(15) }]}
                activeOpacity={0.7}
                onPress={handleBookMeeting}
              >
                <View style={[tw`rounded-full bg-gray-200 items-center justify-center`, { width: horizontalScale(37.5), height: horizontalScale(37.5), marginRight: horizontalScale(15) }]}>
                  <Text style={[tw`text-black font-bold`, { fontSize: moderateScale(18.75) }]}>+</Text>
                </View>
                <Text style={[tw`text-black font-dm flex-1`, { fontSize: moderateScale(15) }]}>Book a meeting</Text>
              </TouchableOpacity>
              <View style={[tw`bg-gray-200`, { height: verticalScale(1.125), marginHorizontal: horizontalScale(22.5) }]} />
              <TouchableOpacity
                style={[
                  tw`flex-row items-center opacity-50`,
                  { paddingHorizontal: horizontalScale(22.5), paddingVertical: verticalScale(15) }
                ]}
                activeOpacity={1}
                disabled={true}
              >
                <View style={[tw`rounded-full bg-gray-200 items-center justify-center`, { width: horizontalScale(37.5), height: horizontalScale(37.5), marginRight: horizontalScale(15) }]}>
                  <Text style={[tw`text-black font-bold`, { fontSize: moderateScale(18.75) }]}>+</Text>
                </View>
                <Text style={[tw`text-black font-dm flex-1`, { fontSize: moderateScale(15) }]}>Create meeting type</Text>
              </TouchableOpacity>
              <View style={[tw`bg-gray-200`, { height: verticalScale(1.125), marginHorizontal: horizontalScale(22.5) }]} />
              <TouchableOpacity
                style={[
                  tw`flex-row items-center opacity-50`,
                  { paddingHorizontal: horizontalScale(22.5), paddingVertical: verticalScale(15) }
                ]}
                activeOpacity={1}
                disabled={true}
              >
                <View style={[tw`rounded-full bg-gray-200 items-center justify-center`, { width: horizontalScale(37.5), height: horizontalScale(37.5), marginRight: horizontalScale(15) }]}>
                  <Text style={[tw`text-black font-bold`, { fontSize: moderateScale(18.75) }]}>+</Text>
                </View>
                <Text style={[tw`text-black font-dm flex-1`, { fontSize: moderateScale(15) }]}>Manage availability</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Selection Modal */}
      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={tw`flex-1`}>
          <TouchableOpacity
            style={tw`flex-1`}
            activeOpacity={1}
            onPress={() => setShowContactModal(false)}
          >
            <BlurView intensity={20} tint="dark" style={tw`absolute inset-0`}>
              <View style={tw`flex-1 bg-black opacity-40`} />
            </BlurView>
          </TouchableOpacity>

          <View style={tw`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl`}>
            <View style={[{ paddingTop: verticalScale(22.5), paddingBottom: verticalScale(30) }, { paddingHorizontal: '4%' }]}>
              {/* Header */}
              <View style={[tw`flex-row justify-between items-center`, { marginBottom: verticalScale(15) }]}>
                <Text style={[tw`text-black font-bold font-dm`, { fontSize: moderateScale(18.75) }]}>Select Contact</Text>
                <TouchableOpacity
                  onPress={() => setShowContactModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[tw`text-[#A3CB31] font-dm`, { fontSize: moderateScale(15) }]}>Cancel</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={[tw`bg-gray-100 rounded-2xl flex-row items-center`, { paddingHorizontal: horizontalScale(15), paddingVertical: verticalScale(11.25), marginBottom: verticalScale(15) }]}>
                <Image source={Search} style={{ width: horizontalScale(18.75), height: horizontalScale(18.75), marginRight: horizontalScale(7.5) }} />
                <TextInput
                  style={[tw`flex-1 text-black font-dm`, { fontSize: moderateScale(13.125) }]}
                  placeholder="Search contacts"
                  placeholderTextColor="#999"
                  value={contactSearchText}
                  onChangeText={setContactSearchText}
                />
              </View>

              {/* Contacts List */}
              <ScrollView style={{ maxHeight: verticalScale(337.5) }} showsVerticalScrollIndicator={false}>
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => {
                    const isDisabled = !contact.contactUser?.id;
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        style={[
                          tw`flex-row items-center border-b border-gray-100`,
                          { paddingVertical: verticalScale(15) },
                          isDisabled && tw`opacity-50`
                        ]}
                        activeOpacity={isDisabled ? 1 : 0.7}
                        onPress={() => !isDisabled && handleContactSelect(contact)}
                        disabled={isDisabled}
                      >
                        <View style={[tw`rounded-full bg-gray-200 items-center justify-center overflow-hidden`, { width: horizontalScale(45), height: horizontalScale(45), marginRight: horizontalScale(15) }]}>
                          {contact.contactUser?.avatar ? (
                            <Image
                              source={{ uri: contact.contactUser.avatar }}
                              style={{ width: horizontalScale(45), height: horizontalScale(45), borderRadius: 9999 }}
                            />
                          ) : (
                            <Image source={Avatar} style={{ width: horizontalScale(30), height: horizontalScale(30) }} />
                          )}
                        </View>
                        <View style={tw`flex-1`}>
                          <Text style={[tw`text-black font-bold font-dm`, { fontSize: moderateScale(15) }]}>
                            {contact.displayName}
                          </Text>
                          {contact.contactPhone && (
                            <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(13.125) }]}>
                              {contact.contactPhone}
                            </Text>
                          )}
                          {isDisabled && (
                            <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(11.25), marginTop: 1 }]}>
                              Not registered
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: verticalScale(37.5), alignItems: 'center' }}>
                    <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(15) }]}>No contacts found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default BottomNavigationBar;

