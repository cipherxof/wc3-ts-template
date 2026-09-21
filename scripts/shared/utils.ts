import * as path from "@std/path";

export function toArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  return Uint8Array.from(buffer).buffer;
}

export function getFilesInDirectory(dir: string): string[] {
  return Array.from(Deno.readDirSync(dir), entry => entry.name).sort().flatMap(file => {
    const filename = path.join(dir, file);
    return Deno.lstatSync(filename).isDirectory ? getFilesInDirectory(filename) : [filename];
  });
}

function log(level: "info" | "error", message: string): void {
  const line = `[${new Date().toISOString()}] ${level}: ${message}`;
  if (level === "error") console.error(line);
  else console.log(line);
  Deno.writeTextFileSync("project.log", line + "\n", { append: true });
}

export const logger = {
  info: (message: string) => log("info", message),
  error: (message: string) => log("error", message),
};

/** Deno commands do not throw on a nonzero exit status. */
export function runCommand(executable: string, args: string[]): void {
  const status = new Deno.Command(executable, {
    args, stdin: "inherit", stdout: "inherit", stderr: "inherit",
  }).outputSync();
  if (!status.success) throw new Error(`${executable} failed with exit code ${status.code}${status.signal ? ` (${status.signal})` : ""}.`);
}

export function runCli(action: () => void): void {
  try {
    action();
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    Deno.exitCode = 1;
  }
}
