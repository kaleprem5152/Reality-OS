import { vi, type Mock } from "vitest";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createMockSupabaseUser } from "./mock-auth";

export interface MockAuthError {
  name: string;
  message: string;
  status?: number;
}

export interface MockCookieItem {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export interface CapturedCookieOptions {
  getAll?: () => MockCookieItem[];
  setAll?: (cookiesToSet: MockCookieItem[]) => void;
}

export interface MockSupabaseClientConfig {
  user?: SupabaseUser | null;
  error?: MockAuthError | null;
  validTokens?: Record<string, SupabaseUser>;
  invalidTokens?: string[];
  throwError?: Error | null;
}

export interface MockSupabaseClient {
  auth: {
    getUser: Mock<(jwt?: string) => Promise<{ data: { user: SupabaseUser | null }; error: MockAuthError | null }>>;
    getSession: Mock<() => Promise<{ data: { session: null }; error: null }>>;
    signOut: Mock<() => Promise<{ error: null }>>;
  };
  capturedCookieOptions: CapturedCookieOptions | null;
  getUserCalls: Array<{ token?: string }>;
  setUser: (user: SupabaseUser | null) => void;
  setError: (error: MockAuthError | null) => void;
  setThrowError: (error: Error | null) => void;
  setValidToken: (token: string, user: SupabaseUser) => void;
  setInvalidToken: (token: string) => void;
  simulateCookieRefresh: (cookiesToSet: MockCookieItem[]) => void;
  reset: () => void;
}

/**
 * Creates a reusable mock of the Supabase client focusing on auth.getUser() and SSR cookies.
 */
export function createMockSupabaseClient(
  config: MockSupabaseClientConfig = {},
): MockSupabaseClient {
  let currentUser: SupabaseUser | null = config.user !== undefined ? config.user : null;
  let currentError: MockAuthError | null = config.error !== undefined ? config.error : null;
  let currentThrowError: Error | null = config.throwError || null;
  const validTokens: Map<string, SupabaseUser> = new Map(
    config.validTokens ? Object.entries(config.validTokens) : [],
  );
  const invalidTokens: Set<string> = new Set(config.invalidTokens || []);
  const getUserCalls: Array<{ token?: string }> = [];
  let capturedCookieOptions: CapturedCookieOptions | null = null;

  const getUserMock = vi.fn(async (jwt?: string) => {
    getUserCalls.push({ token: jwt });

    if (currentThrowError) {
      throw currentThrowError;
    }

    if (jwt) {
      if (invalidTokens.has(jwt)) {
        return {
          data: { user: null },
          error: {
            name: "AuthApiError",
            message: "Invalid or expired JWT token.",
            status: 401,
          },
        };
      }

      if (validTokens.has(jwt)) {
        return {
          data: { user: validTokens.get(jwt)! },
          error: null,
        };
      }
    }

    if (currentError) {
      return {
        data: { user: null },
        error: currentError,
      };
    }

    if (currentUser) {
      return {
        data: { user: currentUser },
        error: null,
      };
    }

    return {
      data: { user: null },
      error: {
        name: "AuthSessionMissingError",
        message: "Auth session missing!",
        status: 400,
      },
    };
  });

  const getSessionMock = vi.fn(async () => ({
    data: { session: null },
    error: null,
  }));

  const signOutMock = vi.fn(async () => ({
    error: null,
  }));

  const client: MockSupabaseClient = {
    auth: {
      getUser: getUserMock,
      getSession: getSessionMock,
      signOut: signOutMock,
    },
    get capturedCookieOptions() {
      return capturedCookieOptions;
    },
    set capturedCookieOptions(val: CapturedCookieOptions | null) {
      capturedCookieOptions = val;
    },
    getUserCalls,
    setUser(user: SupabaseUser | null) {
      currentUser = user;
      currentError = null;
      currentThrowError = null;
    },
    setError(error: MockAuthError | null) {
      currentError = error;
      currentUser = null;
      currentThrowError = null;
    },
    setThrowError(error: Error | null) {
      currentThrowError = error;
    },
    setValidToken(token: string, user: SupabaseUser) {
      validTokens.set(token, user);
      invalidTokens.delete(token);
    },
    setInvalidToken(token: string) {
      invalidTokens.add(token);
      validTokens.delete(token);
    },
    simulateCookieRefresh(cookiesToSet: MockCookieItem[]) {
      if (!capturedCookieOptions?.setAll) {
        throw new Error(
          "Cannot simulate cookie refresh: setAll cookie handler has not been captured from createServerClient.",
        );
      }
      capturedCookieOptions.setAll(cookiesToSet);
    },
    reset() {
      getUserCalls.length = 0;
      getUserMock.mockClear();
      getSessionMock.mockClear();
      signOutMock.mockClear();
      validTokens.clear();
      invalidTokens.clear();
      capturedCookieOptions = null;
      currentUser = config.user !== undefined ? config.user : null;
      currentError = config.error !== undefined ? config.error : null;
      currentThrowError = config.throwError || null;
    },
  };

  return client;
}

/**
 * Creates an implementation replacement for `@supabase/ssr`'s `createServerClient`.
 * Captures cookie options passed by Next.js middleware or server components.
 */
export function createMockSsrClientFactory(mockClient: MockSupabaseClient) {
  return vi.fn(
    (
      _supabaseUrl: string,
      _supabaseAnonKey: string,
      options?: { cookies?: CapturedCookieOptions },
    ) => {
      if (options?.cookies) {
        mockClient.capturedCookieOptions = options.cookies;
      }
      return mockClient;
    },
  );
}

/**
 * Convenience helper to create a mock Supabase client with an active verified user.
 */
export function createAuthenticatedSupabaseClient(
  userOverrides: Partial<SupabaseUser> = {},
): MockSupabaseClient {
  const user = createMockSupabaseUser(userOverrides);
  return createMockSupabaseClient({ user, error: null });
}

/**
 * Convenience helper to create a mock Supabase client with no active session.
 */
export function createUnauthenticatedSupabaseClient(): MockSupabaseClient {
  return createMockSupabaseClient({
    user: null,
    error: {
      name: "AuthSessionMissingError",
      message: "Auth session missing!",
      status: 400,
    },
  });
}

/**
 * Convenience helper to create a mock Supabase client that returns an error.
 */
export function createErrorSupabaseClient(
  message = "Invalid or expired Supabase token.",
  status = 401,
): MockSupabaseClient {
  return createMockSupabaseClient({
    user: null,
    error: {
      name: "AuthApiError",
      message,
      status,
    },
  });
}
