/** Canonical JSON serialization for signing */
function sortRec(value: any): any {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(sortRec);
  if (typeof value === 'object') {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const v = sortRec(value[key]);
      if (v !== undefined) sorted[key] = v;
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: any): string {
  return JSON.stringify(sortRec(value));
}

export function toBase64Url(data: Uint8Array | ArrayBuffer | Buffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const withPad = padded + '='.repeat(padLength);
  return new Uint8Array(Buffer.from(withPad, 'base64'));
}
