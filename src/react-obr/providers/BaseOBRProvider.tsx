import OBR, { Metadata, Permission, Player } from "@owlbear-rodeo/sdk";
import React, { createContext, useContext, useEffect, useState } from "react";

interface BaseOBRContextType {
    party: Player[];
    player: Player|null;
    roomMetadata: Metadata;
    setRoomMetadata: (metadata: Partial<Metadata>) => void;
    roomPermissions: Permission[];
    ready: boolean;
};

const BaseOBRContext = createContext<BaseOBRContextType>({
    party: [],
    player: null,
    roomMetadata: {},
    setRoomMetadata: () => {},
    roomPermissions: [],
    ready: false,
});
export const useOBR = () => useContext(BaseOBRContext);

export function BaseOBRProvider({ children }: { children: React.ReactNode }) {
    const [ party, setParty ] = useState<Player[]>([]);
    const [ player, setPlayer ] = useState<Player|null>(null);
    const [ roomMetadata, _setRoomMetadata ] = useState<Metadata>({});
    const [ roomPermissions, setRoomPermissions ] = useState<Permission[]>([]);
    const [ ready, setReady ] = useState(false);

    // Subscribe to OBR initialization
    useEffect(() => {
        if (OBR.isReady) {
            setReady(true);
        }
        OBR.onReady(() => setReady(true));
    }, []);

    // Subscribe to party changes
    useEffect(() => {
        if (ready) {
            return OBR.party.onChange(players => {
                setParty(players);
            });
        }
    }, [ready]);

    // Subscribe to player changes
    useEffect(() => {
        if (ready) {
            return OBR.player.onChange(newPlayer => {
                setPlayer(newPlayer);
            });
        }
    }, [ready]);
    useEffect(() => {
        if (ready && player === null) {
            setPlayer(party.find(player => player.id === OBR.player.id) ?? null);
        }
    }, [ready, party]);

    // Subscribe to metadata changes
    useEffect(() => {
        if (ready) {
            return OBR.room.onMetadataChange(metadata => {
                _setRoomMetadata(metadata);
            });
        }
    }, [ready]);

    // Subscribe to permission changes
    useEffect(() => {
        if (ready) {
            return OBR.room.onPermissionsChange(permissions => {
                setRoomPermissions(permissions);
            });
        }
    }, [ready]);

    // Initialize values after setup
    useEffect(() => {
        if (ready) {
            const initPromises = [
                OBR.party.getPlayers().then(setParty),
                OBR.room.getPermissions().then(setRoomPermissions),
                OBR.room.getMetadata().then(_setRoomMetadata),
                OBR.player.getMetadata().then(metadata => OBR.player.setMetadata(metadata)), // Horrible, but only way to trigger Player.onChange?
            ]
            Promise.all(initPromises).then(() => console.log("Completed initialization."));
        }
    }, [ready]);

    const setRoomMetadata = (metadata: Partial<Metadata>) => {
        OBR.room.setMetadata(metadata);
    }

    return <BaseOBRContext.Provider value={{ready, party, player, roomMetadata, setRoomMetadata, roomPermissions}}>
        { children }
    </BaseOBRContext.Provider>;
}
