// Ported from ui/auth/AuthViewModel.kt + data/auth/SessionManager.kt.
//
// The original app authenticates against a Laravel REST API. This standalone RN
// port keeps the same validation and session-persistence behaviour but resolves
// auth locally so the app is runnable without a backend (a demo/offline mode).
// To wire a real API, replace the bodies of `login`/`register` with fetch calls
// and store the returned token in the Session.
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'travs_session';
const USERS_KEY = 'travs_users';

export interface Session {
  name: string;
  email: string;
}

// Local, offline account registry keyed by lowercased email. Replaces the
// original Laravel API: register creates a record here, login verifies against
// it. (Passwords are stored as-is for this offline demo — wire a real API +
// hashing before shipping.)
interface StoredUser {
  name: string;
  password: string;
}
type UserStore = Record<string, StoredUser>;

async function loadUsers(): Promise<UserStore> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as UserStore) : {};
  } catch {
    return {};
  }
}

async function saveUsers(users: UserStore): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export interface AuthFormState {
  loading: boolean;
  error: string | null;
}

interface AuthContextValue {
  session: Session | null;
  ready: boolean;
  formState: AuthFormState;
  /** Local nickname onboarding used while full account auth is disabled. */
  setNickname: (nickname: string) => void;
  login: (email: string, password: string) => void;
  register: (
    username: string,
    email: string,
    password: string,
    confirm: string
  ) => void;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function validateRegister(
  username: string,
  email: string,
  password: string,
  confirm: string
): string | null {
  if (!username.trim()) return 'Enter a username.';
  if (!email.trim()) return 'Enter an email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [formState, setFormState] = useState<AuthFormState>({
    loading: false,
    error: null,
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSession(JSON.parse(raw) as Session);
      })
      .finally(() => setReady(true));
  }, []);

  const persist = (next: Session) => {
    setSession(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      formState,
      setNickname: (nickname) => {
        const name = nickname.trim().slice(0, 30);
        // Keep whatever account the session already carries — this doubles as
        // the rename path, not just first-run onboarding.
        if (name) persist({ name, email: session?.email ?? '' });
      },
      clearError: () =>
        setFormState((s) => (s.error ? { ...s, error: null } : s)),
      login: async (email, password) => {
        const key = email.trim().toLowerCase();
        if (!key || !password.trim()) {
          setFormState((s) => ({ ...s, error: 'Enter your email and password.' }));
          return;
        }
        setFormState({ loading: true, error: null });
        const users = await loadUsers();
        const user = users[key];
        if (!user || user.password !== password) {
          setFormState({ loading: false, error: 'Invalid email or password.' });
          return;
        }
        setFormState({ loading: false, error: null });
        persist({ name: user.name, email: key });
      },
      register: async (username, email, password, confirm) => {
        const validation = validateRegister(username, email, password, confirm);
        if (validation) {
          setFormState((s) => ({ ...s, error: validation }));
          return;
        }
        const key = email.trim().toLowerCase();
        setFormState({ loading: true, error: null });
        const users = await loadUsers();
        if (users[key]) {
          setFormState({
            loading: false,
            error: 'An account with this email already exists.',
          });
          return;
        }
        const name = username.trim();
        users[key] = { name, password };
        await saveUsers(users);
        setFormState({ loading: false, error: null });
        persist({ name, email: key });
      },
      logout: () => {
        setSession(null);
        setFormState({ loading: false, error: null });
        AsyncStorage.removeItem(STORAGE_KEY);
      },
    }),
    [session, ready, formState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
