import React, { useState } from 'react';
import { Alert, ActivityIndicator, ScrollView } from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import tw from '~/tailwindcss';
import { AuthStackParamList } from '.';
import { Background, CalendarIcon, GymIcon, FootballIcon } from '~/lib/images';
import { http } from '~/helpers/http';
import { horizontalScale, verticalScale, moderateScale } from '~/helpers/responsive';

type Props = NativeStackScreenProps<
  AuthStackParamList,
  'AuthStack_MeetingTypesScreen'
>;

interface MeetingType {
  id: string;
  name: string;
  icon: any;
}

const meetingTypes: MeetingType[] = [
  { id: 'meet', name: 'Meet', icon: CalendarIcon },
  { id: 'gym', name: 'Gym', icon: GymIcon },
  { id: 'football', name: 'Football', icon: FootballIcon },
];

const AuthStack_MeetingTypesScreen: React.FC<Props> = ({ navigation, route }) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggleType = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      // Deselect
      setSelectedTypes(selectedTypes.filter(id => id !== typeId));
    } else {
      // Select (max 3)
      if (selectedTypes.length < 3) {
        setSelectedTypes([...selectedTypes, typeId]);
      } else {
        Alert.alert('Limit Reached', 'You can select up to 3 meeting types.');
      }
    }
  };

  const handleSave = () => {
    if (selectedTypes.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one meeting type.');
      return;
    }

    if (isSaving) return;

    setIsSaving(true);
    http.put('/users/profile', { meetingTypes: selectedTypes })
      .then(response => {
        if (response.status === 200) {
          navigation.navigate('AppStack');
        } else {
          Alert.alert('Error', 'Failed to save meeting types. Please try again.');
        }
      })
      .catch(error => {
        console.log({ error });
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  return (
    <View style={tw`flex-1 relative bg-white`}>
      <Image source={Background} style={tw`absolute w-full h-full`} />
      <View style={tw`absolute w-full h-full bg-black opacity-5`} />

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={{ paddingBottom: verticalScale(90) }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[{ marginTop: verticalScale(37.5), marginBottom: verticalScale(37.5) }, { paddingHorizontal: '8%' }]}>
          {/* Close Button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.5}
            style={{ marginBottom: verticalScale(18.75), width: horizontalScale(30), height: horizontalScale(30), alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[tw`font-bold text-black`, { fontSize: moderateScale(22.5) }]}>✕</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text style={[tw`font-bold font-dm`, { fontSize: moderateScale(26.25), lineHeight: moderateScale(33.75), marginBottom: verticalScale(11.25) }]}>
            What are you into?
          </Text>

          {/* Instructions */}
          <Text style={[tw`text-grey font-dm`, { fontSize: moderateScale(13.125), lineHeight: moderateScale(19.6875), marginBottom: verticalScale(30) }]}>
            Pick up to 3 meeting types you enjoy that you want to show on your profile.
          </Text>

          {/* Meeting Types Grid */}
          <View style={{ marginBottom: verticalScale(30) }}>
            <View style={[tw`flex-row flex-wrap`, { gap: verticalScale(15) }]}>
              {meetingTypes.map((type) => {
                const isSelected = selectedTypes.includes(type.id);
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => toggleType(type.id)}
                    activeOpacity={0.7}
                    style={[
                      tw`flex-row items-center rounded-full border-2`,
                      { paddingHorizontal: horizontalScale(15), paddingVertical: verticalScale(11.25) },
                      isSelected
                        ? tw`bg-[#A3CB31] border-[#A3CB31]`
                        : tw`bg-white border-gray-300`
                    ]}
                  >
                    <Image
                      source={type.icon}
                      style={[
                        { width: horizontalScale(22.5), height: horizontalScale(22.5), marginRight: horizontalScale(7.5) },
                        { tintColor: isSelected ? '#FFFFFF' : '#000000' }
                      ]}
                      resizeMode="contain"
                    />
                    <Text
                      style={[
                        tw`font-dm font-bold`,
                        { fontSize: moderateScale(13.125) },
                        isSelected ? tw`text-white` : tw`text-black`
                      ]}
                    >
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Selection Counter */}
          <View style={{ marginBottom: verticalScale(22.5) }}>
            <Text style={[tw`text-grey font-dm text-center`, { fontSize: moderateScale(15) }]}>
              {selectedTypes.length}/3 selected
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[tw`absolute bottom-0 w-full flex-col items-center`, { paddingBottom: verticalScale(37.5) }]}>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={isSaving || selectedTypes.length === 0}
        >
          <View
            style={[tw`bg-gray-600 rounded-full justify-center items-center shadow-lg ${isSaving || selectedTypes.length === 0 ? 'opacity-50' : ''
              }`, { height: verticalScale(56.25), width: horizontalScale(225) }]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[tw`text-white font-bold font-dm`, { fontSize: moderateScale(15) }]}>
                Save
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AuthStack_MeetingTypesScreen;

