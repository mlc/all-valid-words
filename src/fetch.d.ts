export {};

declare global {
  export const {
    fetch,
    FormData,
    Headers,
    Request,
    Response,
  }: typeof import('undici');
}
