import React, { createContext, useContext, useEffect, useState } from "react";

import OBR from "@owlbear-rodeo/sdk";
import { useOBR } from "./BaseOBRProvider";

export interface Message {
    sender: string;
    message: unknown;
    realSender?: string;
};

interface InternalMessage extends Message {
    recipients?: string[];
}

interface OBRMessageContextType {
    sendMessage: (message: unknown, to?: string[]) => void;
    registerMessageHandler: (handler: (msg: Message) => void) => () => void;
};

const OBRMessageContext = createContext<OBRMessageContextType>({
    sendMessage: () => {},
    registerMessageHandler: () => { return () => {} }
});
export const useOBRMessaging = () => useContext(OBRMessageContext);

export function OBRMessageProvider({ children, appKey }: { children: React.ReactNode, appKey: string }) {
    const { player, party } = useOBR();

    const [handlers, setHandlers] = useState<((msg: Message) => void)[]>([]);
    const [playerId, setPlayerId] = useState<string|undefined>(player?.id);

    const sendMessage = (message: unknown, to?: string[]) => {
        OBR.broadcast.sendMessage(appKey, {
            sender: player?.id,
            recipients: to,
            message: message
        }, { destination: "ALL" });
    }

    const registerMessageHandler = (handler: (msg: Message) => void) => {
        setHandlers(prev => [...prev, handler]);
        return () => {
            setHandlers(prev => prev.filter(h => h !== handler));
        };
    };

    useEffect(() => {
        if (playerId === undefined || player?.id != playerId) {
            setPlayerId(player?.id);
        }
    }, [player]);

    useEffect(() => {
        return OBR.broadcast.onMessage(appKey, e => {
            const messageData = e.data as InternalMessage;
            if (messageData.recipients === undefined || (playerId && messageData.recipients.includes(playerId))) {
                handlers.forEach(handler => handler({
                    sender: messageData.sender,
                    realSender: party.find(possibleSender => possibleSender.connectionId === e.connectionId)?.id,
                    message: messageData.message
                }));
            }
        });
    }, [playerId, handlers]);

    return <OBRMessageContext.Provider value={{sendMessage, registerMessageHandler}}>
        { children }
    </OBRMessageContext.Provider>;
}
