const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_SUFFIX = '+05:30';
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_WITH_TIME_ZONE_PATTERN = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

const createFormatter = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-IN', {
        timeZone: IST_TIME_ZONE,
        ...options,
    });

const parseDateValue = (value: string | Date) => {
    const parsedDate =
        value instanceof Date
            ? value
            : ISO_DATE_ONLY_PATTERN.test(value)
                ? new Date(`${value}T00:00:00.000${IST_OFFSET_SUFFIX}`)
                : new Date(
                    ISO_WITH_TIME_ZONE_PATTERN.test(value) ? value : `${value}Z`,
                );

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getDateParts = (value: string | Date) => {
    const parsedDate = parseDateValue(value);
    if (!parsedDate) {
        return null;
    }

    const parts = createFormatter({
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(parsedDate);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
        return null;
    }

    return { year, month, day };
};

export const getISTDateKey = (value: string | Date) => {
    if (typeof value === 'string' && ISO_DATE_ONLY_PATTERN.test(value)) {
        return value;
    }

    const dateParts = getDateParts(value);
    if (!dateParts) {
        return '';
    }

    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

export const getCurrentISTDateKey = () => getISTDateKey(new Date());

export const formatISTDate = (
    value: string | Date,
    options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    },
) => {
    const parsedDate = parseDateValue(value);
    if (!parsedDate) {
        return '--';
    }

    return createFormatter(options).format(parsedDate);
};

export const formatISTDateTime = (
    value: string | Date,
    options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    },
) => {
    const parsedDate = parseDateValue(value);
    if (!parsedDate) {
        return '--';
    }

    return createFormatter(options).format(parsedDate);
};

export const toISTStartOfDayIso = (dateKey: string) =>
    `${dateKey}T00:00:00.000${IST_OFFSET_SUFFIX}`;
