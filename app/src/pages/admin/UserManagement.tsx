import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../config/supabase";
import type { UserProfile, UserRole } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCourseStore } from "../../store/useCourseStore";
import {
  Shield,
  Search,
  Users,
  UserCheck,
  GraduationCap,
  BookOpen,
  Trash2,
  Edit,
  X,
  CheckCircle2,
  PlusCircle,
  KeyRound,
  Copy,
  Check,
  Wifi,
} from "lucide-react";
import { Badge } from "../../components/common/Badge";
import type { BadgeVariant } from "../../components/common/Badge";

const ROLES: {
  value: UserRole;
  label: string;
  color: string;
  icon: React.ElementType;
}[] = [
  {
    value: "SUPER_ADMIN",
    label: "Superadministrador",
    color: "bg-purple-100 text-purple-800",
    icon: Shield,
  },
  {
    value: "ADMIN",
    label: "Administrador",
    color: "bg-red-100 text-red-800",
    icon: Shield,
  },
  {
    value: "CADETE",
    label: "Cadete",
    color: "bg-blue-100 text-blue-800",
    icon: GraduationCap,
  },
  {
    value: "DOCENTE",
    label: "Docente",
    color: "bg-green-100 text-green-800",
    icon: BookOpen,
  },
];

const getRoleVariant = (role: UserRole | undefined): BadgeVariant => {
  switch (role) {
    case "SUPER_ADMIN":
      return "purple";
    case "ADMIN":
      return "red";
    case "CADETE":
      return "blue";
    case "DOCENTE":
      return "green";
    default:
      return "slate";
  }
};

const getRoleLabel = (role: UserRole | undefined) =>
  ROLES.find((r) => r.value === role)?.label ?? role ?? "—";

const formatLastSeen = (ts: number) => {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  return `há ${Math.floor(diff / 3600)}h`;
};

export const UserManagement = () => {
  const { userProfile: currentUser } = useAuth();
  const { theme } = useTheme();
  const { disciplines, cohorts } = useCourseStore();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  // Filters
  const [selectedRole, setSelectedRole] = useState<UserRole | "ALL">("ALL");
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("");

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editSquadron, setEditSquadron] = useState("");
  const [editDisciplines, setEditDisciplines] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("DOCENTE");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Password Result Modal
  const [passwordResult, setPasswordResult] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [resetCustomPwd, setResetCustomPwd] = useState("");
  const [resetMode, setResetMode] = useState<"auto" | "custom">("auto");
  const [isResetting, setIsResetting] = useState(false);

  // Tab + Presence
  const [activeTab, setActiveTab] = useState<"users" | "online">("users");
  const [onlinePresence, setOnlinePresence] = useState<Record<string, { user_id: string; ts: number }[]>>({});
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-users");
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const sorted = (data as UserProfile[]).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "pt-BR")
      );
      setUsers(sorted);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUsers(); }, []);

  // Subscribe to presence channel only when the "online" tab is active
  useEffect(() => {
    if (activeTab !== "online") {
      if (presenceChannelRef.current) {
        void supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
        setOnlinePresence({});
      }
      return;
    }

    const channel = supabase.channel("presence:online");
    presenceChannelRef.current = channel;

    const sync = () => {
      setOnlinePresence({ ...channel.presenceState<{ user_id: string; ts: number }>() });
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.on("presence", { event: "join" }, sync);
    channel.on("presence", { event: "leave" }, sync);
    channel.subscribe(() => sync());

    return () => {
      void supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [activeTab]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      superAdmin: users.filter((u) => u.role === "SUPER_ADMIN").length,
      admin: users.filter((u) => u.role === "ADMIN").length,
      cadete: users.filter((u) => u.role === "CADETE").length,
      docente: users.filter((u) => u.role === "DOCENTE").length,
    };
  }, [users]);

  const canEditAuth = useMemo(() => {
    return ["SUPER_ADMIN", "ADMIN"].includes(currentUser?.role || "");
  }, [currentUser]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!userId) return;
    if (userId === currentUser?.uid) {
      alert("Você não pode alterar seu próprio papel.");
      return;
    }

    setUpdating(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_role", userId, role: newRole },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setUsers((prev) =>
        prev.map((u) => (u.uid === userId ? { ...u, role: newRole } : u)),
      );
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Erro ao atualizar permissão.");
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (currentUser?.role !== "SUPER_ADMIN") return;

    if (userId === currentUser?.uid) {
      alert("Você não pode excluir a si mesmo.");
      return;
    }

    const confirmMessage = `ATENÇÃO: Você está prestes a excluir o usuário "${userName}".\n\nIsso removerá todas as permissões e dados de perfil dele.\nSe ele tentar logar novamente, será tratado como um novo visitante.\n\nTem certeza?`;

    if (window.confirm(confirmMessage)) {
      setUpdating(userId);
      try {
        const { data, error } = await supabase.functions.invoke("admin-manage-user", {
          body: { action: "delete", userId },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        setUsers((prev) => prev.filter((u) => u.uid !== userId));
        alert(`Usuário ${userName} removido com sucesso.`);
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Erro ao excluir usuário: " + (error instanceof Error ? error.message : ""));
      } finally {
        setUpdating(null);
      }
    }
  };

  const filteredActiveUsers = users.filter((u) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !u.displayName.toLowerCase().includes(term) &&
        !u.email.toLowerCase().includes(term)
      ) return false;
    }
    if (selectedRole !== "ALL" && u.role !== selectedRole) return false;
    if (selectedCohort) {
      if (u.role !== "CADETE") return false;
      if (u.squadron !== selectedCohort) return false;
    }
    if (selectedDiscipline) {
      if (u.role !== "DOCENTE") return false;
      if (!(u.teachingDisciplines?.includes(selectedDiscipline) ?? false)) return false;
    }
    return true;
  });

  const onlineUserIds = useMemo(
    () => new Set(Object.values(onlinePresence).flat().map((p) => p.user_id)),
    [onlinePresence],
  );
  const onlineUsers = useMemo(
    () => users.filter((u) => onlineUserIds.has(u.uid)),
    [users, onlineUserIds],
  );
  const onlineLastSeen = useMemo(() => {
    const map: Record<string, number> = {};
    Object.values(onlinePresence).flat().forEach((p) => { map[p.user_id] = p.ts; });
    return map;
  }, [onlinePresence]);

  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.displayName || "");
    setEditSquadron(user.squadron || "");
    setEditDisciplines(user.teachingDisciplines || []);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsSavingEdit(true);
    try {
      const newSquadron = editingUser.role === "CADETE" ? editSquadron : null;
      const newDisciplines = editingUser.role === "DOCENTE" ? editDisciplines : null;

      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "update_details",
          userId: editingUser.uid,
          displayName: editName.trim() || undefined,
          turmaId: newSquadron,
          disciplines: newDisciplines,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editingUser.uid
            ? {
                ...u,
                displayName: editName.trim() || u.displayName,
                squadron: newSquadron ?? undefined,
                teachingDisciplines: newDisciplines ?? undefined,
              }
            : u,
        ),
      );

      alert("Dados atualizados com sucesso!");
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Erro ao atualizar dados: " + (error instanceof Error ? error.message : ""));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const toggleEditDiscipline = (id: string) => {
    setEditDisciplines((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newUserEmail.trim().toLowerCase(), name: newUserName.trim(), role: newUserRole },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setShowCreateModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserRole("DOCENTE");
      setPasswordResult({ name: data.name, email: data.email, password: data.password });
      await fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = (user: UserProfile) => {
    setResetTarget(user);
    setResetCustomPwd("");
    setResetMode("auto");
  };

  const confirmResetPassword = async () => {
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      const body: Record<string, string> = { userId: resetTarget.uid };
      if (resetMode === "custom") {
        if (resetCustomPwd.trim().length < 6) {
          alert("A senha deve ter ao menos 6 caracteres.");
          return;
        }
        body.password = resetCustomPwd.trim();
      }
      const { data, error } = await supabase.functions.invoke("admin-reset-password", { body });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResetTarget(null);
      setPasswordResult({ name: resetTarget.displayName, email: resetTarget.email, password: data.password });
    } catch (err) {
      alert("Erro ao redefinir senha: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setIsResetting(false);
    }
  };

  const copyPassword = () => {
    if (passwordResult) {
      void navigator.clipboard.writeText(passwordResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center animate-pulse">
        Carregando usuários...
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1
          className={`text-2xl  flex items-center gap-2 mb-2 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
        >
          <UserCheck
            className={theme === "dark" ? "text-blue-400" : "text-blue-600"}
          />
          Gestão de Usuários
        </h1>
        <p className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
          Gerencie o acesso e permissões dos usuários do sistema.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          className={`p-4 rounded-xl shadow-sm border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`p-2 rounded-lg ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}
            >
              <Users size={16} />
            </div>
            <span
              className={`text-xs  uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Total
            </span>
          </div>
          <p
            className={`text-2xl  ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
          >
            {stats.total}
          </p>
        </div>

        {ROLES.map((role) => {
          const countKey =
            role.value === "SUPER_ADMIN"
              ? "superAdmin"
              : (role.value.toLowerCase() as keyof typeof stats);
          const count = stats[countKey] || 0;
          const Icon = role.icon;
          return (
            <div
              key={role.value}
              className={`p-4 rounded-xl shadow-sm border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`p-2 rounded-lg ${role.color.split(" ")[0]} ${role.color.split(" ")[1]}`}
                >
                  <Icon size={16} />
                </div>
                <span
                  className={`text-xs  uppercase truncate ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                >
                  {role.label}
                </span>
              </div>
              <p
                className={`text-2xl  ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
              >
                {count}
              </p>
            </div>
          );
        })}

        {/* Online stat — clickable shortcut to online tab */}
        <div
          onClick={() => setActiveTab("online")}
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-colors ${
            activeTab === "online"
              ? theme === "dark"
                ? "border-green-500 bg-green-950/20"
                : "border-green-400 bg-green-50"
              : theme === "dark"
                ? "bg-slate-800 border-slate-700 hover:border-green-700"
                : "bg-white border-slate-200 hover:border-green-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-green-100 text-green-600">
              <Wifi size={16} />
            </div>
            <span
              className={`text-xs uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Online
            </span>
          </div>
          <p className={`text-2xl ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
            {activeTab === "online" ? onlineUsers.length : "—"}
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className={`flex gap-1 border-b ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 text-sm font-medium -mb-px transition-colors ${
            activeTab === "users"
              ? theme === "dark"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-blue-600 border-b-2 border-blue-600"
              : theme === "dark"
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Usuários ({stats.total})
        </button>
        <button
          onClick={() => setActiveTab("online")}
          className={`px-4 py-2 text-sm font-medium -mb-px flex items-center gap-1.5 transition-colors ${
            activeTab === "online"
              ? theme === "dark"
                ? "text-green-400 border-b-2 border-green-400"
                : "text-green-600 border-b-2 border-green-600"
              : theme === "dark"
                ? "text-slate-400 hover:text-slate-200"
                : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              activeTab === "online" && onlineUsers.length > 0
                ? "bg-green-500 animate-pulse"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
          Online Agora
        </button>
      </div>

      {/* ── Users tab ── */}
      {activeTab === "users" && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2
              className={`text-lg  ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
            >
              Usuários Ativos
            </h2>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              {canEditAuth && (
                <button
                  onClick={() => { setShowCreateModal(true); setCreateError(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm self-end"
                >
                  <PlusCircle size={16} />
                  Criar Usuário
                </button>
              )}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full placeholder-slate-400 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>
            </div>
          </div>

          {/* Smart Filters Bar */}
          <div
            className={`p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center animate-in fade-in slide-in-from-top-2 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
          >
            <div
              className={`flex items-center gap-2 text-sm  ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              <div
                className={`p-1.5 rounded ${theme === "dark" ? "bg-slate-700" : "bg-slate-100"}`}
              >
                <Search size={16} />
              </div>
              Filtros:
            </div>

            <div className="flex flex-wrap gap-3 w-full">
              <select
                value={selectedRole}
                onChange={(e) =>
                  setSelectedRole(e.target.value as UserRole | "ALL")
                }
                className={`p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${theme === "dark" ? "border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-100" : "border-slate-300 bg-slate-50 hover:bg-white text-slate-900"}`}
              >
                <option value="ALL">Todos os Perfis</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              {(selectedRole === "ALL" || selectedRole === "CADETE") && (
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className={`p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${theme === "dark" ? "border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-100" : "border-slate-300 bg-slate-50 hover:bg-white text-slate-900"}`}
                >
                  <option value="">Todas as Turmas</option>
                  {cohorts
                    .sort((a, b) => b.entryYear - a.entryYear)
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                </select>
              )}

              {(selectedRole === "ALL" || selectedRole === "DOCENTE") && (
                <select
                  value={selectedDiscipline}
                  onChange={(e) => setSelectedDiscipline(e.target.value)}
                  className={`p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-colors max-w-xs ${theme === "dark" ? "border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-100" : "border-slate-300 bg-slate-50 hover:bg-white text-slate-900"}`}
                >
                  <option value="">Todas as Disciplinas</option>
                  {[...disciplines]
                    .sort((a, b) => {
                      const nameComp = a.name.localeCompare(b.name, "pt-BR");
                      if (nameComp !== 0) return nameComp;
                      const yearA = a.year === "ALL" ? 0 : a.year || 0;
                      const yearB = b.year === "ALL" ? 0 : b.year || 0;
                      return yearA - yearB;
                    })
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                </select>
              )}

              {(selectedRole !== "ALL" ||
                selectedCohort ||
                selectedDiscipline ||
                searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedRole("ALL");
                    setSelectedCohort("");
                    setSelectedDiscipline("");
                    setSearchTerm("");
                  }}
                  className="ml-auto text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          <div
            className={`rounded-xl shadow-sm border overflow-hidden ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead
                  className={theme === "dark" ? "bg-slate-700/50" : "bg-slate-50"}
                >
                  <tr
                    className={`border-b text-xs uppercase  ${theme === "dark" ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-500"}`}
                  >
                    <th className="px-4 py-2">Usuário</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Detalhes</th>
                    <th className="px-4 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${theme === "dark" ? "divide-slate-700" : "divide-slate-100"}`}
                >
                  {filteredActiveUsers.length > 0 ? (
                    filteredActiveUsers.map((user) => (
                      <tr
                        key={user.uid}
                        className={`transition-colors ${theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
                            ) : (
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                                {user.displayName.charAt(0)}
                              </div>
                            )}
                            <span className={`text-sm ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
                              {user.displayName}
                            </span>
                          </div>
                        </td>
                        <td className={`px-4 py-2 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                          {user.email}
                        </td>
                        <td
                          className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400"
                          onClick={() => handleEditClick(user)}
                        >
                          {user.role === "CADETE" && (
                            <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                              <GraduationCap size={14} className="text-slate-400" />
                              {(user as any).squadronName || user.squadron || "-"}
                            </span>
                          )}
                          {user.role === "DOCENTE" && (
                            <div
                              className={`flex flex-col gap-1 cursor-pointer p-1 -m-1 rounded transition-colors ${theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-slate-50"}`}
                            >
                              <div
                                className={`flex items-center gap-1 mb-0.5 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                              >
                                <BookOpen size={14} />
                                <span>
                                  {user.teachingDisciplines?.length || 0}{" "}
                                  disciplina(s)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {user.teachingDisciplines?.map((id) => {
                                  const disc = disciplines.find((d) => d.id === id);
                                  return disc ? (
                                    <Badge
                                      key={id}
                                      variant="slate"
                                      title={disc.name}
                                    >
                                      {disc.code}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                          {user.role !== "CADETE" && user.role !== "DOCENTE" && (
                              <span className="text-slate-400">-</span>
                            )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 justify-end flex-nowrap">
                            <Badge variant={getRoleVariant(user.role)}>
                              {ROLES.find((r) => r.value === user.role)?.label || user.role}
                            </Badge>
                            {canEditAuth && (
                              <select
                                value={user.role}
                                onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                                disabled={updating === user.uid || user.uid === currentUser?.uid}
                                className={`text-xs border rounded px-1 py-0.5 ml-1 disabled:opacity-50 outline-none ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-300 bg-white text-slate-700"}`}
                              >
                                {ROLES.map((role) => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                              </select>
                            )}
                            {updating === user.uid && <span className="text-xs text-blue-500">...</span>}
                            {user.role !== "SUPER_ADMIN" && canEditAuth && (
                              <button onClick={() => handleEditClick(user)} disabled={updating === user.uid}
                                className={`p-1 rounded transition-colors ${theme === "dark" ? "text-slate-400 hover:text-blue-400 hover:bg-blue-900/20" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                                title="Editar Detalhes">
                                <Edit size={15} />
                              </button>
                            )}
                            {canEditAuth && user.uid !== currentUser?.uid && (
                              <button onClick={() => handleResetPassword(user)} disabled={updating === user.uid}
                                className={`p-1 rounded transition-colors ${theme === "dark" ? "text-slate-400 hover:text-amber-400 hover:bg-amber-900/20" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                                title="Redefinir Senha">
                                <KeyRound size={15} />
                              </button>
                            )}
                            {currentUser?.role === "SUPER_ADMIN" && user.uid !== currentUser.uid && (
                              <button onClick={() => handleDeleteUser(user.uid, user.displayName)} disabled={updating === user.uid}
                                className={`p-1 rounded transition-colors ${theme === "dark" ? "text-red-400 hover:bg-red-900/20" : "text-red-400 hover:bg-red-50"}`}
                                title="Excluir">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className={theme === "dark" ? "bg-slate-800" : ""}>
                      <td
                        colSpan={4}
                        className={`p-8 text-center ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                      >
                        Nenhum usuário ativo encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Online tab ── */}
      {activeTab === "online" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Usuários conectados em tempo real via Presence.
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${theme === "dark" ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"}`}>
              {onlineUsers.length} online
            </span>
          </div>

          {onlineUsers.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 rounded-xl border ${theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-400"}`}>
              <Wifi size={32} className="mb-3 opacity-40" />
              <p className="text-sm">Nenhum usuário online no momento.</p>
              <p className="text-xs mt-1 opacity-60">O canal de presença está ativo — aguardando conexões.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {onlineUsers.map((user) => {
                const ts = onlineLastSeen[user.uid];
                const isMe = user.uid === currentUser?.uid;
                return (
                  <div
                    key={user.uid}
                    className={`p-4 rounded-xl border shadow-sm flex flex-col gap-3 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-medium ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                            {user.displayName.charAt(0)}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
                          {user.displayName}
                          {isMe && <span className="ml-1 text-xs text-slate-400">(você)</span>}
                        </p>
                        <p className={`text-xs truncate ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant={getRoleVariant(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                      {ts && (
                        <span className={`text-xs ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
                          {formatLastSeen(ts)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className={`rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}>
              <h3 className={`font-semibold text-lg ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>
                Criar Novo Usuário
              </h3>
              <button onClick={() => setShowCreateModal(false)} className={`rounded-full p-1 transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200"}`}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
                  {createError}
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Nome completo</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="Nome do usuário"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>Perfil de Acesso</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                >
                  {ROLES.filter(r => r.value !== "SUPER_ADMIN").map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                Uma senha aleatória será gerada automaticamente. Você precisará repassá-la ao usuário.
              </p>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}>
              <button onClick={() => setShowCreateModal(false)} className={`px-4 py-2 text-sm rounded-lg transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}>
                Cancelar
              </button>
              <button
                onClick={() => void handleCreateUser()}
                disabled={isCreating || !newUserName.trim() || !newUserEmail.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isCreating ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Criando...</>
                ) : (
                  <><PlusCircle size={16} />Criar e Gerar Senha</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Result Modal */}
      {passwordResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className={`rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
            <div className="px-6 py-4 border-b border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/50 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-green-800 dark:text-green-300">Acesso Gerado</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className={`text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                Compartilhe as credenciais abaixo com <strong>{passwordResult.name}</strong>:
              </p>

              <div className={`rounded-lg p-4 space-y-2 border ${theme === "dark" ? "bg-slate-700/50 border-slate-600" : "bg-slate-50 border-slate-200"}`}>
                <div>
                  <span className={`text-xs font-medium uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Email</span>
                  <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}>{passwordResult.email}</p>
                </div>
                <div>
                  <span className={`text-xs font-medium uppercase ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Senha</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-lg font-mono tracking-widest ${theme === "dark" ? "text-green-400" : "text-green-700"}`}>{passwordResult.password}</p>
                    <button
                      onClick={copyPassword}
                      className={`p-1.5 rounded-lg transition-colors ${copied ? "bg-green-100 dark:bg-green-900/30 text-green-600" : theme === "dark" ? "hover:bg-slate-600 text-slate-400" : "hover:bg-slate-200 text-slate-500"}`}
                      title="Copiar senha"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-900/30">
                Anote esta senha agora. Por segurança, ela não será exibida novamente.
              </p>
            </div>

            <div className={`px-6 py-4 border-t ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}>
              <button
                onClick={() => { setPasswordResult(null); setCopied(false); }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div
            className={`rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
          >
            <div
              className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}
            >
              <h3
                className={` text-lg ${theme === "dark" ? "text-slate-100" : "text-slate-800"}`}
              >
                Editar Usuário
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className={`rounded-full p-1 transition-colors ${theme === "dark" ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200"}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"}`}
                >
                  {editName.charAt(0) || editingUser.displayName.charAt(0)}
                </div>
                <div>
                  <p className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    {editingUser.email}
                  </p>
                  <Badge variant={getRoleVariant(editingUser.role)} className="mt-1">
                    {ROLES.find((r) => r.value === editingUser.role)?.label}
                  </Badge>
                </div>
              </div>

              <div>
                <label className={`block text-sm mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                  Nome
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
                />
              </div>

              {editingUser.role === "CADETE" && (
                <div>
                  <label
                    className={`block text-sm  mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                  >
                    Esquadrão / Turma
                  </label>
                  <select
                    value={editSquadron}
                    onChange={(e) => setEditSquadron(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
                  >
                    <option value="">Selecione...</option>
                    {cohorts
                      .sort((a, b) => b.entryYear - a.entryYear)
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {editingUser.role === "DOCENTE" && (
                <div>
                  <label
                    className={`block text-sm  mb-2 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
                  >
                    Disciplinas Ministradas
                  </label>
                  <div
                    className={`max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1 custom-scrollbar ${theme === "dark" ? "border-slate-600" : "border-slate-300"}`}
                  >
                    {disciplines
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((disc) => (
                        <div
                          key={disc.id}
                          onClick={() => toggleEditDiscipline(disc.id)}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                            editDisciplines.includes(disc.id)
                              ? theme === "dark"
                                ? "bg-blue-900/20 text-blue-300"
                                : "bg-blue-50 text-blue-800"
                              : theme === "dark"
                                ? "hover:bg-slate-700"
                                : "hover:bg-slate-50"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              editDisciplines.includes(disc.id)
                                ? "bg-blue-600 border-blue-600 text-white"
                                : theme === "dark"
                                  ? "border-slate-600"
                                  : "border-slate-300"
                            }`}
                          >
                            {editDisciplines.includes(disc.id) && (
                              <CheckCircle2 size={12} />
                            )}
                          </div>
                          <span
                            className={`text-sm  ${theme === "dark" ? "text-slate-300" : "text-slate-900"}`}
                          >
                            {disc.code}
                          </span>
                          <span
                            className={`text-xs truncate ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {disc.name}
                          </span>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-right text-slate-400 mt-1">
                    {editDisciplines.length} selecionadas
                  </p>
                </div>
              )}

              {editingUser.role !== "CADETE" &&
                editingUser.role !== "DOCENTE" && (
                  <p className="text-slate-500 italic text-center py-4">
                    Não há detalhes específicos configuráveis para este perfil.
                  </p>
                )}
            </div>
            <div
              className={`px-6 py-4 border-t flex justify-end gap-3 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"}`}
            >
              <button
                onClick={() => setEditingUser(null)}
                className={`px-4 py-2 rounded-lg text-sm  transition-colors ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-200"}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm  transition-colors shadow-sm disabled:opacity-50"
              >
                {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset de Senha */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md ${theme === "dark" ? "bg-slate-800" : "bg-white"}`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}>
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-amber-500" />
                <h3 className={`text-base font-semibold ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}>
                  Redefinir Senha
                </h3>
              </div>
              <button onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className={`text-sm ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                Usuário: <span className="font-semibold">{resetTarget.displayName}</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setResetMode("auto")}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${resetMode === "auto" ? "bg-blue-600 text-white border-blue-600" : theme === "dark" ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  Gerar automaticamente
                </button>
                <button
                  onClick={() => setResetMode("custom")}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${resetMode === "custom" ? "bg-blue-600 text-white border-blue-600" : theme === "dark" ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  Definir manualmente
                </button>
              </div>
              {resetMode === "custom" && (
                <div>
                  <label className={`block text-xs font-medium mb-1 ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
                    Nova senha (mín. 6 caracteres)
                  </label>
                  <input
                    type="text"
                    value={resetCustomPwd}
                    onChange={(e) => setResetCustomPwd(e.target.value)}
                    placeholder="Digite a nova senha..."
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${theme === "dark" ? "bg-slate-700 border-slate-600 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}
                  />
                </div>
              )}
            </div>
            <div className={`px-6 py-4 border-t flex justify-end gap-3 ${theme === "dark" ? "border-slate-700" : "border-slate-100"}`}>
              <button
                onClick={() => setResetTarget(null)}
                className={`px-4 py-2 rounded-lg text-sm ${theme === "dark" ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmResetPassword()}
                disabled={isResetting || (resetMode === "custom" && resetCustomPwd.trim().length < 6)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isResetting ? "Redefinindo..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
