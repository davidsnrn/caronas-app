/* /// <reference types="vite/client" /> */

interface ImportMetaEnv {
  readonly VITE_BASE_PATH: string;
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
