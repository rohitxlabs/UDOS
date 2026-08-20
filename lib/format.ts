// Small presentation helpers shared across dashboard modules.

// `datetime-local` inputs want local wall-clock time with no zone suffix.
export function toDateTimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

// `date` inputs want a plain calendar date. College date columns are stored
// at UTC midnight, so read them back in UTC to avoid drifting a day.
export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

// Prisma returns Decimal columns as Decimal objects; every caller here just
// wants a number it can format or compare.
export function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function formatMoney(value: { toString(): string } | number | null | undefined): string {
  return currency.format(toNumber(value));
}

// Suggested fine for an overdue library return, so the librarian is not
// doing arithmetic at the desk. Only a default — what gets stored is
// whatever they confirm. `now` is passed in rather than read here so a
// caller rendering a whole list dates every row off one instant.
export function suggestedFine(dueDate: Date, now: Date, perDay = 2): number {
  const overdueMs = now.getTime() - dueDate.getTime();
  if (overdueMs <= 0) return 0;
  return Math.ceil(overdueMs / (24 * 60 * 60 * 1000)) * perDay;
}
