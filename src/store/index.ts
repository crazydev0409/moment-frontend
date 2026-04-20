import { atom } from "jotai";

export const userAtom = atom({
  id: '',
  name: '',
  email: '',
  phoneNumber: '',
  avatar: '',
  timezone: 'UTC',
  birthday: '',
  bio: '',
  meetingTypes: [] as string[],
  verified: false
});
