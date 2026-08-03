import { HootFullInfoMessage, HootGetFullInfoMessage } from "./messages";

export type HootExternalMessageRegistry = {
    HOOT_GET_FULL_INFO: {
        request: HootGetFullInfoMessage;
        response: HootFullInfoMessage;
    }
};
