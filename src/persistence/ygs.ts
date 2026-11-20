import type { YgsDocument } from '../core/model';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export async function encodeYgs(document: YgsDocument): Promise<Blob> {
  const payload = encoder.encode(JSON.stringify(document));
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const checksum = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
  const envelope = { magic: 'YGS2', schemaVersion: 2, checksum, payload: [...payload] };
  return new Blob([JSON.stringify(envelope)], { type: 'application/vnd.yutugs.ygs+json' });
}
export async function decodeYgs(blob: Blob): Promise<YgsDocument> {
  const envelope = JSON.parse(await blob.text()) as { magic: string; schemaVersion: number; checksum: string; payload: number[] };
  if (envelope.magic !== 'YGS2' || envelope.schemaVersion !== 2) throw new Error('Unsupported YGS document version');
  const payload = new Uint8Array(envelope.payload);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  const checksum = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (checksum !== envelope.checksum) throw new Error('YGS integrity check failed');
  const document = JSON.parse(decoder.decode(payload)) as YgsDocument;
  if (document.magic !== 'YGS2' || document.schemaVersion !== 2) throw new Error('Invalid YGS payload');
  return document;
}
