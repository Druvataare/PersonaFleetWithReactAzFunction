/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS?: string;
  /** Shows the guided tour button. Off until the script is rewritten. */
  readonly VITE_SHOW_TOUR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
