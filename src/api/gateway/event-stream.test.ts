import { describe, expect, it } from 'vitest';
import { eventStreamParser, type ServerSentEvent } from './event-stream';

function parsing(...chunks: string[]): ServerSentEvent[] {
  const events: ServerSentEvent[] = [];
  const feed = eventStreamParser((event) => events.push(event));
  chunks.forEach(feed);
  return events;
}

describe('eventStreamParser', () => {
  it('readsANamedEventWithItsData', () => {
    expect(parsing('event: order-updated\ndata: {"id":"1"}\n\n')).toEqual([
      { type: 'order-updated', data: '{"id":"1"}' },
    ]);
  });

  it('waitsForTheBlankLineBeforeDeliveringAnEvent', () => {
    expect(parsing('event: order-updated\ndata: {"id":"1"}\n')).toEqual([]);
  });

  it('putsTogetherAnEventThatArrivesInPieces', () => {
    expect(parsing('event: order-up', 'dated\nda', 'ta: {"id"', ':"1"}\n', '\n')).toEqual([
      { type: 'order-updated', data: '{"id":"1"}' },
    ]);
  });

  it('skipsKeepAliveComments', () => {
    expect(parsing(': keep-alive\n\n', 'data: a\n\n', ':\n\n')).toEqual([
      { type: 'message', data: 'a' },
    ]);
  });

  it('joinsSeveralDataLinesWithALineBreak', () => {
    expect(parsing('data: first\ndata: second\n\n')).toEqual([
      { type: 'message', data: 'first\nsecond' },
    ]);
  });

  it('acceptsCarriageReturnLineEndingsEvenSplitBetweenChunks', () => {
    expect(parsing('event: order-updated\r', '\ndata: a\r\n\r\n', 'data: b\r\r')).toEqual([
      { type: 'order-updated', data: 'a' },
    ]);
    expect(parsing('data: b\r\r', 'data: c\r\r', ':\r')).toEqual([
      { type: 'message', data: 'b' },
      { type: 'message', data: 'c' },
    ]);
  });

  it('ignoresFieldsItDoesNotUse', () => {
    expect(parsing('id: 7\nretry: 3000\nevent: order-updated\ndata:a\n\n')).toEqual([
      { type: 'order-updated', data: 'a' },
    ]);
  });
});
