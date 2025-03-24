import OBR from "@owlbear-rodeo/sdk";
import localforage from "localforage";
import { APP_KEY } from "../config";

declare global {
    interface Window { 
        [APP_KEY]: { 
            localforage?: typeof localforage;
            OBR?: typeof OBR;
        };
    }
}

export {}
