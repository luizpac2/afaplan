import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Componente que propositalmente lança erro
const BrokenComponent = () => {
  throw new Error('Erro de teste proposital');
};

// Suprime logs de erro do React durante os testes
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renderiza filhos quando não há erro', () => {
    render(
      <ErrorBoundary>
        <div>Conteúdo normal</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Conteúdo normal')).toBeInTheDocument();
  });

  it('exibe UI de fallback quando filho lança erro', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.getByText('Erro de teste proposital')).toBeInTheDocument();
  });

  it('exibe botões de ação no fallback', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
    expect(screen.getByText('Recarregar página')).toBeInTheDocument();
  });

  it('renderiza fallback customizado quando fornecido', () => {
    render(
      <ErrorBoundary fallback={<div>Erro customizado</div>}>
        <BrokenComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Erro customizado')).toBeInTheDocument();
  });

  it('reseta o estado de erro ao clicar em "Tentar novamente"', () => {
    let shouldThrow = true;
    const ConditionalError = () => {
      if (shouldThrow) throw new Error('Erro');
      return <div>Recuperado</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Tentar novamente'));

    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Recuperado')).toBeInTheDocument();
  });
});
