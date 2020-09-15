import { randomBytes } from 'crypto';
import { promisify } from 'util';

const pRandomBytes = promisify(randomBytes);

const MAX_U48 = 2 ** 48;

const randomInt = async (): Promise<number> => {
  const buf = await pRandomBytes(6);
  return buf.readUIntLE(0, 6);
};

const randomNumber = async (max: number) => {
  if (max <= 0 || max >= MAX_U48 || !Number.isInteger(max)) {
    throw new Error('invalid max');
  }

  const maxSafe = MAX_U48 - ((MAX_U48 % max) + 1);
  let n;
  do {
    // eslint-disable-next-line no-await-in-loop
    n = await randomInt();
  } while (n > maxSafe);

  return n % max;
};

export default randomNumber;