const FADE_VOLUME_BASELINE = 0.001;

export function fadeInVolume(target: number, step: number, totalSteps: number): number {
    return FADE_VOLUME_BASELINE * Math.exp((Math.log(target / FADE_VOLUME_BASELINE) * step) / totalSteps);
}

export function fadeOutVolume(initial: number, step: number, totalSteps: number): number {
    return initial * Math.exp((Math.log(FADE_VOLUME_BASELINE / initial) * step) / totalSteps);
}
