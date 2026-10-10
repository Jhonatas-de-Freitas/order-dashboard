import { isApiError } from '../api/store-api';

export interface ErrorMessage {
  title: string;
  message: string;
}

/** What to tell the person, by kind of failure. Never the raw technical text. */
export function describeError(error: unknown): ErrorMessage {
  if (!isApiError(error)) {
    return {
      title: 'Sem resposta do servidor',
      message: 'Confira a sua conexão e tente de novo.',
    };
  }
  switch (error.status) {
    case 400:
      return {
        title: 'Pedido inválido',
        message:
          error.problem.errors?.map(({ message }) => message).join('; ') ??
          'Os dados enviados não foram aceitos.',
      };
    case 401:
      return { title: 'Sessão encerrada', message: 'Entre de novo para continuar.' };
    case 403:
      return { title: 'Sem acesso', message: 'O seu usuário não tem permissão para ver isto.' };
    case 404:
      return { title: 'Não encontrado', message: 'O que você procura não existe ou foi removido.' };
    case 429:
      return {
        title: 'Muitas requisições em pouco tempo',
        message: 'O limite foi atingido. Espere alguns segundos e tente de novo.',
      };
    case 503:
      return {
        title: 'Serviço fora do ar',
        message: 'Uma parte do sistema não respondeu. Tente de novo em instantes.',
      };
    default:
      return {
        title: 'Algo deu errado',
        message: 'O servidor respondeu com um erro. Tente de novo.',
      };
  }
}
