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
  ClipboardList,
} from "lucide-react";
import { useState, useEffect } from "react";
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
    title: "CHEFE DE TURMA",
    icon: ClipboardList,
    roles: ["CHEFE_TURMA"],
    submenu: [
      { title: "Lançar Faltas", path: "/chefe-turma-lancamento", icon: ClipboardList },
    ],
  },
  {
    title: "PROGRAMAÇÃO",
    icon: GraduationCap,
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "CADETE",
      "DOCENTE",
      "VISITANTE_CADETE",
      "VISITANTE_DOCENTE",
      "VISITANTE_ADMIN",
      "VISITANTE",
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
    roles: [
      "SUPER_ADMIN",
      "ADMIN",
      "DOCENTE",
      "VISITANTE_DOCENTE",
      "VISITANTE_ADMIN",
    ],
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
      {
        title: "Turmas",
        icon: Users,
        submenu: [
          { title: "Esquadrões", path: "/turmas" },
          { title: "Cadetes", path: "/cadetes" },
          { title: "Dashboard Cadetes", path: "/cadet-dashboard" },
          { title: "Chefes de Turma", path: "/chefe-turma-admin" },
        ],
      },
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
    title: "RELATÓRIOS",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "ADMIN", "VISITANTE_ADMIN"],
    submenu: [
      { title: "Gerais", path: "/reports", icon: FileText },
      { title: "PPC", path: "/controle-ppc", icon: BarChart3 },
      { title: "Dados PPC", path: "/statistics", icon: PieChart },
      { title: "Conflitos", path: "/conflict-report", icon: AlertTriangle },
      { title: "Faltas", path: "/faltas", icon: ClipboardList },
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
  const [isSidebarOpen, setSidebarOpen] = useState(true); // Default open on desktop
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    PROGRAMAÇÃO: true,
  });

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Breadcrumb logic
  const getBreadcrumbs = () => {
    const paths: { title: string; path?: string }[] = [];
    const currentPath = location.pathname;

    const findInMenu = (items: MenuItem[], currentDepth: number): boolean => {
      for (const item of items) {
        if (item.path === currentPath) {
          paths.push({ title: item.title, path: item.path });
          return true;
        }
        if (item.submenu) {
          if (findInMenu(item.submenu, currentDepth + 1)) {
            paths.unshift({ title: item.title });
            return true;
          }
        }
      }
      return false;
    };

    if (currentPath === "/") {
      return [{ title: "Início", path: "/" }];
    }

    findInMenu(MENU_ITEMS, 0);

    const squadMatch = currentPath.match(/\/programming\/(\d)/);
    if (squadMatch) {
      const squadNum = squadMatch[1];
      return [{ title: "Programação" }, { title: `${squadNum}º Esquadrão` }];
    }

    return paths.length > 0 ? paths : [{ title: "Página" }];
  };

  const breadcrumbs = getBreadcrumbs();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Init

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSection = (title: string, depth: number) => {
    setOpenSections((prev) => {
      const isOpening = !prev[title];
      const newSections: Record<string, boolean> = { ...prev };

      if (isOpening) {
        // When opening a module (depth 0), close all other top-level modules
        if (depth === 0) {
          MENU_ITEMS.forEach((m) => {
            if (m.title !== title) newSections[m.title] = false;
          });
        }
        // When opening a depth 1 group, close other groups in same module
        else if (depth === 1) {
          // Find parent module of this subitem
          const parent = MENU_ITEMS.find((m) =>
            m.submenu?.some((sub) => sub.title === title),
          );
          if (parent && parent.submenu) {
            parent.submenu.forEach((sub) => {
              if (sub.title !== title) newSections[sub.title] = false;
            });
          }
        }
        newSections[title] = true;
      } else {
        // If closing, just set to false. This allows manual collapse.
        newSections[title] = false;
      }

      return newSections;
    });
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

  // Close mobile menu when route changes
  useEffect(() => {
    if (window.innerWidth < 768) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Automatically open sections based on active route - only when path changes
  useEffect(() => {
    let changed = false;
    const newSections = { ...openSections };

    const autoOpen = (items: MenuItem[]) => {
      items.forEach((item) => {
        if (item.submenu) {
          const hasActiveChild = item.submenu.some(
            (sub) =>
              sub.path === location.pathname ||
              (sub.submenu &&
                sub.submenu.some((s) => s.path === location.pathname)),
          );
          if (hasActiveChild && !newSections[item.title]) {
            newSections[item.title] = true;
            changed = true;
            autoOpen(item.submenu);
          }
        }
      });
    };

    autoOpen(MENU_ITEMS);
    if (changed) {
      setOpenSections(newSections);
    }
  }, [location.pathname]);

  const hasPermission = (item: MenuItem) => {
    if (!item.roles) return true;
    return item.roles.includes(userProfile?.role || "");
  };

  const showHelp = () => {
    alert(
      "Bem-vindo ao AFA Planner!\n\nPara suporte, entre em contato com a Divisão de Ensino.\nRamal: 1234\nEmail: ensino.afa@fab.mil.br",
    );
  };

  return (
    <div
      className={`flex flex-col h-[100dvh] font-sans overflow-hidden transition-colors duration-300 ${theme === "dark" ? "bg-slate-950 text-white" : "bg-gray-50 text-gray-900"}`}
    >
      {/* Main Header */}
      <header
        className={`h-16 border-b flex items-center justify-between px-4 z-50 shadow-sm relative sticky top-0 no-print transition-colors duration-300 ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-400"}`}
      >
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-3">
            <img
              src="/logo.png?v=2"
              alt="Logo AFA"
              className="h-8 w-auto object-contain"
            />
            <div className="hidden lg:flex flex-col items-center">
              <span
                className={` text-xl leading-tight ${theme === "dark" ? "text-white" : "text-black"}`}
              >
                AFA Planner
              </span>
              <span
                className={`text-[10px] uppercase  tracking-wider ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
              >
                Divisão de Ensino
              </span>
            </div>
          </div>

          {/* Breadcrumbs */}
          {!isMobile && (
            <nav
              className={`flex items-center gap-2 ml-4 text-sm overflow-hidden whitespace-nowrap ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}
            >
              <div
                className={`h-4 w-px mx-2 ${theme === "dark" ? "bg-slate-800" : "bg-slate-400"}`}
              ></div>
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {crumb.path ? (
                    <NavLink
                      to={crumb.path}
                      className={({ isActive }) =>
                        `hover:underline transition-colors ${isActive ? ` ${theme === "dark" ? "text-white" : "text-slate-950"}` : "text-slate-600 dark:text-slate-400 "}`
                      }
                    >
                      {crumb.title}
                    </NavLink>
                  ) : (
                    <span
                      className={
                        idx === breadcrumbs.length - 1
                          ? ` ${theme === "dark" ? "text-white" : "text-black"}`
                          : "text-slate-400"
                      }
                    >
                      {crumb.title}
                    </span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                </div>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          {/* Search Bar */}
          <div
            className={`flex items-center transition-all duration-300 ease-in-out ${isSearchExpanded ? "w-48 md:w-64 bg-slate-100 dark:bg-slate-700" : "w-10"} rounded-full px-2 h-10`}
          >
            <button
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Search size={20} />
            </button>
            {isSearchExpanded && (
              <input
                autoFocus
                type="text"
                placeholder="Buscar..."
                className="bg-transparent border-none focus:ring-0 text-sm w-full ml-1 text-slate-700 dark:text-slate-200"
                onBlur={() => setIsSearchExpanded(false)}
              />
            )}
          </div>
          <button
            onClick={() => navigate("/inbox")}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors hidden sm:block relative"
            title="Mensagens"
          >
            <Inbox size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 translate-x-1/4 -translate-y-1/4 bg-red-500 text-white text-[10px]  px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center border-2 border-white shadow-sm">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <NotificationsPopover />

          <ThemeToggle />

          <button
            onClick={showHelp}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors hidden sm:block"
            title="Ajuda"
          >
            <HelpCircle size={20} />
          </button>

          <div className="h-8 w-px bg-slate-200 mx-1"></div>

          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay (Backdrop) */}
        {isMobile && (
          <div
            className={`absolute inset-0 top-0 bg-black/50 z-30 transition-opacity duration-300 ease-in-out ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
                    border-r flex flex-col z-40
                    transition-all duration-300 ease-in-out no-print h-full
                    ${theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-400"}
                    ${isMobile ? "fixed top-16 bottom-0 left-0 shadow-xl" : "relative"}
                    ${isSidebarOpen ? "w-64 translate-x-0" : isMobile ? "w-0 -translate-x-full" : "w-16 translate-x-0 overflow-hidden"}
                `}
        >
          <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
            <nav className="px-3 space-y-1">
              {MENU_ITEMS.map((module, mIdx) => {
                if (!hasPermission(module)) return null;
                const ModuleIcon = module.icon || Plane;
                const isModuleOpen = openSections[module.title];

                return (
                  <div key={mIdx} className="mb-2">
                    <button
                      onClick={() => {
                        if (!isSidebarOpen) {
                          setSidebarOpen(true);
                          if (!isModuleOpen) toggleSection(module.title, 0);
                        } else {
                          toggleSection(module.title, 0);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 
                                                ${
                                                  isModuleOpen && isSidebarOpen
                                                    ? theme === "dark"
                                                      ? "bg-slate-800 text-white"
                                                      : "bg-slate-900 text-white"
                                                    : theme === "dark"
                                                      ? "text-slate-200 hover:bg-slate-800"
                                                      : "text-black hover:bg-slate-100"
                                                } font-normal`}
                      title={!isSidebarOpen ? module.title : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <ModuleIcon size={20} className="min-w-[20px]" />
                        {isSidebarOpen && (
                          <span className="font-normal text-xs uppercase tracking-wider truncate">
                            {module.title}
                          </span>
                        )}
                      </div>
                      {isSidebarOpen &&
                        (isModuleOpen ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        ))}
                    </button>

                    {isSidebarOpen && isModuleOpen && module.submenu && (
                      <div className="mt-1 ml-2 pl-2 border-l-2 border-slate-200 dark:border-slate-800 space-y-1">
                        {module.submenu.map((item, iIdx) => {
                          if (!hasPermission(item)) return null;
                          const ItemIcon = item.icon;
                          const isItemOpen = openSections[item.title];

                          if (item.submenu) {
                            return (
                              <div key={iIdx}>
                                <button
                                  onClick={() => toggleSection(item.title, 1)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors 
                                                                        ${
                                                                          isItemOpen
                                                                            ? theme ===
                                                                              "dark"
                                                                              ? "text-blue-400 border-r-2 border-blue-500"
                                                                              : "text-blue-800 border-r-2 border-blue-700"
                                                                            : theme ===
                                                                                "dark"
                                                                              ? "text-slate-200 hover:text-white"
                                                                              : "text-black hover:text-black hover:bg-slate-50"
                                                                        } `}
                                >
                                  <div className="flex items-center gap-2">
                                    {ItemIcon && <ItemIcon size={18} />}
                                    <span className="truncate">
                                      {item.title}
                                    </span>
                                  </div>
                                  {isItemOpen ? (
                                    <ChevronDown size={12} />
                                  ) : (
                                    <ChevronRight size={12} />
                                  )}
                                </button>
                                {isItemOpen && (
                                  <div className="ml-4 pl-3 border-l-2 border-slate-100 dark:border-slate-700/50 mt-1 space-y-1">
                                    {item.submenu.map((sub, sIdx) => {
                                      const isSubOpen = openSections[sub.title];
                                      if (sub.submenu) {
                                        return (
                                          <div key={sIdx}>
                                            <button
                                              onClick={() =>
                                                toggleSection(sub.title, 2)
                                              }
                                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-colors 
                                                                                                ${
                                                                                                  isSubOpen
                                                                                                    ? theme ===
                                                                                                      "dark"
                                                                                                      ? "text-blue-400"
                                                                                                      : "text-blue-800"
                                                                                                    : theme ===
                                                                                                        "dark"
                                                                                                      ? "text-slate-300 hover:text-white"
                                                                                                      : "text-black hover:bg-slate-50"
                                                                                                } `}
                                            >
                                              <span className="truncate">
                                                {sub.title}
                                              </span>
                                              {isSubOpen ? (
                                                <ChevronDown size={10} />
                                              ) : (
                                                <ChevronRight size={10} />
                                              )}
                                            </button>
                                            {isSubOpen && (
                                              <div className="ml-2 pl-3 border-l border-slate-100 dark:border-slate-800 mt-1 space-y-1">
                                                {sub.submenu.map(
                                                  (leaf, lIdx) => (
                                                    <NavLink
                                                      key={lIdx}
                                                      to={leaf.path || "#"}
                                                      className={({
                                                        isActive,
                                                      }) => `
                                                                                                            flex items-center gap-2 px-3 py-1 rounded-md text-[10px] transition-all duration-200
                                                                                                            ${
                                                                                                              isActive
                                                                                                                ? theme ===
                                                                                                                  "dark"
                                                                                                                  ? "bg-blue-900/20 text-blue-300"
                                                                                                                  : "bg-blue-50 text-blue-900"
                                                                                                                : theme ===
                                                                                                                    "dark"
                                                                                                                  ? "text-slate-400 hover:text-white"
                                                                                                                  : "text-slate-600 hover:text-black"
                                                                                                            }  uppercase tracking-tight
                                                                                                        `}
                                                    >
                                                      <div className="w-1 h-1 rounded-full bg-current opacity-30" />
                                                      <span>{leaf.title}</span>
                                                    </NavLink>
                                                  ),
                                                )}
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
                                                                                        flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-200 relative
                                                                                        ${
                                                                                          isActive
                                                                                            ? theme ===
                                                                                              "dark"
                                                                                              ? "bg-blue-900/30 text-blue-200"
                                                                                              : "bg-blue-50 text-blue-900"
                                                                                            : theme ===
                                                                                                "dark"
                                                                                              ? "text-slate-300 hover:text-white"
                                                                                              : "text-black hover:text-black "
                                                                                        } 
                                                                                    `}
                                        >
                                          {({ isActive }) => (
                                            <>
                                              {isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-1/2 bg-blue-600 rounded-r-sm" />
                                              )}
                                              <div
                                                className={`w-1 h-1 rounded-full ${isActive ? "bg-blue-600" : "bg-current opacity-30"}`}
                                              />
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

                          return (
                            <NavLink
                              key={iIdx}
                              to={item.path || "#"}
                              className={({
                                isActive,
                              }) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all 
                                                                ${
                                                                  isActive
                                                                    ? theme ===
                                                                      "dark"
                                                                      ? "bg-blue-900/20 text-blue-300 border-r-2 border-blue-600"
                                                                      : "bg-blue-50 text-blue-900 border-r-2 border-blue-800"
                                                                    : theme ===
                                                                        "dark"
                                                                      ? "text-slate-200 hover:bg-slate-800"
                                                                      : "text-black hover:bg-slate-100"
                                                                } `}
                            >
                              {ItemIcon && <ItemIcon size={18} />}
                              <span>{item.title}</span>
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

          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 whitespace-nowrap group overflow-hidden"
              title={!isSidebarOpen ? "Sair" : undefined}
            >
              <LogOut size={20} className="min-w-[20px]" />
              {isSidebarOpen && (
                <span className=" text-sm transition-opacity duration-200">
                  Sair
                </span>
              )}
            </button>
            {isSidebarOpen && (
              <div className="flex flex-col items-center">
                <p
                  className="text-[10px]  opacity-30 mt-2 hover:opacity-100 transition-opacity"
                  title="AFA Planner"
                >
                  v1.9.0
                </p>
                <p className="text-[9px] text-slate-400 font-mono">
                  Theme: {theme}
                </p>
              </div>
            )}
          </div>
        </aside>

        <main
          className={`flex-1 overflow-y-auto scroll-smooth transition-colors duration-300 ${theme === "dark" ? "bg-slate-950" : "bg-gray-50"}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
