import { useRef } from "react";

export function arrayEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

export function useArrayCompareMemoize<V>(value: V[]): V[] {
    const ref = useRef<V[]>([]);

    if (!arrayEqual(ref.current, value)) {
        ref.current = value;
    }

    return ref.current;
}
