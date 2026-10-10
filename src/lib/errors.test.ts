import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/store-api';
import { describeError } from './errors';

describe('describeError', () => {
  const failure = (status: number, errors?: { field: string; message: string }[]) =>
    new ApiError({ title: 'Error', status, detail: 'detalhe técnico', errors });

  it('hasItsOwnWordsForEachStatusTheGatewayAnswers', () => {
    expect(describeError(failure(401)).title).toBe('Sessão encerrada');
    expect(describeError(failure(403)).title).toBe('Sem acesso');
    expect(describeError(failure(404)).title).toBe('Não encontrado');
    expect(describeError(failure(429)).title).toBe('Muitas requisições em pouco tempo');
    expect(describeError(failure(503)).title).toBe('Serviço fora do ar');
    expect(describeError(failure(500)).title).toBe('Algo deu errado');
  });

  it('listsTheFieldsOfAValidationError', () => {
    const error = failure(400, [
      { field: 'items', message: 'deve ter de 1 a 20 itens' },
      { field: 'customerEmail', message: 'deve ser um e-mail válido' },
    ]);
    expect(describeError(error).message).toBe(
      'deve ter de 1 a 20 itens; deve ser um e-mail válido',
    );
  });

  it('treatsAnythingElseAsNoAnswerFromTheServer', () => {
    expect(describeError(new TypeError('Failed to fetch')).title).toBe('Sem resposta do servidor');
  });

  it('neverShowsTheTechnicalDetail', () => {
    for (const status of [401, 403, 404, 429, 500, 503]) {
      const { title, message } = describeError(failure(status));
      expect(title + message).not.toContain('detalhe técnico');
    }
  });
});
