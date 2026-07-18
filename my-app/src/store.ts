import { create } from 'zustand';

import { Platform } from 'react-native';

import Constants from 'expo-constants';

// Dynamically get the IP address of the Expo bundler machine
const hostUri = Constants?.expoConfig?.hostUri;
const ip = hostUri ? hostUri.split(':')[0] : '192.168.1.21';

export const API_BASE_URL = `http://${ip}:3000`;

interface GlobalState {
  userEmail: string;
  userName: string;
  userMobile: string;
  authToken: string | null;
  isFaceVerified: boolean;
  setUserEmail: (email: string) => void;
  setUserName: (name: string) => void;
  setUserMobile: (mobile: string) => void;
  setAuthToken: (token: string | null) => void;
  setFaceVerified: (status: boolean) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  userEmail: '',
  userName: 'Employee',
  userMobile: '',
  authToken: null,
  isFaceVerified: false,
  setUserEmail: (email) => set({ userEmail: email }),
  setUserName: (name) => set({ userName: name }),
  setUserMobile: (mobile) => set({ userMobile: mobile }),
  setAuthToken: (token) => set({ authToken: token }),
  setFaceVerified: (status) => set({ isFaceVerified: status }),
}));

// Legacy wrapper to maintain compatibility while refactoring
export const GlobalStore = {
  get userEmail() { return useGlobalStore.getState().userEmail; },
  get userName() { return useGlobalStore.getState().userName; },
  get userMobile() { return useGlobalStore.getState().userMobile; },
  get authToken() { return useGlobalStore.getState().authToken; },
  get isFaceVerified() { return useGlobalStore.getState().isFaceVerified; },
  setUserEmail: (email: string) => useGlobalStore.getState().setUserEmail(email),
  setUserName: (name: string) => useGlobalStore.getState().setUserName(name),
  setUserMobile: (mobile: string) => useGlobalStore.getState().setUserMobile(mobile),
  setAuthToken: (token: string | null) => useGlobalStore.getState().setAuthToken(token),
  setFaceVerified: (status: boolean) => useGlobalStore.getState().setFaceVerified(status),
};
