import { randomBytes, randomInt } from 'node:crypto';
import { promisify } from 'node:util';

export const pRandomBytes: (size: number) => Promise<Buffer> =
  promisify(randomBytes);

export interface Weighted {
  weight: number;
}

export const weightedRandom = <T extends Weighted>(
  objects: readonly T[]
): T => {
  const totalWeight = objects.reduce((a, { weight }) => a + weight, 0);
  const targetWeight = randomInt(totalWeight);
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
