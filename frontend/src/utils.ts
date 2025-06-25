const FADE_VOLUME_BASELINE = 0.001;

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
