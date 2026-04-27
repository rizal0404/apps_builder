/** Tiny crypto-strong id generator. Falls back to a reduced-entropy variant if unavailable. */
export function generateId(prefix = ''): string {
  const buf = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  let hex = '';
  for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16).padStart(2, '0');
  return prefix ? `${prefix}_${hex}` : hex;
}
