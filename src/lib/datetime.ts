/**
 * Parse a timestamp that came from the API.
 *
 * The backend stores UTC in **naive** `DateTime` columns — `Column(DateTime)` with no
 * `timezone=True`, so SQLAlchemy strips the tzinfo on write — and serialises with a bare
 * `.isoformat()`. The wire value is therefore `2026-08-07T10:15:00`: no `Z`, no offset.
 *
 * Per ECMA-262 a date-**time** string without an offset is parsed as **local** time (while
 * a date-only string is parsed as UTC — that asymmetry is why this is easy to miss). So a
 * bare `new Date(value)` displayed every server timestamp shifted by the viewer's UTC
 * offset: on a UTC+5:30 machine an audit event logged at 10:15 UTC read as 10:15 local,
 * five and a half hours late, and near midnight it showed the wrong *day*.
 *
 * The offset check is what keeps this safe rather than merely correct today: a string that
 * already carries `Z` or an explicit offset is left alone, so the helper does not become
 * wrong the moment the backend starts emitting aware timestamps.
 */
export function parseServerDate(value: string): Date {
  return new Date(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

export const formatServerDateTime = (value: string): string =>
  parseServerDate(value).toLocaleString();
