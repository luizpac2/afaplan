import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Plane,
  CalendarClock,
  Users,
  BarChart as PieChart,
  History,
  BarChart3,
  Zap,
  AlertTriangle,
  Settings,
  LogOut,
  GraduationCap,
  Menu,
  ChevronDown,
  ChevronRight,
  Layers,
  UserCheck,
  Inbox,
  HelpCircle,
  Home,
  Megaphone,
  Search,
  Palette,
  FileEdit,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCourseStore } from "../store/useCourseStore";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { UserMenu } from "./header/UserMenu";
import { NotificationsPopover } from "./header/NotificationsPopover";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import { Calendar as CalendarIcon } from "lucide-react";

interface MenuItem {
  title: string;
  path?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: any;
  roles?: string[];
  submenu?: MenuItem[];
  section?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    title: "PROGRAMAÇÃO",
    icon: GraduationCap,
    roles: [
      "SUPER_ADMIN", "ADMIN", "CADETE", "DOCENTE",
      "VISITANTE_CADETE", "VISITANTE_DOCENTE", "VISITANTE_ADMIN", "VISITANTE",
    ],
    submenu: [
      { title: "Início", path: "/", icon: Home },
      { title: "Calendário", path: "/panoramic-view", icon: CalendarIcon },
      { title: "1º Esquadrão", path: "/programming/1", icon: CalendarClock },
      { title: "2º Esquadrão", path: "/programming/2", icon: CalendarClock },
      { title: "3º Esquadrão", path: "/programming/3", icon: CalendarClock },
      { title: "4º Esquadrão", path: "/programming/4", icon: CalendarClock },
    ],
  },
  {
    title: "DOCENTE",
    icon: UserCheck,
    roles: ["SUPER_ADMIN", "ADMIN", "DOCENTE", "VISITANTE_DOCENTE", "VISITANTE_ADMIN"],
    submenu: [
      { title: "Relatórios", path: "/instructor-report", icon: FileText },
    ],
  },
  {
    title: "PLANEJAMENTO",
    icon: Layers,
    roles: ["SUPER_ADMIN", "ADMIN", "VISITANTE_ADMIN"],
    submenu: [
      { title: "Visão Geral", path: "/general-overview", icon: PieChart },
      {
        title: "Calendário",
        icon: CalendarIcon,
        submenu: [
          { title: "Panoramic", path: "/panoramic" },
          { title: "Bloqueios", path: "/academic-calendar" },
        ],
      },
      { title: "Alterações (SAP)", path: "/change-requests", icon: FileEdit },
      {
        title: "Disciplinas",
        icon: BookOpen,
        submenu: [
          { title: "Gerenciar", path: "/disciplinas" },
          { title: "PPC", path: "/cursos" },
          { title: "Critérios", path: "/ficha-informativa" },
        ],
      },
      {
        title: "Docentes",
        icon: UserCheck,
        submenu: [
          { title: "Gerenciar", path: "/instructors" },
          { title: "Ocorrências", path: "/instructor-occurrences" },
        ],
      },
      { title: "Turmas", path: "/turmas", icon: Users },
      {
        title: "Inteligência",
        icon: Zap,
        submenu: [
          { title: "Automação", path: "/automation" },
          { title: "Otimização", path: "/monthly-optimization" },
        ],
      },
    ],
  },
  {
    title: "INSTRUÇÃO AÉREA",
    icon: Plane,
    roles: ["SUPER_ADMIN", "ADMIN", "VISITANTE_ADMIN"],
    submenu: [
      { title: "Dias de Voo", path: "/flight-calendar", icon: CalendarIcon },
      { title: "Painel", path: "/flight-dashboard", icon: BarChart3 },
    ],
  },
  {
    title: "RELATÓRIOS",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "ADMIN", "VISITANTE_ADMIN"],
    submenu: [
      { title: "Gerais", path: "/reports", icon: FileText },
      { title: "PPC", path: "/controle-ppc", icon: BarChart3 },
      { title: "Dados PPC", path: "/statistics", icon: PieChart },
      { title: "Conflitos", path: "/conflict-report", icon: AlertTriangle },
    ],
  },
  {
    title: "SISTEMA",
    icon: Settings,
    roles: ["SUPER_ADMIN", "ADMIN"],
    submenu: [
      { title: "Usuários", path: "/users", icon: Users },
      { title: "Avisos", path: "/notice-manager", icon: Megaphone },
      { title: "Histórico", path: "/audit-log", icon: History },
      { title: "Interface", path: "/visual-editor", icon: Palette },
      { title: "Ajustes", path: "/settings", icon: Settings },
    ],
  },
];

export const Layout = () => {
  const { logout, userProfile } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useUnreadCount();
  const navigate = useNavigate();
  const location = useLocation();
  const clearStore = useCourseStore((state) => state.clearStore);
  const searchRef = useRef<HTMLInputElement>(null);

  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    PROGRAMAÇÃO: true,
  });
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const isDark = theme === "dark";

  // ── Breadcrumb ──────────────────────────────────────────
  const getBreadcrumbs = () => {
    const paths: { title: string; path?: string }[] = [];
    const currentPath = location.pathname;

    const findInMenu = (items: MenuItem[]): boolean => {
      for (const item of items) {
        if (item.path === currentPath) {
          paths.push({ title: item.title, path: item.path });
          return true;
        }
        if (item.submenu && findInMenu(item.submenu)) {
          paths.unshift({ title: item.title });
          return true;
        }
      }
      return false;
    };

    if (currentPath === "/") return [{ title: "Início", path: "/" }];
    findInMenu(MENU_ITEMS);

    const squadMatch = currentPath.match(/\/programming\/(\d)/);
    if (squadMatch) {
      return [{ title: "Programação" }, { title: `${squadMatch[1]}º Esquadrão` }];
    }

    return paths.length > 0 ? paths : [{ title: "Página" }];
  };

  const breadcrumbs = getBreadcrumbs();

  // ── Responsive ──────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location.pathname]);

  // ── Section Toggle ───────────────────────────────────────
  const toggleSection = (title: string, depth: number) => {
    setOpenSections((prev) => {
      const isOpening = !prev[title];
      const newSections: Record<string, boolean> = { ...prev };
      if (isOpening) {
        if (depth === 0) {
          MENU_ITEMS.forEach((m) => { if (m.title !== title) newSections[m.title] = false; });
        } else if (depth === 1) {
          const parent = MENU_ITEMS.find((m) => m.submenu?.some((sub) => sub.title === title));
          if (parent?.submenu) {
            parent.submenu.forEach((sub) => { if (sub.title !== title) newSections[sub.title] = false; });
          }
        }
        newSections[title] = true;
      } else {
        newSections[title] = false;
      }
      return newSections;
    });
  };

  // Auto-open active section on route change
  useEffect(() => {
    let changed = false;
    const newSections = { ...openSections };
    const autoOpen = (items: MenuItem[]) => {
      items.forEach((item) => {
        if (item.submenu) {
          const hasActive = item.submenu.some(
            (sub) => sub.path === location.pathname ||
              (sub.submenu && sub.submenu.some((s) => s.path === location.pathname))
          );
          if (hasActive && !newSections[item.title]) {
            newSections[item.title] = true;
            changed = true;
            autoOpen(item.submenu);
          }
        }
      });
    };
    autoOpen(MENU_ITEMS);
    if (changed) setOpenSections(newSections);
  }, [location.pathname]);

  const hasPermission = (item: MenuItem) => {
    if (!item.roles) return true;
    return item.roles.includes(userProfile?.role || "");
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearStore();
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const showHelp = () => {
    alert("Bem-vindo ao AFA Planner!\n\nPara suporte, entre em contato com a Divisão de Ensino.\nRamal: 1234\nEmail: ensino.afa@fab.mil.br");
  };

  // ── Shared CSS helpers ───────────────────────────────────
  const sidebarBg   = isDark ? "bg-slate-900"   : "bg-white";
  const sidebarBdr  = isDark ? "border-slate-800" : "border-slate-200";
  const headerBg    = isDark ? "bg-slate-900"   : "bg-white";
  const headerBdr   = isDark ? "border-slate-800" : "border-slate-200";
  const mainBg      = isDark ? "bg-slate-950"   : "bg-slate-50";

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden transition-colors duration-200 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>

      {/* ══ HEADER ══════════════════════════════════════════ */}
      <header className={`h-14 border-b flex items-center justify-between px-3 z-50 sticky top-0 no-print flex-shrink-0 transition-colors duration-200 ${headerBg} ${headerBdr}`}>

        {/* Left: Toggle + Brand + Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${isDark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"}`}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
              <img src="/logo.png?v=2" alt="AFA" className="h-6 w-6 object-contain" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className={`text-sm font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                AFA Planner
              </span>
              <span className={`text-[10px] font-medium uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Div. Ensino
              </span>
            </div>
          </div>

          {/* Breadcrumb separator + path */}
          {!isMobile && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 ml-2 min-w-0">
              <span className={`text-xs mx-1 ${isDark ? "text-slate-700" : "text-slate-300"}`}>/</span>
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-1 min-w-0">
                  {crumb.path ? (
                    <NavLink
                      to={crumb.path}
                      className={({ isActive }) =>
                        `text-sm truncate transition-colors ${isActive
                          ? isDark ? "text-white font-medium" : "text-slate-900 font-medium"
                          : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                        }`
                      }
                    >
                      {crumb.title}
                    </NavLink>
                  ) : (
                    <span className={`text-sm truncate ${idx === breadcrumbs.length - 1
                      ? isDark ? "text-white font-medium" : "text-slate-900 font-medium"
                      : isDark ? "text-slate-500" : "text-slate-400"}`}>
                      {crumb.title}
                    </span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight size={12} className={isDark ? "text-slate-700" : "text-slate-300"} />
                  )}
                </div>
              ))}
            </nav>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Search */}
          <div className={`flex items-center transition-all duration-200 overflow-hidden ${isSearchExpanded ? "w-48 md:w-56" : "w-9"}`}>
            {isSearchExpanded ? (
              <div className={`flex items-center w-full rounded-lg border px-2 h-8 gap-1.5 ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"}`}>
                <Search size={14} className={isDark ? "text-slate-500" : "text-slate-400"} />
                <input
                  ref={searchRef}
                  autoFocus
                  type="text"
                  placeholder="Buscar..."
                  className={`bg-transparent border-none outline-none text-sm flex-1 min-w-0 ${isDark ? "text-slate-200 placeholder:text-slate-600" : "text-slate-700 placeholder:text-slate-400"}`}
                  onBlur={() => setIsSearchExpanded(false)}
                />
                <button onClick={() => setIsSearchExpanded(false)}>
                  <X size={12} className={isDark ? "text-slate-500" : "text-slate-400"} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className={`p-2 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
                aria-label="Buscar"
              >
                <Search size={18} />
              </button>
            )}
          </div>

          {/* Inbox */}
          <button
            onClick={() => navigate("/inbox")}
            className={`relative p-2 rounded-lg transition-colors hidden sm:flex items-center justify-center ${isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
            title="Mensagens"
          >
            <Inbox size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[16px] h-4 flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <NotificationsPopover />
          <ThemeToggle />

          <button
            onClick={showHelp}
            className={`p-2 rounded-lg transition-colors hidden md:flex items-center justify-center ${isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
            title="Ajuda"
          >
            <HelpCircle size={18} />
          </button>

          <div className={`h-5 w-px mx-1 ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />

          <UserMenu />
        </div>
      </header>

      {/* ══ BODY ════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile backdrop */}
        {isMobile && (
          <div
            className={`absolute inset-0 bg-black/40 backdrop-blur-xs z-30 transition-opacity duration-200 ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ══ SIDEBAR ═══════════════════════════════════════ */}
        <aside
          className={`
            border-r flex flex-col z-40 flex-shrink-0
            transition-all duration-200 ease-in-out no-print h-full
            ${sidebarBg} ${sidebarBdr}
            ${isMobile ? "fixed top-14 bottom-0 left-0 shadow-xl" : "relative"}
            ${isSidebarOpen
              ? "w-64 translate-x-0"
              : isMobile
                ? "w-0 -translate-x-full overflow-hidden"
                : "w-16 translate-x-0 overflow-hidden"
            }
          `}
        >
          {/* Nav items */}
          <div className="flex-1 overflow-y-auto py-3">
            <nav className="px-2 space-y-0.5">
              {MENU_ITEMS.map((module, mIdx) => {
                if (!hasPermission(module)) return null;
                const ModuleIcon = module.icon || Plane;
                const isModuleOpen = openSections[module.title];

                return (
                  <div key={mIdx} className="mb-1">
                    {/* Module header button */}
                    <button
                      onClick={() => {
                        if (!isSidebarOpen) {
                          setSidebarOpen(true);
                          if (!isModuleOpen) toggleSection(module.title, 0);
                        } else {
                          toggleSection(module.title, 0);
                        }
                      }}
                      title={!isSidebarOpen ? module.title : undefined}
                      className={`
                        w-full flex items-center justify-between px-2.5 py-2 rounded-lg
                        transition-all duration-150 group
                        ${isModuleOpen && isSidebarOpen
                          ? isDark
                            ? "bg-slate-800 text-slate-100"
                            : "bg-slate-100 text-slate-900"
                          : isDark
                            ? "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ModuleIcon size={17} className="flex-shrink-0 transition-transform duration-150 group-hover:scale-105" />
                        {isSidebarOpen && (
                          <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                            {module.title}
                          </span>
                        )}
                      </div>
                      {isSidebarOpen && (
                        <ChevronDown
                          size={13}
                          className={`flex-shrink-0 transition-transform duration-200 ${isModuleOpen ? "rotate-0" : "-rotate-90"}`}
                        />
                      )}
                    </button>

                    {/* Sub-items */}
                    {isSidebarOpen && isModuleOpen && module.submenu && (
                      <div className="mt-0.5 ml-1.5 pl-3 border-l border-slate-200 dark:border-slate-700/60 space-y-0.5 animate-fade-in">
                        {module.submenu.map((item, iIdx) => {
                          if (!hasPermission(item)) return null;
                          const ItemIcon = item.icon;
                          const isItemOpen = openSections[item.title];

                          /* Sub-menu group */
                          if (item.submenu) {
                            return (
                              <div key={iIdx}>
                                <button
                                  onClick={() => toggleSection(item.title, 1)}
                                  className={`
                                    w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm
                                    transition-colors duration-150
                                    ${isItemOpen
                                      ? isDark ? "text-blue-400 font-medium" : "text-blue-700 font-medium"
                                      : isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }
                                  `}
                                >
                                  <div className="flex items-center gap-2">
                                    {ItemIcon && <ItemIcon size={15} className="flex-shrink-0" />}
                                    <span className="truncate">{item.title}</span>
                                  </div>
                                  <ChevronDown
                                    size={12}
                                    className={`flex-shrink-0 transition-transform duration-200 ${isItemOpen ? "rotate-0" : "-rotate-90"}`}
                                  />
                                </button>

                                {isItemOpen && (
                                  <div className="ml-3 pl-2.5 border-l border-slate-100 dark:border-slate-700/40 mt-0.5 space-y-0.5 animate-fade-in">
                                    {item.submenu.map((sub, sIdx) => {
                                      const isSubOpen = openSections[sub.title];
                                      if (sub.submenu) {
                                        return (
                                          <div key={sIdx}>
                                            <button
                                              onClick={() => toggleSection(sub.title, 2)}
                                              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${isSubOpen
                                                ? isDark ? "text-blue-400" : "text-blue-700"
                                                : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
                                            >
                                              <span className="truncate">{sub.title}</span>
                                              <ChevronDown size={10} className={`flex-shrink-0 transition-transform duration-200 ${isSubOpen ? "rotate-0" : "-rotate-90"}`} />
                                            </button>
                                            {isSubOpen && (
                                              <div className="ml-2 pl-2 border-l border-slate-100 dark:border-slate-800 mt-0.5 space-y-0.5 animate-fade-in">
                                                {sub.submenu.map((leaf, lIdx) => (
                                                  <NavLink
                                                    key={lIdx}
                                                    to={leaf.path || "#"}
                                                    className={({ isActive }) => `
                                                      flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all duration-150
                                                      ${isActive
                                                        ? isDark
                                                          ? "bg-blue-900/25 text-blue-300 font-medium"
                                                          : "bg-blue-50 text-blue-700 font-medium"
                                                        : isDark
                                                          ? "text-slate-500 hover:text-slate-300"
                                                          : "text-slate-500 hover:text-slate-800"
                                                      }
                                                    `}
                                                  >
                                                    <div className="w-1 h-1 rounded-full bg-current opacity-40" />
                                                    <span>{leaf.title}</span>
                                                  </NavLink>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }
                                      return (
                                        <NavLink
                                          key={sIdx}
                                          to={sub.path || "#"}
                                          className={({ isActive }) => `
                                            relative flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all duration-150
                                            ${isActive
                                              ? isDark
                                                ? "bg-blue-900/20 text-blue-300 font-medium"
                                                : "bg-blue-50 text-blue-700 font-medium"
                                              : isDark
                                                ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
                                                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                            }
                                          `}
                                        >
                                          {({ isActive }) => (
                                            <>
                                              {isActive && <span className="nav-item-active-indicator" />}
                                              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${isActive ? "bg-blue-500" : "bg-current opacity-30"}`} />
                                              <span>{sub.title}</span>
                                            </>
                                          )}
                                        </NavLink>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          /* Direct nav link */
                          return (
                            <NavLink
                              key={iIdx}
                              to={item.path || "#"}
                              className={({ isActive }) => `
                                relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-all duration-150
                                ${isActive
                                  ? isDark
                                    ? "bg-blue-900/20 text-blue-300 font-medium"
                                    : "bg-blue-50 text-blue-700 font-medium"
                                  : isDark
                                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                }
                              `}
                            >
                              {({ isActive }) => (
                                <>
                                  {isActive && <span className="nav-item-active-indicator" />}
                                  {ItemIcon && <ItemIcon size={16} className="flex-shrink-0" />}
                                  <span className="truncate">{item.title}</span>
                                </>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Sidebar footer */}
          <div className={`flex-shrink-0 p-2.5 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
            <button
              onClick={handleLogout}
              title={!isSidebarOpen ? "Sair" : undefined}
              className={`
                w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150
                ${isDark
                  ? "text-slate-500 hover:bg-red-950/40 hover:text-red-400"
                  : "text-slate-400 hover:bg-red-50 hover:text-red-600"
                }
              `}
            >
              <LogOut size={17} className="flex-shrink-0" />
              {isSidebarOpen && (
                <span className="text-sm font-medium">Sair</span>
              )}
            </button>
            {isSidebarOpen && (
              <p className={`text-center text-[10px] mt-2 font-medium ${isDark ? "text-slate-700" : "text-slate-300"}`}>
                v1.9.0
              </p>
            )}
          </div>
        </aside>

        {/* ══ MAIN CONTENT ══════════════════════════════════ */}
        <main className={`flex-1 overflow-y-auto scroll-smooth transition-colors duration-200 ${mainBg}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
