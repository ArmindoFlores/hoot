import { CssBaseline, ThemeProvider } from "@mui/material";
import { ThemeOptions, createTheme } from "@mui/material/styles";

import { Theme } from "@owlbear-rodeo/sdk";
import { useMemo } from "react";
import { useOBRTheme } from "../hooks";

function convertOBRThemeToMUI(theme: Theme): ThemeOptions {
    return {
        palette: {
            mode: theme.mode.toLowerCase() as "light" | "dark",
            primary: {
                light: theme.primary.light,
                main: theme.primary.main,
                dark: theme.primary.dark,
                contrastText: theme.primary.contrastText,
            },
            secondary: {
                light: theme.secondary.light,
                main: theme.secondary.main,
                dark: theme.secondary.dark,
                contrastText: theme.secondary.contrastText,
            },
            background: {
                default: theme.background.default,
                paper: theme.background.paper,
            },
            text: {
                primary: theme.text.primary,
                secondary: theme.text.secondary,
                disabled: theme.text.disabled,
            },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        background: "none"
                    }
                }
            }
        }
    };
}

export function OBRThemeProvider({ children }: { children: React.ReactNode }) {
    const obrTheme = useOBRTheme();

    const muiTheme = useMemo(() => {
        if (!obrTheme) return createTheme();
        return createTheme(convertOBRThemeToMUI(obrTheme));
    }, [obrTheme]);

    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
