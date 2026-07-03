import { APP_KEY } from "./config";

const FADE_VOLUME_BASELINE = 0.001;

export function id(...path: string[]) {
    return `${APP_KEY}/${path.join("/")}`;
}

export function fadeInVolume(target: number, step: number, totalSteps: number): number {
    return FADE_VOLUME_BASELINE * Math.exp((Math.log(target / FADE_VOLUME_BASELINE) * step) / totalSteps);
}

export function fadeOutVolume(initial: number, step: number, totalSteps: number): number {
    return initial * Math.exp((Math.log(FADE_VOLUME_BASELINE / initial) * step) / totalSteps);
}

export function byteSize(bytes: number) {
    const units = ["B", "KB", "MB", "GB"];
    let unit = 0;

    for (;;) {
        if (bytes < 1024) {
            break;
        }
        if (unit < units.length-1) {
            unit++;
            bytes /= 1024;
        }
        else {
            break;
        }
    }
    return `${Math.round(bytes * 100) / 100}${units[unit]}`;
}

export function expired(timestampSeconds: number|undefined|null): boolean {
    if (timestampSeconds == undefined) return false;
    
    const nowSeconds = Date.now() / 1000;
    return nowSeconds > timestampSeconds;
}

export function withTimeout<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    ms: number,
    ...args: T
): Promise<R> {
    return new Promise<R>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new DOMException(`Function timed out after ${ms}ms`, "TimeoutError"));
        }, ms);

        fn(...args)
            .then(result => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
    });
}

export function capitalize(s: string): string {
    return s.charAt(0).toLocaleUpperCase() + s.substring(1);
}

export function title(s: string): string {
    return s.split(" ").map(word => capitalize(word)).join(" ");
}

export function mod(a: number, b: number) {
    return ((a % b) + b) % b;
}
