import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SupabaseSync } from "./components/SupabaseSync";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Carregamento imediato — páginas críticas para a navegação inicial
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Inbox } from "./pages/Inbox";
import { Profile } from "./pages/Profile";

// Lazy loading — páginas pesadas (PDF, Excel, gráficos carregados sob demanda)
const Disciplinas = lazy(() => import("./pages/Disciplinas").then(m => ({ default: m.Disciplinas })));
const Instructors = lazy(() => import("./pages/Instructors").then(m => ({ default: m.Instructors })));
const Cursos = lazy(() => import("./pages/Cursos").then(m => ({ default: m.Cursos })));
const Turmas = lazy(() => import("./pages/Turmas").then(m => ({ default: m.Turmas })));
const Cadetes = lazy(() => import("./pages/Cadetes").then(m => ({ default: m.Cadetes })));
const CadetDashboard = lazy(() => import("./pages/CadetDashboard").then(m => ({ default: m.CadetDashboard })));
const Reports = lazy(() => import("./pages/Reports").then(m => ({ default: m.Reports })));
const SquadronProgramming = lazy(() => import("./pages/SquadronProgramming").then(m => ({ default: m.SquadronProgramming })));
const AuditLog = lazy(() => import("./pages/AuditLog").then(m => ({ default: m.AuditLog })));
const FichaInformativa = lazy(() => import("./pages/FichaInformativa").then(m => ({ default: m.FichaInformativa })));
const ControlePPC = lazy(() => import("./pages/ControlePPC").then(m => ({ default: m.ControlePPC })));
const Automation = lazy(() => import("./pages/Automation").then(m => ({ default: m.Automation })));
const MonthlyOptimization = lazy(() => import("./pages/MonthlyOptimization").then(m => ({ default: m.MonthlyOptimization })));
const ConflictReport = lazy(() => import("./pages/ConflictReport").then(m => ({ default: m.ConflictReport })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const Statistics = lazy(() => import("./pages/Statistics").then(m => ({ default: m.Statistics })));
const InstructorOccurrences = lazy(() => import("./pages/InstructorOccurrences").then(m => ({ default: m.InstructorOccurrences })));
const GeneralOverview = lazy(() => import("./pages/GeneralOverview").then(m => ({ default: m.GeneralOverview })));
const PanoramicMirror = lazy(() => import("./pages/PanoramicMirror").then(m => ({ default: m.PanoramicMirror })));
const InstructorReport = lazy(() => import("./pages/InstructorReport").then(m => ({ default: m.InstructorReport })));
const PanoramicCalendar = lazy(() => import("./pages/PanoramicCalendar").then(m => ({ default: m.PanoramicCalendar })));
const DisciplineReport = lazy(() => import("./pages/DisciplineReport").then(m => ({ default: m.DisciplineReport })));
const UserManagement = lazy(() => import("./pages/admin/UserManagement").then(m => ({ default: m.UserManagement })));
const NoticeManager = lazy(() => import("./pages/admin/NoticeManager").then(m => ({ default: m.NoticeManager })));
const VisualEditor = lazy(() => import("./pages/admin/VisualEditor").then(m => ({ default: m.VisualEditor })));
const AcademicCalendar = lazy(() => import("./pages/admin/AcademicCalendar").then(m => ({ default: m.AcademicCalendar })));
const ChangeRequestsPage = lazy(() => import("./pages/admin/ChangeRequestsPage").then(m => ({ default: m.ChangeRequestsPage })));
const ChefeTurmaAdmin = lazy(() => import("./pages/admin/ChefeTurmaAdmin").then(m => ({ default: m.ChefeTurmaAdmin })));
const ChefeTurmaLancamento = lazy(() => import("./pages/ChefeTurmaLancamento").then(m => ({ default: m.ChefeTurmaLancamento })));
const FaltasReport = lazy(() => import("./pages/FaltasReport").then(m => ({ default: m.FaltasReport })));
const DisciplineDashboard = lazy(() => import("./pages/DisciplineDashboard").then(m => ({ default: m.DisciplineDashboard })));
const GanttProgramming = lazy(() => import("./pages/GanttProgramming").then(m => ({ default: m.GanttProgramming })));
const AcademicGantt = lazy(() => import("./pages/AcademicGantt").then(m => ({ default: m.AcademicGantt })));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SupabaseSync />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/pending-approval" element={<Navigate to="/" replace />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  {/* ENSINO */}
                  <Route index element={<Dashboard />} />
                  <Route
                    path="programming/:squadronId"
                    element={<SquadronProgramming />}
                  />
                  <Route
                    path="programming"
                    element={<Navigate to="/programming/1" replace />}
                  />
                  <Route
                    path="gantt/:squadronId"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "CADETE", "DOCENTE", "CHEFE_TURMA"]}>
                        <GanttProgramming />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="gantt"
                    element={<Navigate to="/gantt/1" replace />}
                  />
                  <Route
                    path="panoramic"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <PanoramicCalendar />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="general-overview"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <GeneralOverview />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="panoramic-view" element={<PanoramicMirror />} />
                  <Route path="academic-gantt" element={<AcademicGantt />} />
                  <Route path="inbox" element={<Inbox />} />
                  <Route path="profile" element={<Profile />} />

                  {/* PLANEJAMENTO */}
                  <Route
                    path="disciplinas"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Disciplinas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="instructors"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Instructors />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="instructor-occurrences"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <InstructorOccurrences />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cursos"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Cursos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="turmas"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Turmas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cadetes"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Cadetes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cadet-dashboard"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <CadetDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="academic-calendar"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <AcademicCalendar />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="ficha-informativa"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <FichaInformativa />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="automation"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Automation />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="monthly-optimization"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <MonthlyOptimization />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="change-requests"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <ChangeRequestsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* DASHBOARD DISCIPLINAS */}
                  <Route
                    path="discipline-dashboard"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN", ]}>
                        <DisciplineDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* RELATÓRIOS */}
                  <Route
                    path="reports"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="controle-ppc"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <ControlePPC />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="conflict-report"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <ConflictReport />
                      </ProtectedRoute>
                    }
                  />

                  {/* DOCENTE */}
                  <Route
                    path="instructor-report"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "SUPER_ADMIN",
                          "ADMIN",
                          "DOCENTE",
                        ]}
                      >
                        <InstructorReport />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="discipline-report/:disciplineId"
                    element={
                      <ProtectedRoute
                        allowedRoles={[
                          "SUPER_ADMIN",
                          "ADMIN",
                          "DOCENTE",
                        ]}
                      >
                        <DisciplineReport />
                      </ProtectedRoute>
                    }
                  />

                  {/* ESTATÍSTICA */}
                  <Route
                    path="statistics"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <Statistics />
                      </ProtectedRoute>
                    }
                  />

                  {/* CHEFE DE TURMA */}
                  <Route
                    path="chefe-turma-lancamento"
                    element={
                      <ProtectedRoute allowedRoles={["CHEFE_TURMA"]}>
                        <ChefeTurmaLancamento />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="faltas"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
                        <FaltasReport />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="chefe-turma-admin"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
                        <ChefeTurmaAdmin />
                      </ProtectedRoute>
                    }
                  />

                  {/* USUÁRIOS */}
                  <Route
                    path="users"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <UserManagement />
                      </ProtectedRoute>
                    }
                  />

                  {/* SISTEMA */}
                  <Route
                    path="notice-manager"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                        <NoticeManager />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="audit-log"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                        <AuditLog />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="visual-editor"
                    element={
                      <ProtectedRoute
                        allowedRoles={["SUPER_ADMIN", "ADMIN", ]}
                      >
                        <VisualEditor />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
