import { createGunzip } from 'zlib';
import getStream from 'get-stream';

export const gunzip = (stream: NodeJS.ReadableStream): Promise<string> => {
  const z = createGunzip();
  stream.pipe(z, { end: true });
  return getStream(z);
};
