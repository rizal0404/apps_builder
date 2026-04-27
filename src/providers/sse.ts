/**
 * Minimal Server-Sent Events parser. Yields the textual `data:` payload for each event.
 * Comment lines (starting with `:`) and `event:` / `id:` lines are ignored.
 */

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = event
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''));
      if (dataLines.length === 0) continue;
      yield dataLines.join('\n');
    }
  }
  if (buffer.trim().length) {
    const dataLines = buffer
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''));
    if (dataLines.length) yield dataLines.join('\n');
  }
}
