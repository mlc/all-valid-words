import { createGunzip } from 'node:zlib';
import getStream from 'get-stream';
import type { Stream } from 'node:stream';

export const gunzip = (stream: Stream): Promise<string> => {
  const z = createGunzip();
  stream.pipe(z, { end: true });
  return getStream(z, { encoding: 'utf-8' });
};
