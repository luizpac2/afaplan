import { useState, useRef, useEffect } from "react";
import { Bell, Check, Clock, Info, AlertTriangle, Users } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../config/supabase";
import { useNavigate } from "react-router-dom";
import packageJson from "../../../package.json";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "action";
  time: string;
  read: boolean;
  onClick?: () => void;
}

export const NotificationsPopover = () => {
  const { theme } = useTheme();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [systemVersionNotif, setSystemVersionNotif] =
    useState<AppNotification | null>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdmin =
    userProfile?.role === "SUPER_ADMIN" || userProfile?.role === "ADMIN";

  // Leitura única de usuários pendentes (getDocs — sem listener em tempo real)
  useEffect(() => {
    if (!isAdmin) {
      setPendingUsersCount(0);
      return;
    }

    const fetchPending = async () => {
      const { count, error } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "visitante");
      if (!error) setPendingUsersCount(count ?? 0);
    };

    void fetchPending();
    // Realtime não habilitado — sem subscription WebSocket
    return () => {};
  }, [isAdmin]);

  // System Version Check (para TODOS os usuários autenticados)
  useEffect(() => {
    if (!userProfile) return;
    const currentVersion = packageJson.version;
    const ackVersion = localStorage.getItem("afa_planner_version_ack");

    if (ackVersion !== currentVersion) {
      setSystemVersionNotif({
        id: "sys_version_update",
        title: "Nova Versão Disponível",
        message: `O AFA Planner foi atualizado para a versão ${currentVersion}.`,
        type: "info",
        time: "Nova Atualização",
        read: false,
      });
    } else {
      setSystemVersionNotif(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid, userProfile?.role]);

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (id === "sys_version_update") {
      localStorage.setItem("afa_planner_version_ack", packageJson.version);
      setSystemVersionNotif(null);
    }
  };

  const handleMarkAllAsRead = () => {
    if (systemVersionNotif) {
      handleMarkAsRead("sys_version_update");
    }
  };

  const notifications: AppNotification[] = [];

  if (pendingUsersCount > 0) {
    notifications.push({
      id: "pending_users",
      title: "Solicitações de Acesso",
      message: `Há ${pendingUsersCount} usuário(s) aguardando aprovação.`,
      type: "warning",
      time: "Ação Necessária",
      read: false,
      onClick: () => {
        setIsOpen(false);
        navigate("/users");
      },
    });
  }

  if (systemVersionNotif) {
    notifications.push(systemVersionNotif);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <Check size={14} className="text-white" />;
      case "warning":
        return <AlertTriangle size={14} className="text-white" />;
      case "action":
        return <Users size={14} className="text-white" />;
      default:
        return <Info size={14} className="text-white" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-500";
      case "warning":
        return "bg-amber-500";
      case "action":
        return "bg-purple-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-full transition-colors relative ${theme === "dark" ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
        title="Notificações"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className={`absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full ring-2 animate-pulse ${theme === "dark" ? "ring-slate-900" : "ring-white"}`}
          ></span>
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 w-80 md:w-96 rounded-xl shadow-xl border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
        >
          <div
            className={`px-4 py-3 border-b flex items-center justify-between ${theme === "dark" ? "bg-slate-800/50 border-slate-700" : "bg-slate-50/50 border-slate-100"}`}
          >
            <h3
              className={` text-sm ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
            >
              Notificações do Sistema
            </h3>
            {systemVersionNotif && (
              <button
                onClick={handleMarkAllAsRead}
                className={`text-[10px] uppercase px-2 py-1 rounded transition-colors ${theme === "dark" ? "text-blue-400 hover:bg-blue-900/40" : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"}`}
              >
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={notification.onClick}
                    className={`px-4 py-3 border-b transition-colors relative ${notification.onClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" : ""} ${theme === "dark" ? "border-slate-700" : "border-slate-50"} ${!notification.read ? (theme === "dark" ? "bg-blue-900/20" : "bg-blue-50/30") : ""}`}
                  >
                    {!notification.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500"></div>
                    )}
                    <div className="flex gap-3">
                      <div
                        className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full ${getBgColor(notification.type)} flex items-center justify-center shadow-sm`}
                      >
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-0.5">
                          <h4
                            className={`text-sm ${!notification.read ? (theme === "dark" ? "text-slate-200" : "text-slate-800") : theme === "dark" ? "text-slate-400" : "text-slate-600"}`}
                          >
                            {notification.title}
                          </h4>
                          <span
                            className={`text-[10px] whitespace-nowrap flex items-center gap-1 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                          >
                            <Clock size={10} />
                            {notification.time}
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-relaxed ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                        >
                          {notification.message}
                        </p>
                        {notification.id === "sys_version_update" && (
                          <button
                            onClick={(e) =>
                              handleMarkAsRead(notification.id, e)
                            }
                            className={`mt-2 text-xs  ${theme === "dark" ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                          >
                            Ciente
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
