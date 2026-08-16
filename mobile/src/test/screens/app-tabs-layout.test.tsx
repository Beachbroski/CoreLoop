import { useAuth } from '@clerk/clerk-expo';

import { ApiError } from '@/lib/api-client';
import { NOT_INVITED_ERROR, useEnsureAccount } from '@/lib/queries/use-ensure-account';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import AppTabsLayout from '@/app/(app)/_layout';

/**
 * Screen tests live here rather than beside the screen. Everything under
 * `src/app/` is a route: a colocated `_layout.test.tsx` gets picked up by
 * expo-router's typegen, which then emits a route map missing the real routes
 * and fails `tsc` across ~14 unrelated files. Keep route-component tests in
 * this directory and import the screen through the `@/app/...` alias.
 *
 * This layout is the single choke point every authenticated session crosses,
 * which makes it the place the launch blocker was fixed: a creator who signed
 * up only in the app has a Clerk identity and no database row, so every tab
 * used to fail with a retry button that could never succeed.
 *
 * Each branch here is a distinct thing the creator sees, and getting the order
 * wrong is invisible in code review — `isPending` before the invite check, for
 * example, silently turns the waitlist screen into a permanent spinner. These
 * tests pin the branch order.
 *
 * `usePushNotifications` is mocked so the assertion about *when* device
 * registration fires is about this layout's gating, not the hook's internals.
 */

jest.mock('@/lib/queries/use-ensure-account', () => {
  const actual = jest.requireActual('@/lib/queries/use-ensure-account');
  return { ...actual, useEnsureAccount: jest.fn() };
});

const mockUsePushNotifications = jest.fn();
jest.mock('@/hooks/use-push-notifications', () => ({
  usePushNotifications: (enabled: boolean) => mockUsePushNotifications(enabled),
}));

const mockUseEnsureAccount = useEnsureAccount as jest.MockedFunction<typeof useEnsureAccount>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockSignOut = jest.fn();

type AccountState = Partial<ReturnType<typeof useEnsureAccount>>;

/** Only the four fields this layout branches on; the rest is React Query noise. */
function accountState(state: AccountState) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...state,
  } as ReturnType<typeof useEnsureAccount>;
}

function signedIn(isSignedIn = true, isLoaded = true) {
  mockUseAuth.mockReturnValue({
    isLoaded,
    isSignedIn,
    userId: 'clerk_test_user',
    getToken: jest.fn(() => Promise.resolve('token')),
    signOut: mockSignOut,
  } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  mockSignOut.mockReset().mockResolvedValue(undefined);
  mockUsePushNotifications.mockReset();
  signedIn();
});

describe('AppTabsLayout gating', () => {
  it('renders nothing until Clerk has loaded, rather than flashing sign-in', async () => {
    signedIn(false, false);
    mockUseEnsureAccount.mockReturnValue(accountState({ isPending: true }));

    await renderWithProviders(<AppTabsLayout />);

    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(screen.queryByText('Setting up your account…')).toBeNull();
  });

  it('redirects a signed-out session to sign-in', async () => {
    signedIn(false);
    mockUseEnsureAccount.mockReturnValue(accountState({ isPending: true }));

    await renderWithProviders(<AppTabsLayout />);

    expect(screen.getByTestId('redirect')).toBeOnTheScreen();
  });

  it('shows account setup while the row is being created', async () => {
    mockUseEnsureAccount.mockReturnValue(accountState({ isPending: true }));

    await renderWithProviders(<AppTabsLayout />);

    expect(screen.getByText('Setting up your account…')).toBeOnTheScreen();
  });

  it('shows the waitlist screen for an email that is not invited', async () => {
    mockUseEnsureAccount.mockReturnValue(
      accountState({ isError: true, error: new ApiError(NOT_INVITED_ERROR, 403) }),
    );

    await renderWithProviders(<AppTabsLayout />);

    expect(screen.getByText("You're on the list")).toBeOnTheScreen();
    // The specific failure the fix exists to prevent.
    expect(screen.queryByText("Couldn't open your account.")).toBeNull();
  });

  it('lets a waitlisted creator sign out of the dead end', async () => {
    mockUseEnsureAccount.mockReturnValue(
      accountState({ isError: true, error: new ApiError(NOT_INVITED_ERROR, 403) }),
    );
    await renderWithProviders(<AppTabsLayout />);

    await fireEvent.press(screen.getByText('Sign out'));

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('shows a retryable error for a genuine failure', async () => {
    const refetch = jest.fn();
    mockUseEnsureAccount.mockReturnValue(
      accountState({ isError: true, error: new ApiError('Internal server error', 500), refetch }),
    );

    await renderWithProviders(<AppTabsLayout />);
    expect(screen.getByText("Couldn't open your account.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it('does not mistake a non-invite 403 for the waitlist', async () => {
    mockUseEnsureAccount.mockReturnValue(
      accountState({ isError: true, error: new ApiError('Forbidden', 403) }),
    );

    await renderWithProviders(<AppTabsLayout />);

    expect(screen.getByText("Couldn't open your account.")).toBeOnTheScreen();
    expect(screen.queryByText("You're on the list")).toBeNull();
  });

  it('renders the tabs once the account resolves', async () => {
    mockUseEnsureAccount.mockReturnValue(
      accountState({ data: { id: 'user_1', email: 'creator@example.com' } as never }),
    );

    await renderWithProviders(<AppTabsLayout />);

    expect(screen.queryByText('Setting up your account…')).toBeNull();
    expect(screen.queryByText("Couldn't open your account.")).toBeNull();
    expect(screen.queryByText("You're on the list")).toBeNull();
  });
});

describe('push registration gating', () => {
  it.each([
    ['pending', accountState({ isPending: true })],
    ['not invited', accountState({ isError: true, error: new ApiError(NOT_INVITED_ERROR, 403) })],
    ['failed', accountState({ isError: true, error: new ApiError('Internal server error', 500) })],
  ])('stays disabled while the account is %s', async (_label, state) => {
    mockUseEnsureAccount.mockReturnValue(state);

    await renderWithProviders(<AppTabsLayout />);

    // POST /api/v1/devices is the first authenticated call the app makes and
    // 401s until the row exists — registering early fails silently.
    expect(mockUsePushNotifications).toHaveBeenCalledWith(false);
  });

  it('enables once the account exists', async () => {
    mockUseEnsureAccount.mockReturnValue(
      accountState({ data: { id: 'user_1', email: 'creator@example.com' } as never }),
    );

    await renderWithProviders(<AppTabsLayout />);

    expect(mockUsePushNotifications).toHaveBeenCalledWith(true);
  });
});
