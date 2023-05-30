import { createGunzip } from 'node:zlib';

export const gunzip = async (stream: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve, reject) => {
    const z = createGunzip();
    const chunks: string[] = [];
    z.setEncoding('utf-8');
    z.on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve(chunks.join('')))
      .on('error', (e) => reject(e));
    stream.pipe(z, { end: true });
  });
