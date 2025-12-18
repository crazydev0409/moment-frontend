import { atom } from "jotai";

export const userAtom = atom({
  id: '',
  name: '',
  email: '',
  phoneNumber: '',
  birthday: '',
  bio: '',
  meetingTypes: [] as string[],
  verified: false
});
