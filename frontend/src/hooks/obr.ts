import OBR, { Player, Theme } from "@owlbear-rodeo/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logging } from "../logging";

export function useOBRBase() {
    const [isReady, setReady] = useState(false);
    const [isSceneReady, setSceneReady] = useState(false);

    useEffect(() => {
        setReady(OBR.isReady);
        return OBR.onReady(() => setReady(true));
    }, []);

    useEffect(() => {
        if (!isReady) return;
        OBR.scene.isReady().then(setSceneReady);
        return OBR.scene.onReadyChange(setSceneReady);
    }, [isReady]);

    return useMemo(() => ({
        ready: isReady,
        sceneReady: isSceneReady,
    }), [isReady, isSceneReady]);
}

export function useOBRTheme() {
    const [theme, setTheme] = useState<Theme>();

    useEffect(() => {
        OBR.theme.getTheme().then(setTheme);
        return OBR.theme.onChange(setTheme);
    }, []);

    return theme;
}

export function useOBRPlayers() {
    const [players, setPlayers] = useState<Player[]>([]);

    useEffect(() => {
        OBR.party.getPlayers().then(setPlayers);
        return OBR.party.onChange(setPlayers);
    }, [])

    return players;
}

export function useOBRSelf() {
    const [player, setPlayer] = useState<Player|null>(null);

    useEffect(() => {
        Promise.all([
            OBR.player.getColor(),
            OBR.player.getConnectionId(),
            OBR.player.getId(),
            OBR.player.getMetadata(),
            OBR.player.getName(),
            OBR.player.getRole(),
            OBR.player.getSelection(),
            OBR.player.getSyncView(),
        ]).then(([color, connectionId, id, metadata, name, role, selection, syncView]) => setPlayer({
            color,
            connectionId,
            id,
            metadata,
            name,
            role,
            selection,
            syncView
        }));
        return OBR.player.onChange(setPlayer);
    }, []);

    return player;
}

export function useOBRBroadcast<MessageDataType>() {
    const player = useOBRSelf();
    const messageHandlers = useRef(new Map<string, ((message: MessageDataType, sender: string) => void)[]>());
    const [channels, setChannels] = useState<string[]>([]);

    const sendMessage = useCallback(async (channel: string, message: MessageDataType, recipients?: string[], destination?: "ALL" | "REMOTE" | "LOCAL") => {
        return await OBR.broadcast.sendMessage(
            channel,
            {
                recipients,
                data: message
            },
            { destination: destination ?? "ALL" }
        );
    }, []);

    const registerMessageHandler = useCallback((channel: string, callback: (message: MessageDataType, sender: string) => void) => {
        if (!messageHandlers.current.has(channel)) {
            messageHandlers.current.set(channel, []);
            setChannels(old => [...old, channel]);
        }
        messageHandlers.current.get(channel)?.push?.(callback);
        return () => {
            const handlers = messageHandlers.current.get(channel);
            if (handlers == undefined) return;
            const newHandlers = handlers.filter(handler => handler != callback);
            messageHandlers.current.set(channel, newHandlers);
            if (newHandlers.length == 0) {
                setChannels(old => old.filter(oldChannel => channel != oldChannel));
            }
        };
    }, []);

    useEffect(() => {
        const unsubscriptionArray = channels.map(channel => OBR.broadcast.onMessage(channel, event => {
            for (const handler of (messageHandlers.current.get(channel)) ?? []) {
                try {
                    const data = event.data as { data: MessageDataType, recipients: string[] };
                    if (data.recipients == undefined || data.recipients.includes(player?.connectionId ?? "")) {
                        handler(data.data, event.connectionId);
                    }
                }
                catch (error) {
                    logging.error("Error while handling broadcast messages", error);
                }
            }
        }));
        return () => {
            for (const unsubscribe of unsubscriptionArray) {
                unsubscribe();
            }
        }
    }, [channels, player?.connectionId]);

    return useMemo(() => ({
        sendMessage,
        registerMessageHandler,
    }), [sendMessage, registerMessageHandler]);
}
