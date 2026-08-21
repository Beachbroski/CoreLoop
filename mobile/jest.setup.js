/**
 * Render-test environment for the Expo app.
 *
 * The pure-logic suites (`src/lib/*.test.ts`) need none of this — they import
 * plain functions. Everything here exists so a component can actually be
 * rendered under Node, which means standing in for the native modules that have
 * no JS implementation off-device.
 *
 * Rule of thumb for what belongs here: a mock goes in this file when it is
 * *infrastructure* (a native module that cannot run in Node), and in the test
 * file when it is *data* (what the API returned, whether the user is signed in).
 * Otherwise tests start depending on invisible global state.
 */

/* -------------------------------------------------- native UI primitives -- */

// Reanimated ships its own mock: real component tree, animations resolved
// synchronously to their final value. Worklets cannot run in Node at all.
//
// The shipped mock omits `useReducedMotion`, which `Skeleton` calls — reaching
// it throws "useReducedMotion is not a function" from inside a render, so the
// loading state of every screen is untestable without this addition. Reporting
// `false` keeps animations "on", which is the path worth exercising.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

// Haptics are fire-and-forget native calls. Left unmocked they reject and
// surface as unhandled rejections that fail unrelated assertions.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// SF Symbols are iOS-native. Render a View that keeps its accessibility props,
// so tests can still assert that decorative icons stay hidden from VoiceOver.
jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: (props) => <View testID="symbol-view" {...props} /> };
});

jest.mock('expo-image', () => {
  const { Image } = require('react-native');
  return { Image: (props) => <Image {...props} /> };
});

/* ----------------------------------------------------------- navigation -- */

// Must be `mock`-prefixed: jest hoists `jest.mock` factories above the file's
// own declarations and only allows out-of-scope names matching /^mock/i.
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
};

jest.mock('expo-router', () => {
  const { View, Text } = require('react-native');
  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '/',
    useFocusEffect: jest.fn(),
    // Screens attach this to their list ref so re-tapping an active tab
    // scrolls to top. Without it in this factory every screen that imports
    // it throws `useScrollToTop is not a function` on render.
    useScrollToTop: jest.fn(),
    Link: ({ children, ...props }) => <Text {...props}>{children}</Text>,
    Redirect: ({ href }) => <View testID="redirect" accessibilityValue={{ text: String(href) }} />,
    Stack: Object.assign(({ children }) => <View>{children}</View>, {
      Screen: () => null,
    }),
    Tabs: Object.assign(({ children }) => <View>{children}</View>, {
      Screen: () => null,
    }),
  };
});

/** Exposed so tests can assert on navigation without re-mocking expo-router. */
global.mockRouter = mockRouter;

/* ----------------------------------------------------------------- auth -- */

// Signed in with a working token by default. Individual tests override this
// (see `mockClerk` in src/test/render.tsx) for signed-out and error paths.
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: jest.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'clerk_test_user',
    getToken: jest.fn(() => Promise.resolve('test-token')),
    signOut: jest.fn(() => Promise.resolve()),
  })),
  useUser: jest.fn(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'clerk_test_user' } })),
  useSSO: jest.fn(() => ({ startSSOFlow: jest.fn() })),
  useSignIn: jest.fn(() => ({ isLoaded: true, signIn: {}, setActive: jest.fn() })),
  useSignUp: jest.fn(() => ({ isLoaded: true, signUp: {}, setActive: jest.fn() })),
  ClerkProvider: ({ children }) => children,
  ClerkLoaded: ({ children }) => children,
}));

/* -------------------------------------------------------------- safe area -- */

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const inset = { top: 47, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => <View>{children}</View>,
    SafeAreaView: ({ children, ...props }) => <View {...props}>{children}</View>,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 402, height: 874 }),
  };
});

/* ------------------------------------------------------------------ misc -- */

beforeEach(() => {
  Object.values(mockRouter).forEach(fn => fn.mockClear?.());
});
