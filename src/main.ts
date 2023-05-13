import { Item, Timer, Unit } from "w3ts";
import { Players } from "w3ts/globals";
import { W3TS_HOOK, addScriptHook } from "w3ts/hooks";
import { Units } from "@objectdata/constants/units"

import { Items } from "@objectdata/constants/items"
import { UnitContainer } from "@objectdata/units";

import * as CompileTimeObjects from "war3-objectdata-th"

const BUILD_DATE = compiletime(() => new Date().toUTCString());
const TS_VERSION = compiletime(() => require("typescript").version);
const TSTL_VERSION = compiletime(() => require("typescript-to-lua").version);

compiletime((ctx: CompiletimeContext) => {
  const items = ctx.constants.items as typeof CompileTimeObjects.Items;
  const abilities = ctx.constants.items as typeof CompileTimeObjects.Abilities;

  for (let i = 0; i < 9; i++) {
    const item = ctx.objectData.items.copy(items.ClawsOfAttackPlus15);

    if (!item) {
      continue;
    }

    const ability = ctx.objectData.abilities.get(abilities.ItemArmorBonusPlus10);

    item.newId = `I00${i}`;
    item.name = `Generated Item ${i}`;
    item.abilities = ability?.oldId || "";
  }

  ctx.objectData.save();
});

function tsMain() {
  try {
    print(`Build: ${BUILD_DATE}`);
    print(`Typescript: v${TS_VERSION}`);
    print(`Transpiler: v${TSTL_VERSION}`);
    print(" ");
    print("Welcome to TypeScript!");

    print(Items.AlleriasFluteOfAccuracy);

    for (let i = 0; i < 9; i++) {
      Item.create(FourCC(`I00${i}`), 48 * i, 0);
      
    }
    const unit = new Unit(Players[0], FourCC("hfoo"), 0, 0, 270);
    unit.name = "TypeScript";

    new Timer().start(1.0, true, () => {
      unit.color = Players[math.random(0, bj_MAX_PLAYERS)].color;
    });
  } catch (e) {
    print(e);
  }
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, tsMain);
