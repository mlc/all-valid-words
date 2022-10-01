import { randomBytes } from 'crypto';
import { promisify } from 'util';

export const pRandomBytes = promisify(randomBytes);

const MAX_U48 = 2 ** 48;

const randomInt = async (): Promise<number> => {
  const buf = await pRandomBytes(6);
  return buf.readUIntLE(0, 6);
};

export const randomNumber = async (max: number): Promise<number> => {
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

export interface Weighted {
  weight: number;
}

export const weightedRandom = async <T extends Weighted>(
  objects: readonly T[]
): Promise<T> => {
  const totalWeight = objects.reduce((a, { weight }) => a + weight, 0);
  const targetWeight = await randomNumber(totalWeight);
  let weightSum = 0;
  const result = objects.find(({ weight }) => {
    weightSum += weight;
    return targetWeight <= weightSum;
  });
  if (!result) {
    throw new Error("couldn't get object");
  }
  return result;
};
