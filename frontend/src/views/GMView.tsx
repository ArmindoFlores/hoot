import { Box, Tab, Tabs } from "@mui/material";
import { useEffect, useState } from "react";

import { AudioPlayerView } from "./AudioPlayerView";
import { ExportView } from "./ExportView";
import { INTERNAL_BROADCAST_CHANNEL } from "../config";
import { MessageContent } from "../types/messages";
import { SceneView } from "./SceneView";
import { SettingsView } from "./Settings";
import { TrackListView } from "./TrackListView";
import { useAudio } from "../providers/AudioPlayerProvider";
import { useOBRBroadcast } from "../hooks/obr";
import { useTracks } from "../providers/TrackProvider";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            {...other}
        >
            {value === index && <>{children}</>}
        </div>
    );
}

export function GMView() {
    const { sendMessage, registerMessageHandler } = useOBRBroadcast<MessageContent>();
    const { playing, setVolume } = useAudio();
    const { addTrack, tracks, } = useTracks();
    const [selectedTab, setTab] = useState(0);

    useEffect(() => {
        return registerMessageHandler(INTERNAL_BROADCAST_CHANNEL, (message, sender) => {
            if (message.type === "get-playlists") {
                sendMessage(INTERNAL_BROADCAST_CHANNEL, { type: "playlists", payload: Object.keys(playing) }, [sender]);
            }
            else if (message.type === "get-track") {
                const playlist = message.payload;
                const track = playing[playlist];
                if (track !== undefined) {
                    sendMessage(
                        INTERNAL_BROADCAST_CHANNEL,
                        {
                            type: "track",
                            payload: {
                                playlist,
                                name: track.track.name,
                                source: track.track.source,
                                time: track.time,
                                volume: track.volume,
                                playing: track.playing
                            }
                        },
                        [sender]
                    );
                }
            }
            else if (message.type === "add-track") {
                const track = message.payload;
                addTrack(track);
            }
        });
    }, [playing, addTrack, registerMessageHandler, sendMessage]);

    // useEffect(() => {
    //     return registerMessageHandler(`${APP_KEY}/external`, message => {
    //         // Allow other extensions to talk to hoot
    //         if (message.type === "play") {
    //             const payload = message.payload;
    //             const playlist = payload.playlist;
    //             const trackName = payload.track;
    //             const trackId = Array.from(tracks.entries()).map(o => o[1]).flat().find(t => t.name === trackName)?.id;
    //             const playlistTracks = tracks.get(playlist);
    //             if (playlistTracks == undefined) {
    //                 logging.error("Couldn't find playlist");
    //                 return;
    //             }
    //             const track = playlistTracks.find(t => t.id === trackId);
    //             if (track == undefined) {
    //                 logging.error("Couldn't find track");
    //                 return;
    //             }
    //             if (payload.shuffle != undefined) {
    //                 setShuffle(payload.shuffle, playlist);
    //             }
    //             if (payload.repeatMode != undefined) {
    //                 setRepeatMode(payload.repeatMode, playlist);
    //             }
    //             if (payload.volume != undefined || playing[playlist] == undefined) {
    //                 setVolume(payload.volume ?? 0.75, playlist);
    //             }
    //             setTrack(track, playlist);
    //             setIsPlaying(true, playlist);
    //         }
    //     });
    // }, [registerMessageHandler, setIsPlaying, setTrack, tracks, setShuffle, setRepeatMode, setVolume, playing]);

    return <Box sx={{ padding: 0, height: "100vh", overflow: "hidden" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs value={selectedTab} onChange={(_, tab) => setTab(tab)} centered>
                <Tab label="Tracks" />
                <Tab label="Player" />
                <Tab label="Scene" />
                <Tab label="Export" />
                <Tab label="Settings" />
            </Tabs>
        </Box>
        <TabPanel value={selectedTab} index={0}>
            <TrackListView />
        </TabPanel>
        <TabPanel value={selectedTab} index={1}>
            <AudioPlayerView />
        </TabPanel>
        <TabPanel value={selectedTab} index={2}>
            <SceneView />
        </TabPanel>
        <TabPanel value={selectedTab} index={3}>
            <ExportView />
        </TabPanel>
        <TabPanel value={selectedTab} index={4}>
            <SettingsView />
        </TabPanel>
    </Box>;
}
