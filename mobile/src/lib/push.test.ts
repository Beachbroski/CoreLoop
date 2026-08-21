import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiFetch } from './api-client';
import { registerForPushNotifications, unregisterForPushNotifications } from './push';

/**
 * Push registration is entirely invisible when it goes wrong: every early
 * return is a legitimate no-op (simulator, no EAS project, permission denied),
 * so a real bug looks exactly like a correct skip. These tests distinguish the
 * two by asserting on whether the network call happened.
 *
 * `push.ts` keeps the registered token in module state, which is what makes
 * `jest.resetModules()` necessary between the tests that care about it —
 * otherwise one test's token leaks into the next and unregister assertions
 * pass for the wrong reason.
 */

jest.mock('./api-client', () => ({ apiFetch: jest.fn(() => Promise.resolve(null)) }));

// Two things these factories have to get right, both of which fail silently.
//
// `__esModule: true`: without it Babel's interop copies the module into a new
// object and the copy drops `isDevice` altogether. Every "it skips" assertion
// then passes for the wrong reason, because undefined is falsy and the code
// always takes the skip branch.
//
// Inline object literals, not references to `const`s declared below: jest
// hoists these factories above the file's own declarations, so a referenced
// variable is still in its temporal dead zone when the factory runs. Anything
// that varies per test is mutated through the imported namespace instead.
jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const getToken = jest.fn(() => Promise.resolve('clerk-token'));

function setIsDevice(value: boolean) {
  (Device as { isDevice: boolean }).isDevice = value;
}

// Deliberately `unknown`: `expo.extra` is free-form JSON, so the tests need to
// be able to put a blank string or a non-string in there, not just a valid id.
function setProjectId(projectId: unknown) {
  (Constants as { expoConfig: unknown }).expoConfig = {
    extra: projectId === undefined ? {} : { eas: { projectId } },
  };
}

function grantPermission(granted: boolean, canAskAgain = false) {
  mockNotifications.getPermissionsAsync.mockResolvedValue({
    granted,
    canAskAgain,
  } as never);
}

function answerPrompt(granted: boolean, canAskAgain = false) {
  mockNotifications.requestPermissionsAsync.mockResolvedValue({
    granted,
    canAskAgain,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  setIsDevice(true);
  setProjectId('test-project-id');
  grantPermission(true);
  mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' } as never);
  mockApiFetch.mockResolvedValue(null as never);
});

describe('registerForPushNotifications', () => {
  it('registers the device token with the backend', async () => {
    const result = await registerForPushNotifications(getToken);

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/v1/devices',
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: { expoPushToken: 'ExponentPushToken[abc]', platform: 'ios' },
        token: 'clerk-token',
      }),
    );
    expect(result).toEqual({ status: 'registered', expoPushToken: 'ExponentPushToken[abc]' });
  });

  it('skips the simulator, where push tokens do not exist', async () => {
    setIsDevice(false);

    const result = await registerForPushNotifications(getToken);

    expect(mockNotifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'unsupported' });
  });

  it('skips when no EAS project is configured yet', async () => {
    setProjectId(undefined);

    const result = await registerForPushNotifications(getToken);

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'unconfigured' });
  });

  // `expo.extra` is hand-edited JSON (or written by `eas init`), so a present
  // but useless value is as likely as a missing one — and it must not reach
  // getExpoPushTokenAsync, where it fails as an opaque network-looking error.
  it.each(['   ', 42, null])('treats a projectId of %p as unconfigured', async (projectId) => {
    setProjectId(projectId);

    const result = await registerForPushNotifications(getToken);

    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'unconfigured' });
  });

  it('asks for permission when it has not been granted and can still ask', async () => {
    grantPermission(false, true);
    answerPrompt(true);

    const result = await registerForPushNotifications(getToken);

    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockApiFetch).toHaveBeenCalled();
    expect(result).toEqual({ status: 'registered', expoPushToken: 'ExponentPushToken[abc]' });
  });

  it('does not re-prompt when permission was already denied for good', async () => {
    grantPermission(false, false);

    const result = await registerForPushNotifications(getToken);

    // Re-prompting a user who said no is both useless (iOS shows nothing) and
    // the kind of thing App Review flags.
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
    // canAskAgain: false is the signal a priming UI needs — the only remaining
    // route is Settings, so re-asking in-app would be a dead end.
    expect(result).toEqual({ status: 'denied', canAskAgain: false });
  });

  it('registers nothing when the permission request is refused', async () => {
    grantPermission(false, true);
    answerPrompt(false);

    const result = await registerForPushNotifications(getToken);

    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'denied', canAskAgain: false });
  });

  it("explains a token failure instead of forwarding Expo's opaque error", async () => {
    mockNotifications.getExpoPushTokenAsync.mockRejectedValue(
      new Error('Encountered an error while fetching the token'),
    );

    // The wrapper message has to name the projectId and the credentials, because
    // that is what is actually wrong ~every time this throws.
    await expect(registerForPushNotifications(getToken)).rejects.toThrow(/test-project-id/);
    await expect(registerForPushNotifications(getToken)).rejects.toThrow(/credentials/);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe('unregisterForPushNotifications', () => {
  it('does nothing when this session never registered a token', async () => {
    // A fresh module registry, because earlier tests in this file already put
    // a token in `push.ts`'s module state.
    let fresh!: typeof import('./push');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules is synchronous, so a dynamic import() cannot be used here
      fresh = require('./push') as typeof import('./push');
    });

    await fresh.unregisterForPushNotifications(getToken);

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('deletes the token this session registered', async () => {
    await registerForPushNotifications(getToken);
    mockApiFetch.mockClear();

    await unregisterForPushNotifications(getToken);

    expect(mockApiFetch).toHaveBeenCalledWith(
      `/api/v1/devices/${encodeURIComponent('ExponentPushToken[abc]')}`,
      expect.anything(),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('clears the token even when the delete fails, so it is not re-sent', async () => {
    await registerForPushNotifications(getToken);
    mockApiFetch.mockClear().mockRejectedValue(new Error('network down'));

    // Sign-out must not reject: a failed unregister cannot be allowed to block
    // signing out, and the server prunes dead tokens on the next send anyway.
    await expect(unregisterForPushNotifications(getToken)).resolves.toBeUndefined();

    mockApiFetch.mockClear().mockResolvedValue(null as never);
    await unregisterForPushNotifications(getToken);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('does not delete twice for one registration', async () => {
    await registerForPushNotifications(getToken);
    await unregisterForPushNotifications(getToken);
    mockApiFetch.mockClear();

    await unregisterForPushNotifications(getToken);

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
