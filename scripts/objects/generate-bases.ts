import * as path from "@std/path";
import { Units, Items, Abilities } from "war3-objectdata-th";

function cleanIdentifier(name: string): string {
  // Ensure valid Pkl identifier (cannot start with a digit, remove invalid chars)
  let clean = name.replace(/[^a-zA-Z0-9_]/g, "");
  if (/^[0-9]/.test(clean)) {
    clean = "_" + clean;
  }
  return clean;
}

function generateBasesPkl(): string {
  const unitEntries = Object.entries(Units as Record<string, string>);
  const itemEntries = Object.entries(Items as Record<string, string>);
  const abilityEntries = Object.entries(Abilities as Record<string, string>);

  // Unique rawcodes
  const unitRawcodes = Array.from(new Set(unitEntries.map(([, v]) => v))).sort();
  const itemRawcodes = Array.from(new Set(itemEntries.map(([, v]) => v))).sort();
  const abilityRawcodes = Array.from(new Set(abilityEntries.map(([, v]) => v))).sort();

  const lines: string[] = [];
  lines.push("/// Generated Warcraft III Base Object IDs and Constants");
  lines.push("/// Run `deno task bases:gen` to regenerate.");
  lines.push("module wc3.bases");
  lines.push("");

  // BaseUnitId typealias
  lines.push("typealias BaseUnitId =");
  unitRawcodes.forEach((code, i) => {
    const isLast = i === unitRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : " |"}`);
  });
  lines.push("");

  // BaseItemId typealias
  lines.push("typealias BaseItemId =");
  itemRawcodes.forEach((code, i) => {
    const isLast = i === itemRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : " |"}`);
  });
  lines.push("");

  // BaseAbilityId typealias
  lines.push("typealias BaseAbilityId =");
  abilityRawcodes.forEach((code, i) => {
    const isLast = i === abilityRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : " |"}`);
  });
  lines.push("");

  // Sets for collision checking
  lines.push("const StandardUnitIds: Set<String> = Set(");
  unitRawcodes.forEach((code, i) => {
    const isLast = i === unitRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : ","}`);
  });
  lines.push(")");
  lines.push("");

  lines.push("const StandardItemIds: Set<String> = Set(");
  itemRawcodes.forEach((code, i) => {
    const isLast = i === itemRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : ","}`);
  });
  lines.push(")");
  lines.push("");

  lines.push("const StandardAbilityIds: Set<String> = Set(");
  abilityRawcodes.forEach((code, i) => {
    const isLast = i === abilityRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : ","}`);
  });
  lines.push(")");
  lines.push("");

  const allRawcodes = Array.from(new Set([...unitRawcodes, ...itemRawcodes, ...abilityRawcodes])).sort();
  lines.push("const AllStandardIds: Set<String> = Set(");
  allRawcodes.forEach((code, i) => {
    const isLast = i === allRawcodes.length - 1;
    lines.push(`  "${code}"${isLast ? "" : ","}`);
  });
  lines.push(")");
  lines.push("");

  // Friendly Named Constants for autocompletion
  lines.push("class UnitConstants {");
  const seenUnitNames = new Set<string>();
  unitEntries.forEach(([name, code]) => {
    const ident = cleanIdentifier(name);
    if (!seenUnitNames.has(ident)) {
      seenUnitNames.add(ident);
      lines.push(`  ${ident}: BaseUnitId = "${code}"`);
    }
  });
  lines.push("}");
  lines.push("");

  lines.push("class ItemConstants {");
  const seenItemNames = new Set<string>();
  itemEntries.forEach(([name, code]) => {
    const ident = cleanIdentifier(name);
    if (!seenItemNames.has(ident)) {
      seenItemNames.add(ident);
      lines.push(`  ${ident}: BaseItemId = "${code}"`);
    }
  });
  lines.push("}");
  lines.push("");

  lines.push("class AbilityConstants {");
  const seenAbilityNames = new Set<string>();
  abilityEntries.forEach(([name, code]) => {
    const ident = cleanIdentifier(name);
    if (!seenAbilityNames.has(ident)) {
      seenAbilityNames.add(ident);
      lines.push(`  ${ident}: BaseAbilityId = "${code}"`);
    }
  });
  lines.push("}");
  lines.push("");

  lines.push("Units: UnitConstants = new {}");
  lines.push("Items: ItemConstants = new {}");
  lines.push("Abilities: AbilityConstants = new {}");
  lines.push("");

  return lines.join("\n");
}

const outputPath = path.resolve("objects/bases.pkl");
Deno.writeTextFileSync(outputPath, generateBasesPkl());
console.log(`Generated ${outputPath}`);
