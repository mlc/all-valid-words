/* eslint-disable import/export */

declare module 'random-number-csprng' {
  export default function secureRandomNumber(
    minimum: number,
    maximum: number
  ): Promise<number>;
}
