import { useCallback, useEffect, useRef } from "react";

export type ThrottleTypes = "leading" | "trailing" | "both";

export function useThrottled<F extends (...args: any[]) => R, R>(fn: F, delay: number, type: ThrottleTypes = "both") {
    const timeoutRef = useRef<number>();
    const timestampRef = useRef<number>();

    const throttledFunc = useCallback((...args: Parameters<F>) => {
        const now = (new Date()).getTime();
        if ((type == "both" || type == "leading") && (timestampRef.current === undefined || now - timestampRef.current > delay)) {
            fn(...args);
        }
        else if (type == "both" || type == "trailing") {
            if (timeoutRef.current !== undefined) { 
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                fn(...args);
                cleanup();
            }, delay);
        }
        timestampRef.current = now;
    }, [fn, delay]);

    const cleanup = () => {
        timestampRef.current = undefined;
        if (timeoutRef.current !== undefined) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = undefined;
        }
    };

    useEffect(() => {
        return cleanup;
    }, []);

    return throttledFunc;
}
