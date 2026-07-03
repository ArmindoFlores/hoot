import OBR from "@owlbear-rodeo/sdk";
import { setup as setupGM } from "./audio/gm";
import { setup as setupPlayer } from "./audio/player";

async function setup() {
    const role = await OBR.player.getRole();
    if (role === "GM") {
        setupGM();
    }
    else {
        setupPlayer();
    }
}

OBR.onReady(setup);

if (OBR.isReady) {
    setup();
}
