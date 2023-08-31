import { Timer, Unit } from "w3ts";
import { Players } from "w3ts/globals";
import { W3TS_HOOK, addScriptHook } from "w3ts/hooks";
import { Units } from "@objectdata/units";
import * as COMPILE_TIME from "compiletimeConstants"


function tsMain() {
  try {
    print(`Build: ${COMPILE_TIME.BUILD_DATE}`);
    print(`Typescript: v${COMPILE_TIME.TS_VERSION}`);
    print(`Transpiler: v${COMPILE_TIME.TSTL_VERSION}`);
    print(" ");
    print("Welcome to TypeScript!");

    const unit = Unit.create(Players[0], FourCC(Units.Footman), 0, 0, 270);

    Timer.create().start(1.0, true, () => {
      if (unit) {
        unit.color = Players[math.random(0, bj_MAX_PLAYERS)].color;
      }
    });
  } catch (e) {
    print(e);
  }
}

addScriptHook(W3TS_HOOK.MAIN_AFTER, tsMain);
