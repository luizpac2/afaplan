import { describe, it, expect } from 'vitest';
import {
  formatCourse,
  formatClassId,
  formatNoticeType,
  formatEvaluationType,
  formatEventType,
  formatTrainingField,
} from './formatters';

describe('formatters', () => {
  describe('formatCourse', () => {
    it('retorna "Av" para AVIATION', () => {
      expect(formatCourse('AVIATION')).toBe('Av');
    });

    it('retorna "Int" para INTENDANCY', () => {
      expect(formatCourse('INTENDANCY')).toBe('Int');
    });

    it('retorna "Inf" para INFANTRY', () => {
      expect(formatCourse('INFANTRY')).toBe('Inf');
    });

    it('retorna "Geral" para ALL', () => {
      expect(formatCourse('ALL')).toBe('Geral');
    });

    it('retorna "Geral" para undefined', () => {
      expect(formatCourse(undefined)).toBe('Geral');
    });

    it('retorna o valor original para código desconhecido', () => {
      expect(formatCourse('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('formatClassId', () => {
    it('retorna "Geral" para undefined', () => {
      expect(formatClassId(undefined)).toBe('Geral');
    });

    it('retorna "Geral" para ALL', () => {
      expect(formatClassId('ALL')).toBe('Geral');
    });

    it('formata prefixo COURSE:AVIATION', () => {
      expect(formatClassId('COURSE:AVIATION')).toBe('Todos (Av)');
    });

    it('formata esquadrão com sufixo ESQ', () => {
      expect(formatClassId('1ESQ')).toBe('1º Esq');
    });

    it('formata classe padrão como 1A', () => {
      expect(formatClassId('1A')).toBe('1A');
    });

    it('formata 1AVIATION como "1º Av"', () => {
      expect(formatClassId('1AVIATION')).toBe('1º Av');
    });
  });

  describe('formatNoticeType', () => {
    it('retorna "Urgente" para URGENT', () => {
      expect(formatNoticeType('URGENT')).toBe('Urgente');
    });

    it('retorna "Info" para INFO', () => {
      expect(formatNoticeType('INFO')).toBe('Info');
    });

    it('retorna o valor original para tipo desconhecido', () => {
      expect(formatNoticeType('CUSTOM')).toBe('CUSTOM');
    });
  });

  describe('formatEvaluationType', () => {
    it('retorna "Avaliação" para undefined', () => {
      expect(formatEvaluationType(undefined)).toBe('Avaliação');
    });

    it('retorna "Parcial" para PARTIAL', () => {
      expect(formatEvaluationType('PARTIAL')).toBe('Parcial');
    });

    it('retorna "Exame" para EXAM', () => {
      expect(formatEvaluationType('EXAM')).toBe('Exame');
    });

    it('retorna "2ª Época" para SECOND_CHANCE', () => {
      expect(formatEvaluationType('SECOND_CHANCE')).toBe('2ª Época');
    });

    it('é case-insensitive', () => {
      expect(formatEvaluationType('partial')).toBe('Parcial');
    });
  });

  describe('formatEventType', () => {
    it('retorna "Aula" para undefined', () => {
      expect(formatEventType(undefined)).toBe('Aula');
    });

    it('retorna "Aula" para CLASS', () => {
      expect(formatEventType('CLASS')).toBe('Aula');
    });

    it('retorna "Avaliação" para EVALUATION', () => {
      expect(formatEventType('EVALUATION')).toBe('Avaliação');
    });

    it('retorna "Feriado" para HOLIDAY', () => {
      expect(formatEventType('HOLIDAY')).toBe('Feriado');
    });
  });

  describe('formatTrainingField', () => {
    it('retorna "-" para undefined', () => {
      expect(formatTrainingField(undefined)).toBe('-');
    });

    it('retorna "Geral" para GERAL', () => {
      expect(formatTrainingField('GERAL')).toBe('Geral');
    });

    it('retorna "Atividades Complementares" para ATIVIDADES_COMPLEMENTARES', () => {
      expect(formatTrainingField('ATIVIDADES_COMPLEMENTARES')).toBe('Atividades Complementares');
    });
  });
});
