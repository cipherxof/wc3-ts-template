import * as path from "@std/path";
import { friendlyPropertyName } from "./data.ts";
import { UnitProps } from "war3-objectdata-th/dist/cjs/generated/units.js";
import { ItemProps } from "war3-objectdata-th/dist/cjs/generated/items.js";
import { AbilityProps } from "war3-objectdata-th/dist/cjs/generated/abilities.js";
import { BuffProps } from "war3-objectdata-th/dist/cjs/generated/buffs.js";
import { UpgradeProps } from "war3-objectdata-th/dist/cjs/generated/upgrades.js";

interface RawProp {
  id: string;
  name: string;
  type: string;
  netsafe?: string;
}

function mapTypeToPkl(type: string): string {
  switch (type) {
    case "int":
      return "Int?";
    case "real":
    case "unreal":
      return "Number?";
    case "bool":
      return "Boolean?";
    case "stringList":
    case "unitList":
    case "itemList":
    case "techList":
    case "intList":
    case "upgradeList":
    case "modelList":
    case "abilityList":
    case "heroAbilityList":
    case "pathingListPrevent":
    case "pathingListRequire":
    case "tilesetList":
    case "targetList":
    case "abilitySkinList":
      return "List<String>?";
    default:
      return "String?";
  }
}

const PKL_KEYWORDS = new Set([
  "class", "module", "import", "extends", "open", "local", "hidden",
  "typealias", "function", "this", "super", "new", "if", "else", "when",
  "for", "in", "is", "as", "let", "throw", "trace", "read", "null", "true", "false"
]);

function cleanPropName(name: string): string {
  name = friendlyPropertyName(name);
  if (PKL_KEYWORDS.has(name)) {
    return `\`${name}\``;
  }
  return name;
}

function generatePropsClass(
  moduleName: string,
  className: string,
  baseClassImport: string | null,
  baseClassName: string | null,
  props: RawProp[]
): string {
  const lines: string[] = [];
  lines.push(`/// Auto-generated Warcraft III properties from Blizzard metadata`);
  lines.push(`/// Run \`deno task schema:gen\` to regenerate.`);
  lines.push(`module ${moduleName}`);
  lines.push("");

  if (baseClassImport && baseClassName) {
    lines.push(`import "${baseClassImport}" as base`);
    lines.push("");
    lines.push(`open class ${className} extends base.${baseClassName} {`);
  } else {
    lines.push(`open class ${className} {`);
  }

  const seen = new Set<string>();
  for (const prop of props) {
    const cleanName = cleanPropName(prop.name);
    if (seen.has(cleanName)) continue;
    seen.add(cleanName);

    const pklType = mapTypeToPkl(prop.type);
    lines.push(`  /// Rawcode: \`${prop.id}\`, Engine type: \`${prop.type}\``);
    lines.push(`  ${cleanName}: ${pklType}`);
  }

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

const outDir = path.resolve("objects/schema/generated");
Deno.mkdirSync(outDir, { recursive: true });

// 1. Units props (240 properties)
const unitsContent = generatePropsClass(
  "wc3.schema.generated.units_props",
  "GeneratedUnitProps",
  "../common.pkl",
  "Wc3Object",
  UnitProps as RawProp[]
);
Deno.writeTextFileSync(path.join(outDir, "units_props.pkl"), unitsContent);
console.log(`Generated ${path.join(outDir, "units_props.pkl")} (${UnitProps.length} properties)`);

// 2. Items props (42 properties)
const itemsContent = generatePropsClass(
  "wc3.schema.generated.items_props",
  "GeneratedItemProps",
  "../common.pkl",
  "Wc3Object",
  ItemProps as RawProp[]
);
Deno.writeTextFileSync(path.join(outDir, "items_props.pkl"), itemsContent);
console.log(`Generated ${path.join(outDir, "items_props.pkl")} (${ItemProps.length} properties)`);

// 3. Abilities props (69 properties)
const abilitiesContent = generatePropsClass(
  "wc3.schema.generated.abilities_props",
  "GeneratedAbilityProps",
  "../common.pkl",
  "Wc3Object",
  AbilityProps as RawProp[]
);
Deno.writeTextFileSync(path.join(outDir, "abilities_props.pkl"), abilitiesContent);
console.log(`Generated ${path.join(outDir, "abilities_props.pkl")} (${AbilityProps.length} properties)`);

// 4. Buffs props (27 properties)
const buffsContent = generatePropsClass(
  "wc3.schema.generated.buffs_props",
  "GeneratedBuffProps",
  "../common.pkl",
  "Wc3Object",
  BuffProps as RawProp[]
);
Deno.writeTextFileSync(path.join(outDir, "buffs_props.pkl"), buffsContent);
console.log(`Generated ${path.join(outDir, "buffs_props.pkl")} (${BuffProps.length} properties)`);

// 5. Upgrades props (37 properties)
const upgradesContent = generatePropsClass(
  "wc3.schema.generated.upgrades_props",
  "GeneratedUpgradeProps",
  "../common.pkl",
  "Wc3Object",
  UpgradeProps as RawProp[]
);
Deno.writeTextFileSync(path.join(outDir, "upgrades_props.pkl"), upgradesContent);
console.log(`Generated ${path.join(outDir, "upgrades_props.pkl")} (${UpgradeProps.length} properties)`);
