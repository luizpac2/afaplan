import { useState, useEffect, useMemo } from "react";
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

    // Prevent editing own role
    if (userId === currentUser?.uid) {
      alert("Você não pode alterar seu próprio papel.");
      return;
    }

    setUpdating(userId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole.toLowerCase() })
        .eq("user_id", userId);
      if (error) throw error;
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
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
        setUsers((prev) => prev.filter((u) => u.uid !== userId));
        alert(`Usuário ${userName} removido com sucesso.`);
      } catch (error) {
        console.error("Error deleting user:", error);
        alert("Erro ao excluir usuário.");
      } finally {
        setUpdating(null);
      }
    }
  };

  const pendingUsers = useMemo(
    () => users.filter((u) => u.status === "PENDING"),
    [users],
  );
  const activeUsers = useMemo(
    () => users.filter((u) => u.status !== "PENDING"),
    [users],
  );

  const filteredActiveUsers = activeUsers.filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRole === "ALL" || u.role === selectedRole;

    let matchesCohort = true;
    if (selectedCohort) {
      matchesCohort = u.role === "CADETE" && u.squadron === selectedCohort;
    }

    let matchesDiscipline = true;
    if (selectedDiscipline) {
      matchesDiscipline =
        u.role === "DOCENTE" &&
        (u.teachingDisciplines?.includes(selectedDiscipline) ?? false);
    }

    return matchesSearch && matchesRole && matchesCohort && matchesDiscipline;
  });

  const handleApproveUser = async (user: UserProfile) => {
    if (!user.requestedRole) return;
    setUpdating(user.uid);
    try {
      await supabase
        .from("user_roles")
        .update({ role: user.requestedRole.toLowerCase() })
        .eq("user_id", user.uid);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? { ...u, role: user.requestedRole!, status: "APPROVED" }
            : u,
        ),
      );
      alert(`Usuário ${user.displayName} aprovado como ${user.requestedRole}!`);
    } catch (error) {
      console.error("Error approving user:", error);
      alert("Erro ao aprovar usuário.");
    } finally {
      setUpdating(null);
    }
  };

  const handleRejectUser = async (user: UserProfile) => {
    if (
      !window.confirm(
        `Tem certeza que deseja REJEITAR e EXCLUIR a solicitação de ${user.displayName}?`,
      )
    )
      return;

    setUpdating(user.uid);
    try {
      await supabase.from("user_roles").delete().eq("user_id", user.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      alert(`Solicitação de ${user.displayName} rejeitada.`);
    } catch (error) {
      console.error("Error rejecting user:", error);
      alert("Erro ao rejeitar usuário.");
    } finally {
      setUpdating(null);
    }
  };

  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    setEditSquadron(user.squadron || "");
    setEditDisciplines(user.teachingDisciplines || []);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsSavingEdit(true);
    try {
      const newSquadron = editingUser.role === "CADETE" ? editSquadron : null;
      const newDisciplines = editingUser.role === "DOCENTE" ? editDisciplines : null;

      await supabase
        .from("user_roles")
        .update({ turma_id: newSquadron })
        .eq("user_id", editingUser.uid);

      if (newDisciplines !== null) {
        await supabase
          .from("docente_disciplinas")
          .delete()
          .eq("docente_id", editingUser.uid);
        if (newDisciplines.length > 0) {
          await supabase.from("docente_disciplinas").insert(
            newDisciplines.map((d) => ({
              docente_id: editingUser.uid,
              disciplina_id: d,
            })),
          );
        }
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editingUser.uid
            ? {
                ...u,
                squadron: newSquadron !== null ? newSquadron : undefined,
                teachingDisciplines:
                  newDisciplines !== null ? newDisciplines : undefined,
              }
            : u,
        ),
      );

      alert("Dados atualizados com sucesso!");
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Erro ao atualizar dados.");
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

  const handleResetPassword = async (user: UserProfile) => {
    if (!window.confirm(`Redefinir a senha de ${user.displayName}?\nUma nova senha aleatória será gerada.`)) return;
    setUpdating(user.uid);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { userId: user.uid },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPasswordResult({ name: user.displayName, email: user.email, password: data.password });
    } catch (err) {
      alert("Erro ao redefinir senha: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setUpdating(null);
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
      </div>

      {/* PENDING REQUESTS SECTION */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-100/50 dark:bg-amber-900/50 px-6 py-4 border-b border-amber-200 dark:border-amber-800 flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400 rounded-lg">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg  text-amber-900 dark:text-amber-300">
                Solicitações Pendentes ({pendingUsers.length})
              </h2>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Novos usuários aguardando aprovação para acessar o sistema.
              </p>
            </div>
          </div>

          <div className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingUsers.map((user) => (
              <div
                key={user.uid}
                className={`p-5 rounded-xl border shadow-sm flex flex-col gap-4 ${theme === "dark" ? "bg-slate-800 border-amber-900/50" : "bg-white border-amber-200"}`}
              >
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center  text-sm ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}
                    >
                      {user.displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p
                      className={` ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                    >
                      {user.displayName}
                    </p>
                    <p
                      className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {user.email}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Criado em: {new Date(user.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-lg text-sm space-y-2 border ${theme === "dark" ? "bg-slate-700/50 border-slate-700" : "bg-slate-50 border-slate-100"}`}
                >
                  <p>
                    <span
                      className={` ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                    >
                      Perfil Solicitado:
                    </span>{" "}
                    <span
                      className={` ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
                    >
                      {ROLES.find((r) => r.value === user.requestedRole)
                        ?.label || user.requestedRole}
                    </span>
                  </p>

                  {user.squadron && (
                    <p>
                      <span
                        className={` ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                      >
                        Esquadrão:
                      </span>{" "}
                      <span
                        className={`${theme === "dark" ? "text-slate-300" : ""}`}
                      >
                        {user.squadron}
                      </span>
                    </p>
                  )}

                  {user.teachingDisciplines &&
                    user.teachingDisciplines.length > 0 && (
                      <div>
                        <p
                          className={` mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                        >
                          Disciplinas ({user.teachingDisciplines.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {user.teachingDisciplines.slice(0, 3).map((d) => (
                            <Badge key={d} variant="slate">
                              {d}
                            </Badge>
                          ))}
                          {user.teachingDisciplines.length > 3 && (
                            <span className="text-xs text-slate-400">
                              +{user.teachingDisciplines.length - 3} mais
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  {user.comments && (
                    <div className="mt-2">
                      <p
                        className={` mb-1 ${theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                      >
                        Mensagem:
                      </p>
                      <p
                        className={`text-sm italic p-2 rounded border ${theme === "dark" ? "text-slate-300 bg-amber-900/20 border-amber-900/30" : "text-slate-600 bg-amber-50/50 border-amber-100"}`}
                      >
                        "{user.comments}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-auto pt-2">
                  <button
                    onClick={() => handleRejectUser(user)}
                    disabled={updating === user.uid}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm  transition-colors border border-transparent ${theme === "dark" ? "text-red-400 bg-red-900/20 hover:bg-red-900/30 hover:border-red-900/50" : "text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-200"}`}
                  >
                    Rejeitar
                  </button>
                  <button
                    onClick={() => handleApproveUser(user)}
                    disabled={updating === user.uid}
                    className={`flex-1 px-3 py-2 text-white rounded-lg text-sm  transition-colors shadow-sm hover:shadow ${theme === "dark" ? "bg-green-700 hover:bg-green-600" : "bg-green-600 hover:bg-green-700"}`}
                  >
                    Aprovar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {/* Role Filter */}
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

          {/* Show Cohort Filter only if relevant */}
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
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}

          {/* Show Discipline Filter only if relevant */}
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
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Perfil Atual</th>
                <th className="px-6 py-4">Detalhes</th>
                <th className="px-6 py-4">Ações</th>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center  text-xs ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}
                          >
                            {user.displayName.charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span
                            className={` ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                          >
                            {user.displayName}
                          </span>
                          <span className="text-xs text-slate-400">
                            {user.status === "PENDING" ? "(Pendente)" : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                    >
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getRoleVariant(user.role)}>
                        {ROLES.find((r) => r.value === user.role)?.label ||
                          user.role}
                      </Badge>
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400"
                      onClick={() => handleEditClick(user)}
                    >
                      {user.role === "CADETE" && (
                        <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                          <GraduationCap size={14} className="text-slate-400" />
                          {user.squadron || "-"}
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
                    <td className="px-4 py-4 text-right">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.uid, e.target.value as UserRole)
                        }
                        disabled={
                          updating === user.uid ||
                          user.uid === currentUser?.uid ||
                          !canEditAuth
                        }
                        className={`text-sm border rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 ${theme === "dark" ? "border-slate-600 bg-slate-700 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
                      >
                        {ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      {updating === user.uid && (
                        <span className="ml-2 text-xs text-blue-600">
                          Salvando...
                        </span>
                      )}

                      {currentUser?.role === "SUPER_ADMIN" &&
                        user.uid !== currentUser.uid && (
                          <button
                            onClick={() =>
                              handleDeleteUser(user.uid, user.displayName)
                            }
                            className={`ml-4 p-1 rounded-full transition-colors ${theme === "dark" ? "text-red-400 hover:text-red-400 hover:bg-red-900/20" : "text-red-400 hover:text-red-700 hover:bg-red-50"}`}
                            title="Excluir Usuário/Acesso"
                            disabled={updating === user.uid}
                          >
                            <Trash2 size={18} />
                          </button>
                        )}

                      {user.role !== "SUPER_ADMIN" && canEditAuth && (
                        <button
                          onClick={() => handleEditClick(user)}
                          className={`ml-2 p-1 rounded-full transition-colors ${theme === "dark" ? "text-slate-400 hover:text-blue-400 hover:bg-blue-900/20" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                          title="Editar Detalhes"
                          disabled={updating === user.uid}
                        >
                          <Edit size={18} />
                        </button>
                      )}

                      {canEditAuth && user.uid !== currentUser?.uid && (
                        <button
                          onClick={() => void handleResetPassword(user)}
                          className={`ml-2 p-1 rounded-full transition-colors ${theme === "dark" ? "text-slate-400 hover:text-amber-400 hover:bg-amber-900/20" : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"}`}
                          title="Redefinir Senha"
                          disabled={updating === user.uid}
                        >
                          <KeyRound size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className={theme === "dark" ? "bg-slate-800" : ""}>
                  <td
                    colSpan={5}
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
              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center  text-lg ${theme === "dark" ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"}`}
                >
                  {editingUser.displayName.charAt(0)}
                </div>
                <div>
                  <p
                    className={` ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`}
                  >
                    {editingUser.displayName}
                  </p>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {editingUser.email}
                  </p>
                  <Badge
                    variant={getRoleVariant(editingUser.role)}
                    className="mt-1"
                  >
                    {ROLES.find((r) => r.value === editingUser.role)?.label}
                  </Badge>
                </div>
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
                    {cohorts && cohorts.length > 0 ? (
                      cohorts
                        .sort((a, b) => b.entryYear - a.entryYear)
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))
                    ) : (
                      <>
                        <option value="1º Esquadrão">1º Esquadrão</option>
                        <option value="2º Esquadrão">2º Esquadrão</option>
                        <option value="3º Esquadrão">3º Esquadrão</option>
                        <option value="4º Esquadrão">4º Esquadrão</option>
                      </>
                    )}
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
    </div>
  );
};
