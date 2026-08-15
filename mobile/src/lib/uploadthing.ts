import { generateReactNativeHelpers } from '@uploadthing/expo';

// Points the Expo UploadThing client at our bearer-authed mobile upload route
// (app/api/v1/uploads). The per-request Clerk token is injected via the
// `headers` option where these helpers are used (see ContentUploadField).
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not set');

export const { useImageUploader } = generateReactNativeHelpers({
  url: `${apiUrl}/api/v1/uploads`,
});
