import { existsSync } from "@std/fs";
import * as path from "@std/path";
import { loadProjectConfig } from "../shared/config.ts";

export interface ValidationResult {
  file: string;
  valid: boolean;
  error?: string;
}

export function validateJsonSyntax(filePath: string): ValidationResult {
  try {
    const content = Deno.readTextFileSync(filePath);
    JSON.parse(content);
    return { file: filePath, valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { file: filePath, valid: false, error: message };
  }
}

export function validateProjectJsonFiles(rootDir = Deno.cwd()): ValidationResult[] {
  const filesToCheck = [
    "config.json",
    "deno.json",
    "package.json",
    "tsconfig.json",
  ];

  const localConfig = path.join(rootDir, "config.local.json");
  if (existsSync(localConfig)) {
    filesToCheck.push("config.local.json");
  }

  const results: ValidationResult[] = [];
  for (const relativePath of filesToCheck) {
    const fullPath = path.join(rootDir, relativePath);
    if (existsSync(fullPath)) {
      results.push(validateJsonSyntax(fullPath));
    }
  }

  return results;
}

export function runValidation(rootDir = Deno.cwd()): boolean {
  console.log("Validating JSON configuration files...");
  const jsonResults = validateProjectJsonFiles(rootDir);
  let hasErrors = false;

  for (const result of jsonResults) {
    if (result.valid) {
      console.log(`  [OK] ${path.relative(rootDir, result.file)}`);
    } else {
      console.error(`  [FAIL] ${path.relative(rootDir, result.file)}: ${result.error}`);
      hasErrors = true;
    }
  }

  console.log("Validating project configuration schema (config.json / config.local.json)...");
  try {
    const config = loadProjectConfig(rootDir);
    console.log(`  [OK] Project config valid (mapFolder: "${config.mapFolder}", executable: "${config.gameExecutable}")`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  [FAIL] Configuration schema error: ${message}`);
    hasErrors = true;
  }

  return !hasErrors;
}

if (import.meta.main) {
  const success = runValidation();
  if (!success) {
    Deno.exit(1);
  }
}
