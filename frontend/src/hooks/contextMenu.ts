import { useCallback, useMemo, useState } from "react";

export function useContextMenu() {
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
    } | null>(null);

    const open = useCallback((event?: React.MouseEvent) => {
        event?.preventDefault?.();
        setContextMenu(contextMenu => 
            contextMenu === null
                ? {
                      mouseX: event?.clientX??0 + 2,
                      mouseY: event?.clientY??0 - 6,
                  }
                :
                  null,
        );
    }, []);

    const close = useCallback(() => {
        setContextMenu(null);
    }, []);

    return useMemo(() => ({
        close, 
        open, 
        opened: contextMenu != null, 
        position: contextMenu ? {
            top: contextMenu.mouseY,
            left: contextMenu.mouseX
        } : undefined
    }), [close, open, contextMenu]); 
}
