export const compareNamesAlphabetically = (left: string, right: string) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' });

export const sortNamesAlphabetically = (names: string[]) =>
    [...names].sort(compareNamesAlphabetically);

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

export const normalizeAssignedTo = (assignedTo: string | string[]): string[] => {
    const rawValues = Array.isArray(assignedTo) ? assignedTo : assignedTo.split(',');

    return sortNamesAlphabetically(
        Array.from(
            new Set(
                rawValues
                    .map((value) => normalizeName(value))
                    .filter(Boolean),
            ),
        ),
    );
};

export const formatUserDisplayName = (name: string) => {
    const normalizedName = normalizeName(name);
    return normalizedName.split(' ')[0] ?? '';
};

export const compareUserNamesByDisplayName = (left: string, right: string) => {
    const displayNameComparison = compareNamesAlphabetically(
        formatUserDisplayName(left),
        formatUserDisplayName(right),
    );

    if (displayNameComparison !== 0) {
        return displayNameComparison;
    }

    return compareNamesAlphabetically(left, right);
};

export const sortUserNamesByDisplayName = (names: string[]) =>
    [...names].sort(compareUserNamesByDisplayName);

export const getUserInitials = (name: string) => {
    const nameParts = normalizeName(name)
        .split(' ')
        .filter(Boolean);

    if (nameParts.length === 0) {
        return '';
    }

    const firstInitial = nameParts[0][0] ?? '';
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] ?? '' : '';

    return `${firstInitial}${lastInitial}`.toUpperCase();
};

export const getAssignedToDisplayNames = (assignedTo: string[]) =>
    sortUserNamesByDisplayName(assignedTo).map(formatUserDisplayName);

export const getAssignedToGroupKey = (assignedTo: string[]) => {
    const normalizedAssignedTo = normalizeAssignedTo(assignedTo);
    return normalizedAssignedTo.length > 0 ? normalizedAssignedTo.join('||') : 'Unassigned';
};

export const formatAssignedToGroupLabel = (
    assignedTo: string[],
    separator = ', ',
) => {
    const displayNames = getAssignedToDisplayNames(assignedTo);

    return displayNames.length > 0 ? displayNames.join(separator) : 'Unassigned';
};

export const formatAssignedToSummary = (assignedTo: string[], maxVisible = 2) => {
    const displayNames = getAssignedToDisplayNames(assignedTo);

    if (displayNames.length === 0) {
        return 'Unassigned';
    }

    const visibleNames = displayNames.slice(0, maxVisible);
    const remainingCount = displayNames.length - visibleNames.length;

    return remainingCount > 0
        ? `${visibleNames.join(', ')} +${remainingCount} more`
        : visibleNames.join(', ');
};
