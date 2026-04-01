import { describe, it, expect } from 'vitest';
import {
  getStartOfWeek,
  addDays,
  formatDate,
  createDateFromISO,
  formatDateForDisplay,
  getWeekDays,
  getWeekNumber,
} from './dateUtils';

describe('dateUtils', () => {
  describe('getStartOfWeek', () => {
    it('retorna segunda-feira para uma quarta-feira', () => {
      const wednesday = new Date(2026, 2, 25); // 25 Mar 2026 (Wed)
      const result = getStartOfWeek(wednesday);
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(23);
    });

    it('retorna segunda-feira anterior para domingo', () => {
      const sunday = new Date(2026, 2, 29); // 29 Mar 2026 (Sun)
      const result = getStartOfWeek(sunday);
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(23);
    });

    it('retorna a própria segunda-feira quando o dia já é segunda', () => {
      const monday = new Date(2026, 2, 23); // 23 Mar 2026 (Mon)
      const result = getStartOfWeek(monday);
      expect(result.getDate()).toBe(23);
    });
  });

  describe('addDays', () => {
    it('adiciona dias corretamente', () => {
      const date = new Date(2026, 2, 1);
      const result = addDays(date, 5);
      expect(result.getDate()).toBe(6);
    });

    it('não modifica o objeto original', () => {
      const date = new Date(2026, 2, 1);
      addDays(date, 5);
      expect(date.getDate()).toBe(1);
    });

    it('cruza mês corretamente', () => {
      const date = new Date(2026, 2, 30); // 30 Mar
      const result = addDays(date, 3);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(2);
    });

    it('subtrai dias com valor negativo', () => {
      const date = new Date(2026, 2, 10);
      const result = addDays(date, -3);
      expect(result.getDate()).toBe(7);
    });
  });

  describe('formatDate', () => {
    it('formata data no padrão YYYY-MM-DD', () => {
      const date = new Date(2026, 0, 5); // 5 Jan 2026
      expect(formatDate(date)).toBe('2026-01-05');
    });

    it('adiciona zero na frente de mês/dia < 10', () => {
      const date = new Date(2026, 2, 9); // 9 Mar 2026
      expect(formatDate(date)).toBe('2026-03-09');
    });

    it('formata dezembro corretamente', () => {
      const date = new Date(2026, 11, 31);
      expect(formatDate(date)).toBe('2026-12-31');
    });
  });

  describe('createDateFromISO', () => {
    it('cria data correta a partir de string ISO', () => {
      const date = createDateFromISO('2026-03-25');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(date.getDate()).toBe(25);
    });

    it('retorna Data inválida para string vazia', () => {
      const date = createDateFromISO('');
      expect(isNaN(date.getTime())).toBe(true);
    });

    it('retorna Data inválida para formato incorreto', () => {
      const date = createDateFromISO('25/03/2026');
      expect(isNaN(date.getTime())).toBe(true);
    });
  });

  describe('formatDateForDisplay', () => {
    it('retorna string vazia para input vazio', () => {
      expect(formatDateForDisplay('')).toBe('');
    });

    it('formata data no padrão pt-BR', () => {
      const result = formatDateForDisplay('2026-03-25');
      // dd/mm/yyyy no pt-BR
      expect(result).toBe('25/03/2026');
    });
  });

  describe('getWeekDays', () => {
    it('retorna 6 dias a partir de segunda', () => {
      const monday = new Date(2026, 2, 23);
      const days = getWeekDays(monday);
      expect(days).toHaveLength(6);
      expect(days[0].getDay()).toBe(1); // Mon
      expect(days[5].getDay()).toBe(6); // Sat
    });
  });

  describe('getWeekNumber', () => {
    it('retorna número correto da semana', () => {
      const date = new Date(2026, 0, 5); // 5 Jan 2026
      expect(getWeekNumber(date)).toBe(2);
    });

    it('1 de janeiro pode ser semana 1', () => {
      const date = new Date(2026, 0, 1);
      const week = getWeekNumber(date);
      expect(week).toBeGreaterThan(0);
    });
  });
});
