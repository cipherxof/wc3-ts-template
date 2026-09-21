import { runCli, runCommand } from "../shared/utils.ts";

export function evaluateObjects(): void {
  Deno.mkdirSync("src/generated", { recursive: true });
  const executable = Deno.env.get("PKL_EXECUTABLE") || "pkl";
  try {
    runCommand(executable, [
      "eval", "-f", "json", "objects/objects.pkl", "-o", "src/generated/objects.json",
    ]);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Pkl executable '${executable}' was not found. Install the Pkl CLI and add it to PATH or set PKL_EXECUTABLE to its full path. See docs/installation.md.`, { cause: error });
    }
    throw error;
  }
}

if (import.meta.main) runCli(evaluateObjects);
