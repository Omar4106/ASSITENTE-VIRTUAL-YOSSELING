declare module 'btch-downloader' {
  export function youtube(url: string): Promise<unknown>;
  export function igdl(url: string): Promise<unknown>;
  export function ttdl(url: string): Promise<unknown>;
  export function twitter(url: string): Promise<unknown>;
  export function fbdown(url: string): Promise<unknown>;
  export function aio(url: string): Promise<unknown>;
  const _default: {
    youtube: typeof youtube;
    igdl: typeof igdl;
    ttdl: typeof ttdl;
    twitter: typeof twitter;
    fbdown: typeof fbdown;
    aio: typeof aio;
  };
  export default _default;
}
