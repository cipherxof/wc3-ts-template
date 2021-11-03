import { Item, MapPlayer, Timer, Unit } from "w3ts";
import { Players } from "w3ts/globals";
import { addScriptHook, W3TS_HOOK } from "w3ts/hooks";
import * as OETypes from "war3-objectdata";

const BUILD_DATE = compiletime(() => new Date().toUTCString());
const TS_VERSION = compiletime(() => require("typescript").version);
const TSTL_VERSION = compiletime(() => require("typescript-to-lua").version);
const PEASANT = compiletime((ctx: CompiletimeContext) => {
  return ctx.objectData.units.get("hpea");
}) as OETypes.Unit | undefined;

function tsMain() {
  print(`Build: ${BUILD_DATE}`);
  print(`Typescript: v${TS_VERSION}`);
  print(`Transpiler: v${TSTL_VERSION}`);
  print(" ");
  print("Welcome to TypeScript!");

  if (PEASANT) {
    print(" ");
    print(`Peasant's model is "' ${PEASANT.modelFile}"`);
  }

  const unit = new Unit(Players[0], FourCC("hfoo"), 0, 0, 270);
  unit.name = "TypeScript";
  
  new Timer().start(1.00, true, () => {
    unit.color = Players[math.random(0, bj_MAX_PLAYERS)].color
  });
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, tsMain);