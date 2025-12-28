import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    ScrollView,
    TextInput,
    Modal,
    Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import * as Contacts from 'expo-contacts';
import tw from '~/tailwindcss';
import { AppStackParamList } from '.';
import { Background, Notification, Avatar, AddIcon, HomeIcon, CalendarIcon, BusinessIcon, ProfileIcon, Search, BackArrow } from '~/lib/images';
import { http } from '~/helpers/http';
import { useAddButton } from '~/contexts/AddButtonContext';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';
import { hashPhoneNumber } from '~/utils/phoneHash';

type Props = NativeStackScreenProps<
    AppStackParamList,
    'AppStack_ContactScreen'
>;

interface Contact {
    id: string;
    name: string;
    imageUri?: string;
    backendContact?: any;
}

const AppStack_ContactScreen: React.FC<Props> = ({ navigation, route }) => {
    const { setOnAddPress } = useAddButton();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [searchText, setSearchText] = useState('');
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactSearchText, setContactSearchText] = useState('');
    const [contactsForSelection, setContactsForSelection] = useState<any[]>([]);

    useEffect(() => {
        loadContacts();
    }, []);

    // Register add button handler
    useEffect(() => {
        setOnAddPress(() => () => setShowAddMenu(true));

        // Cleanup on unmount
        return () => {
            setOnAddPress(undefined);
        };
    }, [setOnAddPress]);

    const loadContacts = async () => {
        try {
            // Check permission status first
            const { status: existingStatus } = await Contacts.getPermissionsAsync();
            let finalStatus = existingStatus;

            // Only request if not already granted
            if (existingStatus !== 'granted') {
                const { status } = await Contacts.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [
                        Contacts.Fields.Name,
                        Contacts.Fields.Image,
                        Contacts.Fields.PhoneNumbers
                    ],
                });

                // Create a map of hashed phone numbers to local contact avatars
                const phoneToAvatarMap = new Map<string, string>();

                await Promise.all(data.map(async (contact) => {
                    if (contact.phoneNumbers && contact.phoneNumbers.length > 0 && contact.image?.uri) {
                        const avatarUri = contact.image.uri;
                        await Promise.all(contact.phoneNumbers.map(async (phone) => {
                            // Normalize phone number
                            const normalized = phone.number?.replace(/[\s\-\(\)]/g, '') || '';
                            if (normalized && avatarUri) {
                                const hashed = await hashPhoneNumber(normalized);
                                phoneToAvatarMap.set(hashed, avatarUri);
                            }
                        }));
                    }
                }));

                // Import contacts to backend first
                await importContactsToBackend(data);

                // Then fetch the backend contacts (which have the full data structure)
                const response = await http.get('/users/contacts');
                const backendContacts = response.data.contacts || [];

                // Format for display, matching local avatars to backend contacts
                const formattedContacts: Contact[] = backendContacts.map((contact: any) => {
                    // Backend returns hashed phone numbers
                    const hashedContactPhone = contact.contactPhone || '';
                    let localAvatar = phoneToAvatarMap.get(hashedContactPhone);

                    return {
                        id: contact.id,
                        name: contact.displayName || 'Unknown',
                        imageUri: localAvatar, // Use local device avatar
                        // Store the full backend contact for navigation
                        backendContact: contact
                    };
                });

                setContacts(formattedContacts);
            } else {
                Alert.alert('Permission Denied', 'Please grant contacts permission to view your contacts.');
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            Alert.alert('Error', 'Failed to load contacts.');
        } finally {
            setIsLoading(false);
        }
    };

    const importContactsToBackend = async (contactsData: Contacts.Contact[]) => {
        try {
            // Prepare contacts for API
            const contactsToImport = contactsData
                .filter(contact => {
                    // Filter contacts that have name and at least one phone number
                    return contact.name &&
                        contact.phoneNumbers &&
                        contact.phoneNumbers.length > 0;
                })
                .map(contact => {
                    // Get the first phone number
                    const phoneNumber = contact.phoneNumbers![0].number;

                    return {
                        phoneNumber: phoneNumber || '',
                        displayName: contact.name || 'Unknown',
                        phoneBookId: contact.id
                    };
                })
                .filter(contact => contact.phoneNumber); // Filter out contacts without phone numbers

            if (contactsToImport.length === 0) {
                console.log('No contacts with phone numbers to import');
                return;
            }

            // Call the import API
            const response = await http.post('/users/contacts/import', {
                contacts: contactsToImport
            });

            console.log('Contacts imported successfully:', response.data);
        } catch (error) {
            console.error('Error importing contacts to backend:', error);
            // Don't show error to user, as this is a background operation
        }
    };

    const filteredContacts = contacts
        .filter(contact =>
            contact.name.toLowerCase().includes(searchText.toLowerCase())
        )
        .sort((a, b) => {
            // Sort enabled contacts first, then disabled ones
            const aDisabled = !a.backendContact?.contactUser?.id && !a.backendContact?.contactUserId;
            const bDisabled = !b.backendContact?.contactUser?.id && !b.backendContact?.contactUserId;
            if (aDisabled === bDisabled) return 0;
            return aDisabled ? 1 : -1; // Enabled contacts come first
        });

    const handleContactPress = (contact: Contact) => {
        if (!contact.backendContact) {
            Alert.alert('Error', 'Contact information not available');
            return;
        }

        // Navigate to DateDetailScreen with selected contact
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        navigation.navigate('AppStack_DateDetailScreen', {
            date: todayString,
            contact: contact.backendContact
        });
    };

    const handleBookMeeting = () => {
        setShowAddMenu(false);
        setShowContactModal(true);
    };

    const handleContactSelect = (contact: any) => {
        setShowContactModal(false);
        // Navigate to DateDetailScreen with selected contact
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        navigation.navigate('AppStack_DateDetailScreen', {
            date: todayString,
            contact: contact
        });
    };

    // Load contacts for selection modal
    useEffect(() => {
        const loadContactsForSelection = async () => {
            try {
                const response = await http.get('/users/contacts');
                setContactsForSelection(response.data.contacts || []);
            } catch (error) {
                console.error('Error loading contacts:', error);
            }
        };
        if (showContactModal) {
            loadContactsForSelection();
        }
    }, [showContactModal]);

    const filteredContactsForSelection = contactsForSelection
        .filter(contact =>
            contact.displayName.toLowerCase().includes(contactSearchText.toLowerCase())
        )
        .sort((a, b) => {
            // Sort enabled contacts first, then disabled ones
            const aDisabled = !a.contactUser?.id && !a.contactUserId;
            const bDisabled = !b.contactUser?.id && !b.contactUserId;
            if (aDisabled === bDisabled) return 0;
            return aDisabled ? 1 : -1; // Enabled contacts come first
        });

    return (
        <View style={tw`flex-1 relative bg-white`}>
            <Image source={Background} style={tw`absolute w-full h-full`} />
            <View style={tw`absolute w-full h-full bg-black opacity-5`} />

            <ScrollView
                style={tw`flex-1`}
                contentContainerStyle={{ paddingBottom: verticalScale(90) }}
                showsVerticalScrollIndicator={false}
            >
                <View style={[{ marginTop: verticalScale(60) }, { paddingHorizontal: '8%' }]}>
                    {/* Header */}
                    <View style={[tw`flex-row justify-between items-center`, { marginBottom: verticalScale(22.5) }]}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            activeOpacity={0.5}
                        >
                            <Image source={BackArrow} style={{ width: horizontalScale(24), height: horizontalScale(24) }} resizeMode="contain" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            activeOpacity={0.5}
                            onPress={() => navigation.navigate('AppStack_NotificationScreen')}
                        >
                            <Image source={Notification} style={{ width: horizontalScale(48.75), height: horizontalScale(48.75) }} />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={{ marginBottom: verticalScale(22.5) }}>
                        <View style={[tw`bg-white rounded-2xl flex-row items-center shadow-sm`, { paddingHorizontal: horizontalScale(15), paddingVertical: verticalScale(11.25) }]}>
                            <TextInput
                                style={[tw`flex-1 text-black font-dm`, { fontSize: moderateScale(13.125) }]}
                                placeholder="Search your contacts"
                                placeholderTextColor="#999"
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                            <Image source={Search} style={{ width: horizontalScale(18.75), height: horizontalScale(18.75) }} />
                        </View>
                    </View>

                    {/* Contacts List */}
                    <View style={{ marginBottom: verticalScale(15) }}>
                        {isLoading ? (
                            <Text style={[tw`text-center text-grey font-dm`, { paddingVertical: verticalScale(30), fontSize: moderateScale(13.125) }]}>Loading contacts...</Text>
                        ) : filteredContacts.length > 0 ? (
                            filteredContacts.map((contact) => {
                                const isDisabled = !contact.backendContact?.contactUser?.id && !contact.backendContact?.contactUserId;
                                return (
                                    <TouchableOpacity
                                        key={contact.id}
                                        style={[
                                            tw`rounded-2xl flex-row items-center shadow-sm`,
                                            { padding: horizontalScale(15), marginBottom: verticalScale(11.25) },
                                            isDisabled ? tw`bg-gray-100` : tw`bg-white`
                                        ]}
                                        activeOpacity={isDisabled ? 1 : 0.7}
                                        onPress={() => !isDisabled && handleContactPress(contact)}
                                        disabled={isDisabled}
                                    >
                                        <View style={[tw`rounded-full bg-gray-200 items-center justify-center overflow-hidden`, { width: horizontalScale(45), height: horizontalScale(45), marginRight: horizontalScale(15) }]}>
                                            {contact.imageUri ? (
                                                <Image
                                                    source={{ uri: contact.imageUri }}
                                                    style={{ width: horizontalScale(45), height: horizontalScale(45), borderRadius: 9999 }}
                                                />
                                            ) : (
                                                <Image source={Avatar} style={{ width: horizontalScale(30), height: horizontalScale(30) }} />
                                            )}
                                        </View>
                                        <View style={tw`flex-1`}>
                                            <Text style={[tw`text-black font-bold font-dm`, { fontSize: moderateScale(13.125) }]}>
                                                {contact.name}
                                            </Text>
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
                            <Text style={[tw`text-center text-grey font-dm`, { paddingVertical: verticalScale(30), fontSize: moderateScale(13.125) }]}>
                                {searchText ? 'No contacts found' : 'No contacts available'}
                            </Text>
                        )}
                    </View>
                </View>
            </ScrollView>

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

                    {/* Popup Menu */}
                    <View style={[tw`absolute bottom-0 left-0 right-0 items-center`, { paddingBottom: verticalScale(90) }]}>
                        <View style={[tw`bg-white rounded-3xl w-5/6 overflow-hidden`, { padding: horizontalScale(15) }]}>
                            {/* Book a meeting */}
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

                            {/* Separator */}
                            <View style={[tw`bg-gray-200`, { height: verticalScale(1.125), marginHorizontal: horizontalScale(22.5) }]} />

                            {/* Create meeting type */}
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

                            {/* Separator */}
                            <View style={[tw`bg-gray-200`, { height: verticalScale(1.125), marginHorizontal: horizontalScale(22.5) }]} />

                            {/* Manage availability */}
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
                                <Image source={Search} style={[{ width: horizontalScale(18.75), height: horizontalScale(18.75), marginRight: horizontalScale(7.5) }]} />
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
                                {filteredContactsForSelection.length > 0 ? (
                                    filteredContactsForSelection.map((contact) => {
                                        const isDisabled = !contact.contactUser?.id && !contact.contactUserId;
                                        return (
                                            <TouchableOpacity
                                                key={contact.id}
                                                style={[
                                                    tw`flex-row items-center border-b border-gray-100`,
                                                    { paddingVertical: verticalScale(15) },
                                                    isDisabled ? tw`bg-gray-100` : tw`bg-white`
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
        </View>
    );
};

export default AppStack_ContactScreen;

