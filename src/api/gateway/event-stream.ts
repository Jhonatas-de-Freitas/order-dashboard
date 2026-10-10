export interface ServerSentEvent {
  type: string;
  data: string;
}

/**
 * Reads `text/event-stream` as it arrives. EventSource would do this for free, but it
 * cannot send an Authorization header, so the stream is read with fetch instead.
 * Returns the function to feed with each chunk of text.
 */
export function eventStreamParser(onEvent: (event: ServerSentEvent) => void) {
  let pending = '';
  let type = '';
  let data: string[] = [];

  const readLine = (line: string) => {
    if (line === '') {
      if (data.length > 0) onEvent({ type: type || 'message', data: data.join('\n') });
      type = '';
      data = [];
      return;
    }
    // A line starting with a colon is a comment: the keep-alive the server sends.
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') type = value;
    else if (field === 'data') data.push(value);
  };

  return (chunk: string) => {
    pending += chunk;
    // A lone \r at the very end may be half of a \r\n: it waits for the next chunk.
    const lines = pending.split(/\r\n|\n|\r(?=[^])/);
    pending = lines.pop() ?? '';
    lines.forEach(readLine);
  };
}
