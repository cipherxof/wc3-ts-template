import { Timer, Unit } from "w3ts";
import { Players } from "w3ts/globals";
import { W3TS_HOOK, addScriptHook } from "w3ts/hooks";
import { UnitContainer } from "war3-objectdata/dist/cjs/generated/units";

const BUILD_DATE = compiletime(() => new Date().toUTCString());
const TS_VERSION = compiletime(() => require("typescript").version);
const TSTL_VERSION = compiletime(() => require("typescript-to-lua").version);
const UNITS = compiletime((ctx: CompiletimeContext) => ctx.objectData.units) as
  | UnitContainer
  | undefined;

function tsMain() {
  try {
    print(`Build: ${BUILD_DATE}`);
    print(`Typescript: v${TS_VERSION}`);
    print(`Transpiler: v${TSTL_VERSION}`);
    print(" ");
    print("Welcome to TypeScript!");

    print(`Peasant's model is "' ${UNITS?.game["hpea"].modelFile}"`);

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
