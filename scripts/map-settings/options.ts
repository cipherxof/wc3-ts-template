export interface PlayerOptions { name?: string; controller?: string; race?: string; fixedStart?: boolean; x?: number; y?: number }
export interface ForceOptions { name?: string; allied?: boolean; alliedVictory?: boolean; sharedVision?: boolean; sharedControl?: boolean; sharedAdvancedControl?: boolean }
export interface EnvironmentOptions { soundEnvironment?: string; waterColor?: number[]; fog?: { enabled?: boolean; style?: number; start?: number; end?: number; density?: number; color?: number[] } }
export const controllers = ["", "user", "computer", "neutral", "rescuable"];
export const races = ["selectable", "human", "orc", "undead", "nightelf"];
export const forceBits = { allied: 1, alliedVictory: 2, sharedVision: 8, sharedControl: 16, sharedAdvancedControl: 32 };
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return { ...value } as Record<string, unknown>;
}
function fields(value: unknown, label: string, rules: Record<string, (v: unknown) => boolean>): Record<string, unknown> {
  const result = object(value, label);
  for (const [key, v] of Object.entries(result)) {
    if (!Object.hasOwn(rules, key)) throw new Error(`Unknown map setting: ${label}.${key}`);
    if (v === null) { delete result[key]; continue; }
    if (!rules[key](v)) throw new Error(`Invalid map setting: ${label}.${key}`);
  }
  return result;
}
const text = (v: unknown) => typeof v === "string" && !v.includes("\0");
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7;
const bool = (v: unknown) => typeof v === "boolean";
const color = (v: unknown) => Array.isArray(v) && v.length === 4 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
export function extendedOptions(config: Record<string, unknown>) {
  function indexed<T>(group: string, rules: Record<string, (v: unknown) => boolean>): Record<string, T> {
    const entries = object(config[group] ?? {}, group);
    const result: Record<string, T> = {};
    for (const [id, value] of Object.entries(entries)) {
      if (!/^(0|[1-9][0-9]?)$/.test(id) || +id > 23) throw new Error(`${group} keys must be IDs from 0 to 23.`);
      const parsed = fields(value, `${group}.${id}`, rules);
      if (Object.keys(parsed).length) result[id] = parsed as T;
    }
    return result;
  }
  const players = indexed<PlayerOptions>("players", { name: text, controller: v => controllers.slice(1).includes(v as string), race: v => races.includes(v as string), fixedStart: bool, x: number, y: number });
  const forces = indexed<ForceOptions>("forces", { name: text, ...Object.fromEntries(Object.keys(forceBits).map(k => [k, bool])) });
  const environment = fields(config.environment ?? {}, "environment", { soundEnvironment: text, waterColor: color, fog: v => !!v && typeof v === "object" && !Array.isArray(v) }) as EnvironmentOptions;
  if (environment.fog) {
    environment.fog = fields(environment.fog, "environment.fog", { enabled: bool, style: v => [0, 1, 2].includes(v as number), start: number, end: number, density: v => number(v) && (v as number) >= 0 && (v as number) <= 1, color }) as NonNullable<EnvironmentOptions["fog"]>;
    if (!Object.keys(environment.fog).length) delete environment.fog;
  }
  const gameplay = fields(config.gameplay ?? {}, "gameplay", { heroMaxLevel: v => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10000, foodLimit: v => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 300 });
  return { players, forces, environment, gameplay };
}
