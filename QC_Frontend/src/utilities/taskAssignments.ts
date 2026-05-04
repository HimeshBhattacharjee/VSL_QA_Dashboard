export const PREDEFINED_TASK_ASSIGNEES = ['Arumay Gayen', 'Himesh Bhattacharjee', 'Krishnendu Khamaru', 'Ritick Ghosh', 'Sandipan Mukherjee', 'Souvik Chaudhury', 'Swarup Purkait', 'Tanmoy Mondal'];

export const normalizeAssignedTo = (assignedTo: string | string[]): string[] => {
    const rawValues = Array.isArray(assignedTo) ? assignedTo : assignedTo.split(',');

    return Array.from(
        new Set(
            rawValues
                .map((value) => value.trim())
                .filter(Boolean),
        ),
    );
};

export const getUserInitials = (name: string) =>
    name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

export const formatAssignedToSummary = (assignedTo: string[], maxVisible = 2) => {
    if (assignedTo.length === 0) {
        return 'Unassigned';
    }

    const visibleNames = assignedTo.slice(0, maxVisible);
    const remainingCount = assignedTo.length - visibleNames.length;

    return remainingCount > 0
        ? `${visibleNames.join(', ')} +${remainingCount} more`
        : visibleNames.join(', ');
};
