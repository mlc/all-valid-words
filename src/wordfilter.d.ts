declare module 'wordfilter' {
  export function blacklisted(string: string): boolean;
  export function addWords(array: string | ReadonlyArray<string>): void;
  export function removeWord(word: string): void;
  export function clearList(): void;
}
