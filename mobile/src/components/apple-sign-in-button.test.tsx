import { useSignInWithApple } from '@clerk/clerk-expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';

import { AppleSignInButton } from './apple-sign-in-button';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/render';

const mockUseSignInWithApple = jest.mocked(useSignInWithApple);
// jest.setup.js exposes one shared router object and clears its spies before
// each test. Taken as the plain `router` export rather than through
// `useRouter`, which cannot be called outside a component.
const mockRouter = jest.mocked(router);
const mockIsAvailableAsync = jest.mocked(AppleAuthentication.isAvailableAsync);

/** Stands in for one outcome of Clerk's Apple flow. */
function mockFlow(result: unknown) {
  const startAppleAuthenticationFlow = jest.fn(() => Promise.resolve(result));
  mockUseSignInWithApple.mockReturnValue({
    startAppleAuthenticationFlow,
  } as unknown as ReturnType<typeof useSignInWithApple>);
  return startAppleAuthenticationFlow;
}

const setActive = jest.fn(() => Promise.resolve());

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
});

async function renderButton(onError = jest.fn()) {
  await renderWithProviders(<AppleSignInButton onError={onError} />);
  // The button only mounts once the availability probe resolves.
  await waitFor(() => expect(screen.getByTestId('apple-sign-in-button')).toBeTruthy());
  return { onError, button: screen.getByTestId('apple-sign-in-button') };
}

describe('AppleSignInButton — availability', () => {
  it('renders nothing until Apple reports the capability is available', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    mockFlow({ createdSessionId: null });

    await renderWithProviders(<AppleSignInButton onError={jest.fn()} />);

    await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('apple-sign-in-button')).toBeNull();
  });

  it('renders nothing, and shows no error, when the probe itself fails', async () => {
    mockIsAvailableAsync.mockRejectedValue(new Error('native module missing'));
    mockFlow({ createdSessionId: null });
    const onError = jest.fn();

    await renderWithProviders(<AppleSignInButton onError={onError} />);

    await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('apple-sign-in-button')).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('AppleSignInButton — successful sign-in', () => {
  it('activates the session and routes into the app', async () => {
    mockFlow({ createdSessionId: 'sess_apple_1', setActive });
    const { button } = await renderButton();

    fireEvent.press(button);

    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: 'sess_apple_1' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/discover');
  });

  it('accepts the session minted by the sign-up transfer for a first-time creator', async () => {
    // Clerk's hook reports the new user's session in the same field, so a
    // brand-new account is indistinguishable here by design — one button
    // covers sign-in and sign-up.
    mockFlow({ createdSessionId: 'sess_apple_new', setActive });
    const { button, onError } = await renderButton();

    fireEvent.press(button);

    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ session: 'sess_apple_new' }));
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('AppleSignInButton — cancellation', () => {
  it('stays silent when the sheet is dismissed', async () => {
    // Clerk swallows Apple's ERR_REQUEST_CANCELED and returns a null session.
    mockFlow({ createdSessionId: null, setActive, signIn: {}, signUp: {} });
    const { button, onError } = await renderButton();

    fireEvent.press(button);

    await waitFor(() => expect(setActive).not.toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('AppleSignInButton — failures the creator must see', () => {
  it('explains a session stuck on an unfinished Clerk task', async () => {
    mockFlow({ createdSessionId: null, setActive, signIn: { status: 'pending' }, signUp: {} });
    const { button, onError } = await renderButton();

    fireEvent.press(button);

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining('contact support')));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('reports a thrown failure without leaking the underlying error', async () => {
    mockUseSignInWithApple.mockReturnValue({
      startAppleAuthenticationFlow: jest.fn(() => Promise.reject(new Error('apple is down'))),
    } as unknown as ReturnType<typeof useSignInWithApple>);
    const { button, onError } = await renderButton();

    fireEvent.press(button);

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Unable to continue with Apple. Please try again.'));
  });

  it('routes into the app when a session already exists on this device', async () => {
    mockUseSignInWithApple.mockReturnValue({
      startAppleAuthenticationFlow: jest.fn(() =>
        Promise.reject({ errors: [{ code: 'session_exists' }] }),
      ),
    } as unknown as ReturnType<typeof useSignInWithApple>);
    const { button, onError } = await renderButton();

    fireEvent.press(button);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/discover'));
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('AppleSignInButton — concurrency', () => {
  it('ignores a second press while the first flow is still open', async () => {
    let release: (value: unknown) => void = () => {};
    const startAppleAuthenticationFlow = jest.fn(
      () => new Promise((resolve) => { release = resolve; }),
    );
    mockUseSignInWithApple.mockReturnValue({
      startAppleAuthenticationFlow,
    } as unknown as ReturnType<typeof useSignInWithApple>);
    const { button } = await renderButton();

    fireEvent.press(button);
    fireEvent.press(button);

    expect(startAppleAuthenticationFlow).toHaveBeenCalledTimes(1);
    release({ createdSessionId: null, setActive, signIn: {}, signUp: {} });
  });
});
