import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../config/supabase";
import type { UserProfile, UserRole } from "../types";

// Tipos inferidos do cliente Supabase (evita import direto de @supabase/supabase-js)
type SupabaseUser    = Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
type SupabaseSession = Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];

// Mapeia roles do Supabase → roles internos do frontend
const mapRole = (dbRole: string): UserRole => {
  switch (dbRole) {
    case "super_admin": return "SUPER_ADMIN";
    case "gestor":      return "ADMIN";
    case "docente":     return "DOCENTE";
    case "cadete":      return "CADETE";
    default:            return "VISITANTE";
  }
};

const SUPER_ADMIN_EMAILS = new Set<string>([
  "pelicano307@gmail.com",
]);

interface AuthContextType {
  user: SupabaseUser;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signInWithEmail: async () => {},
  logout: async () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

const buildProfile = async (user: NonNullable<SupabaseUser>): Promise<UserProfile | null> => {
  const email = (user.email ?? "").trim().toLowerCase();
  const meta = (user.user_metadata ?? {}) as Record<string, string>;

  // Fallback: garante super-admin mesmo se `user_roles` estiver inconsistente/indisponível
  if (SUPER_ADMIN_EMAILS.has(email)) {
    return {
      uid: user.id,
      email: user.email ?? "",
      displayName: meta.nome ?? user.email ?? "",
      role: "SUPER_ADMIN",
      createdAt: user.created_at,
      status: "APPROVED",
    };
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role, turma_id, docente_id, cadet_id, turma_aula")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  const baseRole = mapRole(data.role);

  // Se for cadete, verificar se tem mandato de chefe de turma ativo hoje
  let isChefeTurmaAtivo = false;
  if (baseRole === "CADETE" && data.cadet_id) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: chefia } = await supabase
      .from("chefes_turma")
      .select("id")
      .eq("cadet_id", data.cadet_id)
      .eq("ativo", true)
      .lte("data_inicio", today)
      .gte("data_fim", today)
      .maybeSingle();
    isChefeTurmaAtivo = !!chefia;
  }

  return {
    uid: user.id,
    email: user.email ?? "",
    displayName: meta.nome ?? user.email ?? "",
    role: isChefeTurmaAtivo ? "CHEFE_TURMA" : baseRole,
    cadetId: data.cadet_id ?? undefined,
    turmaAula: data.turma_aula ?? undefined,
    isChefeTurmaAtivo,
    createdAt: user.created_at,
    status: "APPROVED",
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]               = useState<SupabaseUser>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading]         = useState(true);

  const handleSession = async (session: SupabaseSession) => {
    if (session?.user) {
      setUser(session.user);
      const profile = await buildProfile(session.user);
      setUserProfile(profile);
    } else {
      setUser(null);
      setUserProfile(null);
    }
    setLoading(false);
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
    <AuthContext.Provider value={{ user, userProfile, loading, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
