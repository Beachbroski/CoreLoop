import { useAuth } from '@clerk/clerk-expo';
import { Stack, Tabs } from 'expo-router';
import type { ReactElement } from 'react';

import { ApiError } from '@/lib/api-client';
import { NOT_INVITED_ERROR, useEnsureAccount } from '@/lib/queries/use-ensure-account';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import AppTabsLayout from '@/app/(app)/_layout';
import ActivityStackLayout from '@/app/(app)/activity/_layout';
import DiscoverStackLayout from '@/app/(app)/discover/_layout';

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

/* ------------------------------------------------ navigator registrations -- */

type SymbolName = { ios: string; android: string; web: string };
type IconProps = { name: SymbolName; filledName: SymbolName };
type ScreenOptions = {
  href?: null;
  popToTopOnBlur?: boolean;
  presentation?: string;
  tabBarIcon?: (props: { color: string; focused: boolean; size: number }) => ReactElement<IconProps>;
};
type Registration = { name?: string; options?: ScreenOptions };

const tabRegistrations: Registration[] = [];
const stackRegistrations: Registration[] = [];

/**
 * A layout file's entire contract is *which* routes it registers and with what
 * options — and none of that reaches the rendered tree. `Tabs.Screen` and
 * `Stack.Screen` are mocked as components that render nothing (jest.setup.js),
 * and RNTL 14 removed `UNSAFE_getAllByType`, which was the old way to reach a
 * composite that renders null. Swapping in recording components is what is
 * left. They are assigned once, at module scope, so every render in this file
 * reports through them; the arrays are cleared per test.
 */
function RecordedTabScreen(props: Registration): null {
  tabRegistrations.push(props);
  return null;
}

function RecordedStackScreen(props: Registration): null {
  stackRegistrations.push(props);
  return null;
}

(Tabs as unknown as { Screen: typeof RecordedTabScreen }).Screen = RecordedTabScreen;
(Stack as unknown as { Screen: typeof RecordedStackScreen }).Screen = RecordedStackScreen;

/** Registrations by route name. A re-render can record the same name twice. */
function registration(list: Registration[], name: string): Registration | undefined {
  return list.find((entry) => entry.name === name);
}

function registeredNames(list: Registration[]): string[] {
  return Array.from(new Set(list.map((entry) => entry.name ?? '')));
}

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
  tabRegistrations.length = 0;
  stackRegistrations.length = 0;
  signedIn();
});

/** The only account state that gets as far as rendering a navigator. */
function accountResolved() {
  mockUseEnsureAccount.mockReturnValue(
    accountState({ data: { id: 'user_1', email: 'creator@example.com' } as never }),
  );
}

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

  it('gives the waitlist sign-out a real 44pt target', async () => {
    mockUseEnsureAccount.mockReturnValue(
      accountState({ isError: true, error: new ApiError(NOT_INVITED_ERROR, 403) }),
    );
    await renderWithProviders(<AppTabsLayout />);

    // It is the only control on a dead-end screen. It was a Text centering
    // itself with `textAlignVertical`, which is Android-only — on iOS the label
    // sat at the top of its box, so the bottom of the target hit nothing.
    const button = screen.getByLabelText('Sign out');
    expect(button).toBeOnTheScreen();

    await fireEvent.press(button);
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

/**
 * The tab bar is a four-item control, and the five drill-in screens used to be
 * registered here too, as tabs hidden with `href: null`. Hidden or not, a tab
 * is a tab: `router.push('/discover/<id>')` was a lateral switch, so a campaign
 * opened with no card transition and no swipe-back. They live in nested stacks
 * now (`discover/_layout.tsx`, `activity/_layout.tsx`), and the thing worth
 * pinning is that they never come back here — a stray `Tabs.Screen` for a
 * detail route silently reintroduces the whole bug.
 */
describe('tab registration', () => {
  const DRILL_IN_ROUTES = [
    'discover/[id]/index',
    'discover/[id]/apply',
    'activity/applications/[id]',
    'activity/submissions/[id]',
    'activity/submissions/new',
  ];

  it('registers the four tabs and nothing else', async () => {
    accountResolved();

    await renderWithProviders(<AppTabsLayout />);

    expect(registeredNames(tabRegistrations)).toEqual([
      'discover',
      'activity',
      'earnings/index',
      'profile/index',
    ]);
  });

  it('registers no drill-in route as a hidden tab', async () => {
    accountResolved();

    await renderWithProviders(<AppTabsLayout />);

    for (const route of DRILL_IN_ROUTES) {
      expect(registration(tabRegistrations, route)).toBeUndefined();
    }
    // `href: null` is the only way a tab hides itself, so its absence is the
    // general form of the assertion above.
    expect(tabRegistrations.some((entry) => entry.options?.href === null)).toBe(false);
  });

  it('resets a stack-owning tab when it loses focus', async () => {
    accountResolved();

    await renderWithProviders(<AppTabsLayout />);

    // Switching tabs does not unwind the stack that presented a modal, so
    // without this a submitted application's modal stays up over the next tab.
    expect(registration(tabRegistrations, 'discover')?.options?.popToTopOnBlur).toBe(true);
    expect(registration(tabRegistrations, 'activity')?.options?.popToTopOnBlur).toBe(true);
    // The two leaf tabs have no stack to pop.
    expect(registration(tabRegistrations, 'earnings/index')?.options?.popToTopOnBlur).toBeUndefined();
    expect(registration(tabRegistrations, 'profile/index')?.options?.popToTopOnBlur).toBeUndefined();
  });

  it('pairs every tab icon with the filled variant of the same symbol', async () => {
    accountResolved();

    await renderWithProviders(<AppTabsLayout />);

    // Activity shipped `list.bullet` unselected against `list.bullet.circle.fill`
    // selected — two different glyphs, so the icon changed shape on selection
    // rather than filling in. Stated as an invariant so the next pair cannot
    // drift the same way.
    for (const entry of tabRegistrations) {
      const icon = entry.options?.tabBarIcon?.({ color: '#ffffff', focused: true, size: 24 });
      expect(icon).toBeDefined();
      expect(icon?.props.filledName.ios).toBe(`${icon?.props.name.ios}.fill`);
    }
  });
});

describe('nested stacks', () => {
  it('gives Discover a stack with the campaign detail and the apply flow', async () => {
    await renderWithProviders(<DiscoverStackLayout />);

    expect(registeredNames(stackRegistrations)).toEqual(['index', '[id]/index', '[id]/apply']);
  });

  it('gives Activity a stack with both detail routes and the new-submission flow', async () => {
    await renderWithProviders(<ActivityStackLayout />);

    expect(registeredNames(stackRegistrations)).toEqual([
      'index',
      'applications/[id]',
      'submissions/[id]',
      'submissions/new',
    ]);
  });

  it.each([
    ['discover', DiscoverStackLayout, '[id]/apply', ['index', '[id]/index']],
    ['activity', ActivityStackLayout, 'submissions/new', ['index', 'applications/[id]', 'submissions/[id]']],
  ])('presents only the %s create flow modally', async (_tab, Layout, modalRoute, pushRoutes) => {
    await renderWithProviders(<Layout />);

    // A create flow behind a card can be abandoned by a stray tab tap with the
    // half-written form left on a stack nobody returns to. A modal has to be
    // finished or cancelled.
    expect(registration(stackRegistrations, modalRoute)?.options?.presentation).toBe('modal');

    for (const route of pushRoutes) {
      expect(registration(stackRegistrations, route)?.options?.presentation).toBeUndefined();
    }
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
