import { Box, Button, Input, Link, Tab, Tabs, Typography } from "@mui/material";
import { backendAPIService, createQueryFn } from "../services/backendAPIService";

import { AudioPlayerView } from "./AudioPlayerView";
import OBR from "@owlbear-rodeo/sdk";
import { SceneView } from "./SceneView";
import { SettingsView } from "./Settings";
import { TrackListView } from "./TrackListView";
import { User } from "../types/user";
import { useAuth } from "../providers/AuthProvider";
import { useState } from "react";

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const [hasBeenVisible, setHasBeenVisible] = useState(false);
    const { children, value, index, ...other } = props;

    if (value === index && !hasBeenVisible) setHasBeenVisible(true);
    if (!hasBeenVisible) return null;

    return (
        <Box
            role="tabpanel"
            sx={{ display: value === index ? "block" : "none" }}
            {...other}
        >
            {children}
        </Box>
    );
}

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        createQueryFn(() => backendAPIService.login(email, password))().then(result => {   
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
    const [selectedTab, setTab] = useState(0);

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
    </Box>;
}
