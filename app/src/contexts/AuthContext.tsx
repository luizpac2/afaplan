import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import type { UserProfile } from "../types";

type SupabaseUser    = Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
type SupabaseSession = Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];

interface AuthContextType {
  user: SupabaseUser;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  mustChangePassword: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  profileLoading: true,
  mustChangePassword: false,
  signInWithEmail: async () => {},
  logout: async () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

const buildProfile = async (_user: NonNullable<SupabaseUser>): Promise<UserProfile | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const { data, error } = await supabase.functions.invoke("get-my-profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error || !data || data.error) return null;

    return data as UserProfile;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]                         = useState<SupabaseUser>(null);
  const [userProfile, setUserProfile]           = useState<UserProfile | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [profileLoading, setProfileLoading]     = useState(true);
  const [mustChangePassword, setMustChange]     = useState(false);

  const handleSession = async (session: SupabaseSession) => {
    if (session?.user) {
      setUser(session.user);
      setLoading(false);
      setProfileLoading(true);

      // Busca metadados frescos do servidor (não do JWT que pode estar desatualizado)
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const mustChange = freshUser?.user_metadata?.must_change_password === true;
      setMustChange(mustChange);

      const profile = await buildProfile(session.user);
      setUserProfile(profile);
      setProfileLoading(false);
    } else {
      setUser(null);
      setUserProfile(null);
      setMustChange(false);
      setLoading(false);
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      void handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { void handleSession(session); }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, profileLoading, mustChangePassword, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
