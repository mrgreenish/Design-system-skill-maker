#!/usr/bin/env node
// SessionStart hook. If figma-map.json exists in the project root, prints a
// one-line reminder so Claude knows a design system is active. Never blocks
// session start.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..", "..");

if (existsSync(resolve(REPO, "figma-map.json"))) {
  console.error(
    "[ds:session-start] Design system active. Skills available: figma-to-code-design-system, code-to-figma-design-system",
  );
}

process.exit(0);
