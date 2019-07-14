/* eslint-disable import/export */

declare module 'random-number-csprng' {
  export default function secureRandomNumber(
    minimum: number,
    maximum: number
  ): Promise<number>;
}

declare module 'weighted-random-object' {
  interface WeightedObject {
    weight: number;
  }

  export default function weightedRandomObject<T extends WeightedObject>(
    objects: Readonly<T[]>
  ): T;
}
