/* eslint-disable @typescript-eslint/no-explicit-any */

function info(...data: any[]) {
    console.log("%cHoot 🦉", "background:#ffa114;border-radius:9999px;color:#000;padding:3px 7px;font-weight:bold;", ...data);
}

function warn(...data: any[]) {
    console.warn("%cHoot 🦉", "background:#ffa114;border-radius:9999px;color:#000;padding:3px 7px;font-weight:bold;", ...data);
}

function error(...data: any[]) {
    console.error("%cHoot 🦉", "background:#ffa114;border-radius:9999px;color:#000;padding:3px 7px;font-weight:bold;", ...data);
}

export const logging = {
    info,
    warn,
    error
};
