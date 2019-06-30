/* eslint-disable import/export */

declare module 'node-gzip' {
  import { ZlibOptions } from 'zlib';

  type GzipInput = Buffer | NodeJS.TypedArray | DataView | ArrayBuffer | string;

  export function gzip(
    input: GzipInput,
    options?: ZlibOptions
  ): Promise<Buffer>;
  export function ungzip(
    input: GzipInput,
    options?: ZlibOptions
  ): Promise<Buffer>;
}

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
