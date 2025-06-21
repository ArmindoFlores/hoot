import { useCallback, useEffect, useRef } from "react";

export type ThrottleTypes = "leading" | "trailing" | "both";

export function useThrottled<T extends unknown[], R>(fn: (...args: T) => R, delay: number, type: ThrottleTypes = "both") {
    const timeoutRef = useRef<number|null>(null);
    const timestampRef = useRef<number|null>(null);

    const cleanup = () => {
        timestampRef.current = null;
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };
    
    const throttledFunc = useCallback((...args: T) => {
        const now = (new Date()).getTime();
        if ((type == "both" || type == "leading") && (timestampRef.current === null || now - timestampRef.current > delay)) {
            fn(...args);
        }
        else if (type == "both" || type == "trailing") {
            if (timeoutRef.current !== null) { 
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                fn(...args);
                cleanup();
            }, delay);
        }
        timestampRef.current = now;
    }, [fn, delay, type]);


    useEffect(() => {
        return cleanup;
    }, []);

    return throttledFunc;
}
