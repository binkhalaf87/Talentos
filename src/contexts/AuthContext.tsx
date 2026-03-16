import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  signUp:         async () => ({ error: null }),
  signIn:         async () => ({ error: null }),
  signOut:        async () => {},
  resetPassword:  async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);
  const [initialized, setInitialized] = useState(false);

  const mountedRef  = useRef(true);
  const readyRef    = useRef(false); // flipped once when loading → false

  const applySession = useCallback((s: Session | null) => {
    if (!mountedRef.current) return;
    setSession(s);
    setUser(s?.user ?? null);
  }, []);

  const markReady = useCallback((s: Session | null) => {
    if (!mountedRef.current) return;
    applySession(s);
    if (!readyRef.current) {
      readyRef.current = true;
      setLoading(false);
      setInitialized(true);
    }
  }, [applySession]);

  useEffect(() => {
    mountedRef.current = true;
    readyRef.current   = false;

    // Subscribe first — Supabase fires INITIAL_SESSION synchronously on subscribe
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mountedRef.current) return;

      if (event === "INITIAL_SESSION") {
        // This is the authoritative first-load session value
        markReady(newSession ?? null);
        return;
      }

      // For all subsequent events: just sync state
      applySession(newSession ?? null);
    });

    // Safety net: if INITIAL_SESSION never fires (shouldn't happen but just in case)
    const timer = window.setTimeout(() => {
      if (!readyRef.current) {
        supabase.auth.getSession()
          .then(({ data }) => markReady(data.session ?? null))
          .catch(() => markReady(null));
      }
    }, 3000);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [applySession, markReady]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch { /* clear local state regardless */ } finally {
      if (mountedRef.current) {
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, initialized, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
