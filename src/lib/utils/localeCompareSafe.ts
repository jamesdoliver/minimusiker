/**
 * Null-safe wrapper around String.prototype.localeCompare.
 *
 * Airtable omits empty fields entirely, so an unset text field (e.g. a Class with no
 * class_name) reads back as `undefined`, not `''`. Calling `.localeCompare` on `undefined`
 * throws a TypeError, which previously crashed the admin event-detail endpoint with a 500
 * for any event that had a class/record with a blank name (e.g. event 1798).
 *
 * Treat a missing value as an empty string so blanks sort first and never throw.
 */
export function localeCompareSafe(a: string | undefined | null, b: string | undefined | null): number {
  return (a || '').localeCompare(b || '');
}
