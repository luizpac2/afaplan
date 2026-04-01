export const formatCourse = (course?: string): string => {
   if (!course) return 'Geral';
   const term = course.toUpperCase().replace('COURSE:', '');
   switch (term) {
      case 'AVIATION':
         return 'Av';
      case 'INTENDANCY':
         return 'Int';
      case 'INFANTRY':
         return 'Inf';
      case 'ALL':
      case 'GLOBAL':
         return 'Geral';
      default:
         return course;
   }
};

export const formatClassId = (classId?: string): string => {
   if (!classId || classId === 'Geral' || classId === 'GLOBAL' || classId === 'ALL') return 'Geral';

   // Handle COURSE:XXX format
   if (classId.startsWith('COURSE:')) {
      return `Todos (${formatCourse(classId)})`;
   }

   // Handle ESQ suffix
   if (classId.endsWith('ESQ')) {
      const sq = classId.replace('ESQ', '');
      return `${sq}º Esq`;
   }

   // Handle 1AVIATION, 1INFANTRY, etc.
   const courseMatch = classId.match(/^(\d)(AVIATION|INFANTRY|INTENDANCY)$/);
   if (courseMatch) {
      return `${courseMatch[1]}º ${formatCourse(courseMatch[2])}`;
   }

   // Standard 1A, 2B, etc.
   const standardMatch = classId.match(/^(\d)([A-F])$/);
   if (standardMatch) {
      return `${standardMatch[1]}${standardMatch[2]}`;
   }

   // Handle plain course names if they come as classId
   if (['AVIATION', 'INFANTRY', 'INTENDANCY'].includes(classId.toUpperCase())) {
      return formatCourse(classId);
   }

   return classId;
};

export const formatNoticeType = (type: string): string => {
   switch (type) {
      case 'URGENT':
         return 'Urgente';
      case 'WARNING':
         return 'Atenção';
      case 'INFO':
         return 'Info';
      case 'EVENT':
         return 'Evento';
      case 'EVALUATION':
         return 'Avaliação';
      case 'GENERAL':
         return 'Geral';
      default:
         return type;
   }
};

export const formatEvaluationType = (type?: string): string => {
   if (!type) return 'Avaliação';
   switch (type.toUpperCase()) {
      case 'PARTIAL':
         return 'Parcial';
      case 'EXAM':
         return 'Exame';
      case 'FINAL':
         return 'Prova Final';
      case 'REVIEW':
         return 'Vista de Prova';
      case 'SECOND_CHANCE':
         return '2ª Época';
      default:
         return type;
   }
};

export const formatEventType = (type?: string): string => {
   if (!type) return 'Aula';
   switch (type.toUpperCase()) {
      case 'CLASS':
         return 'Aula';
      case 'EVALUATION':
         return 'Avaliação';
      case 'ACADEMIC':
         return 'Ativ. Acadêmica';
      case 'VACATION':
         return 'Férias';
      case 'HOLIDAY':
         return 'Feriado';
      case 'EXAM':
         return 'Exame';
      case 'PARADE':
         return 'Parada';
      default:
         return type;
   }
};

export const formatTrainingField = (field?: string): string => {
   if (!field) return '-';
   switch (field.toUpperCase()) {
      case 'GERAL':
         return 'Geral';
      case 'MILITAR':
         return 'Militar';
      case 'PROFISSIONAL':
         return 'Profissional';
      case 'ATIVIDADES_COMPLEMENTARES':
         return 'Atividades Complementares';
      default:
         return field;
   }
};
export const formatOccurrenceType = (type?: string): string => {
   if (!type) return 'Ocorrência';
   switch (type.toUpperCase()) {
      case 'FALTA':
         return 'Falta';
      case 'ATRASO':
         return 'Atraso';
      case 'INDISPONIBILIDADE':
         return 'Indisponibilidade';
      default:
         return type;
   }
};
