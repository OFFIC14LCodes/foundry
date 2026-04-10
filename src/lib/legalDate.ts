export function getOrdinalDay(day: number) {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${day}th`;

    switch (day % 10) {
        case 1:
            return `${day}st`;
        case 2:
            return `${day}nd`;
        case 3:
            return `${day}rd`;
        default:
            return `${day}th`;
    }
}

export function getIsoDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateValue(value: string | Date) {
    if (value instanceof Date) return value;

    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return new Date(`${trimmed}T12:00:00`);
    }

    return new Date(trimmed);
}

export function formatLongDate(value: string | Date = new Date()) {
    const date = parseDateValue(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export function formatLegalDate(value: string | Date = new Date()) {
    const date = parseDateValue(value);
    if (Number.isNaN(date.getTime())) return "";

    const month = date.toLocaleDateString("en-US", { month: "long" });
    return `On this ${getOrdinalDay(date.getDate())} day of ${month}, ${date.getFullYear()}`;
}
