import type { AuditLogEntry } from '../types/auditLog';
import emailjs from '@emailjs/browser';

// EmailJS Configuration — carregado de variáveis de ambiente (.env.local)
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;
const TARGET_EMAIL = import.meta.env.VITE_EMAILJS_TARGET_EMAIL as string;

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

const getActionLabel = (action: string): string => {
    switch (action) {
        case 'ADD': return 'Criação';
        case 'UPDATE': return 'Atualização';
        case 'DELETE': return 'Exclusão';
        default: return action;
    }
};

const getEntityLabel = (entity: string): string => {
    switch (entity) {
        case 'DISCIPLINE': return 'Disciplina';
        case 'EVENT': return 'Evento';
        case 'CLASS': return 'Turma';
        case 'COHORT': return 'Coorte';
        default: return entity;
    }
};

export const sendAuditEmail = async (log: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const actionLabel = getActionLabel(log.action);
    const entityLabel = getEntityLabel(log.entity);

    const subject = `[AFA Plan] ${actionLabel} de ${entityLabel}: ${log.entityName || log.entityId}`;

    let details = `Usuário: ${log.user}\nData/Hora: ${timestamp}\nAção: ${actionLabel}\nEntidade: ${entityLabel}\nNome: ${log.entityName || log.entityId}`;

    if (log.changes) {
        if (log.changes.before) {
            details += `\n\nAntes:\n${JSON.stringify(log.changes.before, null, 2)}`;
        }
        if (log.changes.after) {
            details += `\n\nDepois:\n${JSON.stringify(log.changes.after, null, 2)}`;
        }
    }

    try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: TARGET_EMAIL,
            subject: subject,
            message: details,
        });
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('❌ Erro ao enviar e-mail:', error);
        }
    }
};
