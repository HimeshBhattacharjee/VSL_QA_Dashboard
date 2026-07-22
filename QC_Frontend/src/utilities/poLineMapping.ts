export const FAB_LINE_I = 'FAB-II Line-I' as const;
export const FAB_LINE_II = 'FAB-II Line-II' as const;
export const UNMAPPED_FAB_LINE = 'Unmapped' as const;
export type FabLine = typeof FAB_LINE_I | typeof FAB_LINE_II;

export const mapPoToFabLine = (value: unknown): FabLine | typeof UNMAPPED_FAB_LINE => {
    const productionOrder = value == null ? '' : String(value).trim();
    if (productionOrder.startsWith('7')) return FAB_LINE_I;
    if (productionOrder.startsWith('9')) return FAB_LINE_II;
    return UNMAPPED_FAB_LINE;
};

export const getPoLineValidationMessage = (value: unknown): string =>
    mapPoToFabLine(value) === UNMAPPED_FAB_LINE
        ? 'Production Order must start with 7 (FAB-II Line-I) or 9 (FAB-II Line-II).'
        : '';
