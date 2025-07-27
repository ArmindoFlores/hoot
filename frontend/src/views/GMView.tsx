import { Box, Button, Input, Link, Tab, Tabs, Typography } from "@mui/material";
import { apiService, createQueryFn } from "../services/apiService";
import { useEffect, useState } from "react";

import { AudioPlayerView } from "./AudioPlayerView";
import { Autoplay } from "../components/Autoplay";
import { INTERNAL_BROADCAST_CHANNEL } from "../config";
import { MessageContent } from "../types/messages";
import OBR from "@owlbear-rodeo/sdk";
import { SceneView } from "./SceneView";
import { SettingsView } from "./Settings";
import { TrackListView } from "./TrackListView";
import { User } from "../types/user";
import { useAudio } from "../providers/AudioPlayerProvider";
import { useAuth } from "../providers/AuthProvider";
import { useOBRBroadcast } from "../hooks/obr";

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

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        createQueryFn(() => apiService.login(email, password))().then(result => {   
            OBR.notification.show("Login successful", "SUCCESS");
            onLogin(result);
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
    };

    return <Box component="form" action="#" onSubmit={handleLogin} sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "center", justifyContent: "flex-start"}}>
            <Typography fontWeight="bold">Email</Typography>
            <Input
                sx={{textAlign: "left"}}
                name="email"
                value={email}
                type="email"
                onChange={e => setEmail(e.target.value)}
            />
        </Box>
        <Box sx={{ p: 1 }} />
        <Box sx={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "end", justifyContent: "flex-start"}}>
            <Typography fontWeight="bold">Password</Typography>
            <Input
                sx={{textAlign: "left"}}
                name="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />
        </Box>
        <Box sx={{ p: 1 }} />
        <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly"}}>
            <Button disabled={email == "" || password == ""} type="submit" variant="outlined">
                Log In
            </Button>
            <Typography style={{marginLeft: "1rem"}}>
                Or <Link href="/signup" target="_blank" style={{color: "white", fontWeight: "bold"}}>create your account</Link>
            </Typography>
        </Box>
    </Box>;
}

export function GMView() {
    const { status, doLogin } = useAuth();
    const { triggerEvent } = useAudio();
    const { registerMessageHandler } = useOBRBroadcast<MessageContent>();
    const [selectedTab, setTab] = useState(0);

    useEffect(() => {
        if (status === "LOGGED_OUT") {
            return;
        }
        return registerMessageHandler(INTERNAL_BROADCAST_CHANNEL, message => {
            // When a new user appears, sync them
            if (message.type === "hello") {
                triggerEvent();
            }
        });
    }, [registerMessageHandler, triggerEvent, status]);


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

    if (status === "LOGGED_OUT") {
        return <Box sx={{ padding: 2, height: "100vh", overflow: "hidden" }}>
            <Typography variant="h5">Login</Typography>
            <Typography>Login to host your tracks directly in Hoot, and sync across all devices.</Typography>
            <Box sx={{ p: 1 }} />
            <LoginForm onLogin={doLogin}></LoginForm>
        </Box>;
    }

    return <Box sx={{ padding: 0, height: "100vh", overflow: "hidden" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs value={selectedTab} onChange={(_, tab) => setTab(tab)} centered>
                <Tab label="Tracks" />
                <Tab label="Player" />
                <Tab label="Scene" />
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
            <SettingsView />
        </TabPanel>
        <Autoplay />
    </Box>;
}
