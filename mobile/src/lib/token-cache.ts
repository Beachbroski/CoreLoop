import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

// Session tokens must live in the Keychain, never AsyncStorage (see
// docs/platform-split/05-security.md).
export const secureTokenCache: TokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key, token) {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch {
      // Keychain write failures are non-fatal — Clerk falls back to
      // re-authenticating the user next launch.
    }
  },
  async clearToken(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore — nothing to clear.
    }
  },
};
