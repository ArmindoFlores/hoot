import "./index.css";

import { PluginGate, PluginThemeProvider } from "./react-obr/plugin";

import App from "./App.tsx";
import React from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <PluginGate>
            <PluginThemeProvider>
                <App />
            </PluginThemeProvider>
        </PluginGate>
    </React.StrictMode>,
);
