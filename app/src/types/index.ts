export type CourseYear = 1 | 2 | 3 | 4;

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CADETE"
  | "CHEFE_TURMA"
  | "DOCENTE";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string; // ISO Date

  // Campos para cadetes
  cadetId?: string;      // cadetes.id (ex: '26-001')
  turmaAula?: string;    // 'TURMA_A'…'TURMA_F'
  isChefeTurmaAtivo?: boolean; // true se estiver com mandato ativo hoje

  // Fields for Registration Request
  requestedRole?: "CADETE" | "DOCENTE";
  squadron?: string; // e.g. "1º Esquadrão"
  teachingDisciplines?: string[]; // List of Discipline IDs
  comments?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
}

// Motivos padronizados de falta
export const MOTIVOS_FALTA = [
  'DESCONHECIDO',
  'Adaptador',
  'Adido',
  'Aguarda Desligamento',
  'Atleta',
  'Consulta ES',
  'Dispensa Médica',
  'Disposição do Cmt do CCAer',
  'Disposição do Cmt do Esquadrão',
  'Emergência',
  'Fisioterapia',
  'Guia',
  'Hospitalização',
  'Instrução Salto de Emergência',
  'Licenciado',
  'Líder de Esquadrão/Esquadrilha',
  'Odontoclínica',
  'Ordem Superior',
  'Representação',
  'Serviço',
  'Serviço SCAer',
  'Viagem',
  'Voo',
  'Voo à vela',
  'Outros',
] as const;

export type MotivoFalta = typeof MOTIVOS_FALTA[number];

export interface ChefeTurma {
  id: string;
  cadet_id: string;
  turma_aula: string;
  cohort_id: string;
  data_inicio: string;
  data_fim: string;
  nomeado_por?: string;
  ativo: boolean;
  created_at: string;
  // join
  nome_guerra?: string;
  nome_completo?: string;
}

export interface FaltaCadete {
  id: string;
  aula_id: string;
  cadet_id: string;
  motivo: string;
  observacao?: string;
  chefe_cadet_id: string;
  created_at: string;
  updated_at: string;
}

export type TrainingField =
  | "GERAL"
  | "MILITAR"
  | "PROFISSIONAL"
  | "ATIVIDADES_COMPLEMENTARES";

export interface SchedulingCriteria {
  frequency: number; // Sessions per week
  allowConsecutiveDays: boolean; // Default false
  preferredSlots: string[]; // List of slot start times (e.g., '07:00')
  requiredRoom: "SALA_AULA" | "LAB" | "AUDITORIO" | "GINASIO" | "OUTDOOR";
  priority: number; // 1-10
  maxClassesPerDay?: number; // Max daily sessions default 2
  semester?: 1 | 2; // Qual semestre esta disciplina deve ocorrer
}

export interface SemesterConfig {
  id: string; // e.g. "2026"
  year: number;
  s1Start: string; // ISO Date YYYY-MM-DD
  s1End: string;
  s2Start: string;
  s2End: string;
}

export interface Discipline {
  id: string;
  code: string;
  name: string;
  trainingField: TrainingField;
  instructor?: string; // Still here for legacy, but will map to trigram
  instructorTrigram?: string; // Link to Instructor.trigram
  noSpecificInstructor?: boolean; // Flag for disciplines without a specific instructor
  substituteTrigram?: string; // Link to Instructor.trigram for substitute
  substituteHours?: number; // How many hours the substitute taught
  location?: string;
  color: string;
  scheduling_criteria?: SchedulingCriteria;

  // Unified Allocation Fields
  enabledCourses: ("AVIATION" | "INTENDANCY" | "INFANTRY")[];
  enabledYears: CourseYear[];
  ppcLoads: Record<string, number>; // e.g. "AVIATION_1": 64

  // Legacy fields (optional, kept for backward compatibility during migration)
  year?: CourseYear | "ALL";
  course?: "AVIATION" | "INTENDANCY" | "INFANTRY" | "ALL";
  load_hours?: number;
  category?: "COMMON" | "AVIATION" | "INTENDANCY" | "INFANTRY";
}

export type InstructorVenture =
  | "EFETIVO"
  | "PRESTADOR_TAREFA"
  | "CIVIL"
  | "QOCON";
export type AcademicTitle = "ESPECIALISTA" | "MESTRE" | "DOUTOR" | "GRADUADO";

export interface Instructor {
  trigram: string; // Primary Key
  fullName: string;
  warName: string;
  rank: string; // Posto/Graduação ou Título Civil
  cpf_saram: string;
  email: string;
  phone: string;
  venture: InstructorVenture;
  maxTitle: AcademicTitle;
  specialty: string;
  weeklyLoadLimit: number;
  fixedBlocks: string[]; // e.g. ["SEG_MANHA", "TER_TARDE"]
  plannedAbsences: Array<{
    start: string;
    end: string;
    reason: string;
  }>;
  preferences: string;
  enabledDisciplines: string[]; // List of Discipline IDs
  enabledClasses: string[]; // List of CourseClass IDs
}

export interface InstructorOccurrence {
  id: string;
  instructorTrigram: string;
  date: string;
  type: "ATRASO" | "FALTA" | "INDISPONIBILIDADE";
  reason: string;
  disciplineId?: string;
  classId?: string;
}

export type EventType = "CLASS" | "EVALUATION" | "ACADEMIC";

export type EvaluationType =
  | "PARTIAL"
  | "EXAM"
  | "FINAL"
  | "SECOND_CHANCE"
  | "REVIEW";

export interface ScheduleEvent {
  id: string;
  disciplineId: string;
  classId: string; // 'Turma' or specific group
  date: string; // ISO date string YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  type?: EventType;
  evaluationType?: EvaluationType;
  isBlocking?: boolean;
  color?: string;
  targetSquadron?: number | "ALL" | null;
  targetCourse?: "AVIATION" | "INTENDANCY" | "INFANTRY" | "ALL" | null;
  targetClass?: string | "ALL" | null;
  description?: string;
  notes?: string; // Texto livre adicional (usado em eventos acadêmicos)
  instructorTrigram?: string; // Override for a specific session
  changeRequestId?: string; // Link to ScheduleChangeRequest
}

export interface CourseClass {
  id: string;
  name: string; // e.g., "A", "B", "C"
  year: CourseYear;
  type: "AVIATION" | "INTENDANCY" | "INFANTRY";
  studentCount?: number;
}

export type CohortColor = "blue" | "green" | "black" | "red";

export interface Cohort {
  id: string;
  name: string; // e.g. "Turma Espada", "Turma 2026"
  entryYear: number; // e.g. 2026
  color: CohortColor; // Traditional AFA colors
}

export type ChangeRequestStatus =
  | "PENDENTE"
  | "APROVADA"
  | "REJEITADA"
  | "EXECUTADA";

export interface ScheduleChangeRequest {
  id: string;
  numeroAlteracao: string; // ex: "SAP-2026-001"
  solicitante: string;
  motivo: string;
  descricao: string;
  dataSolicitacao: string; // ISO DateTime
  status: ChangeRequestStatus;
  eventIds: string[]; // IDs dos ScheduleEvents vinculados
  createdAt: string;
  createdBy: string; // UID
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientGroups: MessageGroup[]; // Groups targeted
  recipientId?: string; // Specific user targeted (for direct replies)
  subject: string;
  content: string;
  createdAt: string; // ISO Date
  readBy: string[]; // List of user IDs who have read the message
  senderDetail?: string; // Extra info like Squadron for Cadets
}

export type MessageGroup =
  | "ADMINS"
  | "INSTRUCTORS"
  | "CADETS_ALL"
  | "CADETS_1"
  | "CADETS_2"
  | "CADETS_3"
  | "CADETS_4"
  | "DEVELOPER";

export type NoticeType =
  | "INFO"
  | "WARNING"
  | "URGENT"
  | "GENERAL"
  | "EVENT"
  | "EVALUATION";

export interface SystemNotice {
  id: string;
  title: string;
  description?: string;
  type: NoticeType;
  startDate: string; // ISO Date YYYY-MM-DD
  endDate: string; // ISO Date YYYY-MM-DD
  targetRoles: UserRole[];
  targetSquadron?: CourseYear | null; // Optional: specific year
  targetCourse?: "AVIATION" | "INTENDANCY" | "INFANTRY" | "ALL" | null;
  targetClass?: string | null; // Optional: specific class e.g. "1A"
  createdAt: string;
  createdBy: string;
}

export interface VisualConfig {
  id: string; // e.g. 'first-lesson', 'last-lesson', 'evaluation'
  name: string;
  description?: string;
  active: boolean;
  // Condition logic
  ruleType: "FIRST_LESSON" | "LAST_LESSON" | "EVALUATION" | "CUSTOM";
  evaluationType?: "PARTIAL" | "FINAL" | "EXAM" | "SECOND_CHANCE" | "REVIEW"; // Specific for EVALUATION
  priority: number; // For overlapping rules

  // UI Style
  ringColor: string; // hex
  ringWidth: number; // px
  showRing: boolean;

  // Tag Style
  showTag: boolean;
  tagText?: string;
  tagBgColor: string; // hex
  tagTextColor: string; // hex

  // Icon Style
  showIcon: boolean;
  iconName: string; // Lucide icon name string
}

export * from "./auditLog";

export type CadetQuadro = "CFOAV" | "CFOINT" | "CFOINF";
export type CadetTurma  = "TURMA_A" | "TURMA_B" | "TURMA_C" | "TURMA_D" | "TURMA_E" | "TURMA_F";
export type CadetSituacao = "ATIVO" | "DESLIGADO" | "TRANCADO" | "TRANSFERIDO";

export interface Cadet {
  id: string;             // '26-001'
  nome_guerra: string;
  nome_completo: string;
  quadro: CadetQuadro;
  cohort_id: string;      // permanente — Drakon='1', Perseu='2'…
  situacao: CadetSituacao;
  email?: string;         // email de acesso ao sistema
  observacao?: string;
  created_at?: string;
  updated_at?: string;
  // Injetado pelo frontend ao carregar (join com cadete_alocacoes)
  turma_aula?: CadetTurma;
}

/** Alocação anual de turma de aula — muda a cada ano letivo */
export interface CadetAlocacao {
  id?: string;
  cadet_id: string;
  ano: number;
  turma_aula: CadetTurma;
}
