import { useCallback, useEffect } from "react";

import { Message } from "../react-obr/providers/MessageProvider";
import { useOBRMessaging } from "../react-obr/providers";

export function PlayerView() {
    const { registerMessageHandler } = useOBRMessaging();

    const onMessage = useCallback((message: Message) => {
        console.log("Message:", message);
    }, []);

    useEffect(() => {
        return registerMessageHandler(onMessage);
    }, [registerMessageHandler, onMessage]);

    return <>
    </>;
}
