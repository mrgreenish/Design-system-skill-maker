/**
 * Backward-compatibility shim.
 * All logic has moved to tokens-build.ts; this file re-exports everything
 * so existing imports (tests, direct invocations) continue to work.
 */
export {
  emit,
  emitCss,
  emitScss,
  cssVarName,
  spliceGenerated,
  detectOutputFormats,
  run,
  BEGIN,
  END,
  type EmitResult,
  type OutputFormat,
  type OutputPaths,
} from "./tokens-build.ts";
