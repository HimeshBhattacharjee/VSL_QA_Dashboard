import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface ResizableTableDimension {
    key: string;
    defaultSize: number;
    minSize: number;
    maxSize: number;
}

interface ActiveResizeState {
    axis: 'column' | 'row';
    key: string;
    startPosition: number;
    startSize: number;
    minSize: number;
    maxSize: number;
}

interface UseResizableTableOptions {
    columns: readonly ResizableTableDimension[];
    rows: readonly ResizableTableDimension[];
}

const clampSize = (value: number, minSize: number, maxSize: number) =>
    Math.min(Math.max(Math.round(value), minSize), maxSize);

const syncDimensionSizes = (
    currentSizes: Record<string, number>,
    dimensions: readonly ResizableTableDimension[],
) =>
    dimensions.reduce<Record<string, number>>((sizes, dimension) => {
        sizes[dimension.key] = currentSizes[dimension.key] ?? dimension.defaultSize;
        return sizes;
    }, {});

const areDimensionSizesEqual = (
    currentSizes: Record<string, number>,
    nextSizes: Record<string, number>,
) => {
    const currentKeys = Object.keys(currentSizes);
    const nextKeys = Object.keys(nextSizes);

    if (currentKeys.length !== nextKeys.length) {
        return false;
    }

    return nextKeys.every((key) => currentSizes[key] === nextSizes[key]);
};

export const useResizableTable = ({
    columns,
    rows,
}: UseResizableTableOptions) => {
    const [columnSizes, setColumnSizes] = useState<Record<string, number>>(() =>
        syncDimensionSizes({}, columns),
    );
    const [rowSizes, setRowSizes] = useState<Record<string, number>>(() =>
        syncDimensionSizes({}, rows),
    );
    const [activeResize, setActiveResize] = useState<ActiveResizeState | null>(null);
    const columnMapRef = useRef(new Map<string, ResizableTableDimension>());
    const rowMapRef = useRef(new Map<string, ResizableTableDimension>());

    useEffect(() => {
        columnMapRef.current = new Map(columns.map((column) => [column.key, column]));
        setColumnSizes((currentSizes) => {
            const nextSizes = syncDimensionSizes(currentSizes, columns);
            // Prevent render loops when callers rebuild equivalent config arrays each render.
            return areDimensionSizesEqual(currentSizes, nextSizes) ? currentSizes : nextSizes;
        });
    }, [columns]);

    useEffect(() => {
        rowMapRef.current = new Map(rows.map((row) => [row.key, row]));
        setRowSizes((currentSizes) => {
            const nextSizes = syncDimensionSizes(currentSizes, rows);
            return areDimensionSizesEqual(currentSizes, nextSizes) ? currentSizes : nextSizes;
        });
    }, [rows]);

    useEffect(() => {
        if (!activeResize || typeof document === 'undefined') {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const currentPosition =
                activeResize.axis === 'column' ? event.clientX : event.clientY;
            const nextSize = clampSize(
                activeResize.startSize + (currentPosition - activeResize.startPosition),
                activeResize.minSize,
                activeResize.maxSize,
            );

            if (activeResize.axis === 'column') {
                setColumnSizes((currentSizes) =>
                    currentSizes[activeResize.key] === nextSize
                        ? currentSizes
                        : {
                            ...currentSizes,
                            [activeResize.key]: nextSize,
                        },
                );
                return;
            }

            setRowSizes((currentSizes) =>
                currentSizes[activeResize.key] === nextSize
                    ? currentSizes
                    : {
                        ...currentSizes,
                        [activeResize.key]: nextSize,
                    },
            );
        };

        const stopResizing = () => {
            setActiveResize(null);
        };

        const originalCursor = document.body.style.cursor;
        const originalUserSelect = document.body.style.userSelect;
        document.body.style.cursor = activeResize.axis === 'column' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopResizing);
        window.addEventListener('pointercancel', stopResizing);

        return () => {
            document.body.style.cursor = originalCursor;
            document.body.style.userSelect = originalUserSelect;
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopResizing);
            window.removeEventListener('pointercancel', stopResizing);
        };
    }, [activeResize]);

    const startResize = (
        axis: ActiveResizeState['axis'],
        key: string,
        event: ReactPointerEvent<HTMLElement>,
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const dimensionMap = axis === 'column' ? columnMapRef.current : rowMapRef.current;
        const dimension = dimensionMap.get(key);
        if (!dimension) {
            return;
        }

        const currentSizes = axis === 'column' ? columnSizes : rowSizes;
        setActiveResize({
            axis,
            key,
            startPosition: axis === 'column' ? event.clientX : event.clientY,
            startSize: currentSizes[key] ?? dimension.defaultSize,
            minSize: dimension.minSize,
            maxSize: dimension.maxSize,
        });
    };

    return {
        columnSizes,
        rowSizes,
        startColumnResize: (key: string, event: ReactPointerEvent<HTMLElement>) =>
            startResize('column', key, event),
        startRowResize: (key: string, event: ReactPointerEvent<HTMLElement>) =>
            startResize('row', key, event),
    };
};
