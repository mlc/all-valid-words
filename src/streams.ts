import { createGunzip } from 'zlib';

export const consume = (stream: NodeJS.ReadableStream): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const bufs: Buffer[] = [];
    stream.on('data', (d) => bufs.push(d));
    stream.on('end', () => resolve(Buffer.concat(bufs)));
    stream.once('error', (e) => reject(e));
  });

export const gunzip = (stream: NodeJS.ReadableStream): Promise<string> => {
  const z = createGunzip();
  stream.pipe(z, { end: true });
  return consume(z).then((buf) => buf.toString('utf-8'));
};
