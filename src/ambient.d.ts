// ============================================================================
//  Ambient module declarations for third-party packages that ship no types.
//  Required so `tsc --noEmit` (strict / noImplicitAny) passes. At runtime, Vite
//  resolves these via esbuild / the package `module`/`main` fields.
// ============================================================================

declare module 'arabic-reshaper' {
  // CJS module: `module.exports` is an object exposing `convertArabic`.
  const resh: {
    convertArabic(text: string): string;
    convertArabicBack(text: string): string;
  };
  export default resh;
}

declare module 'bidi-js' {
  // ESM build: default export is a factory you must invoke to get an engine.
  interface BidiEngine {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): {
      levels: Uint8Array;
      paragraphs: Array<{ start: number; end: number; level: number }>;
    };
    getReorderedString(text: string, embeddingLevels: unknown, start?: number, end?: number): string;
  }
  export default function bidiFactory(): BidiEngine;
}
