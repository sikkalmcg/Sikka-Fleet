/**
 * Formats timestamps to India Timezone (Asia/Kolkata) with 24-hour format: DD-MM-YYYY HH:mm:ss
 */
export function formatDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .format(date)
      .replace(/\//g, '-');
  } catch {
    return '—';
  }
}

/**
 * Formats distance in meters or kilometers
 */
export function formatDistance(meters?: number | null): string {
  if (meters === undefined || meters === null || isNaN(meters)) return '—';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Normalizes vehicle number (uppercase, no whitespace)
 */
export function normalizeVehicleNumber(val: string): string {
  return val.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Cleans phone number to exactly 10 digits
 */
export function clean10DigitPhone(val: string): string {
  // Remove country code prefix +91 or 91 if typed
  const digits = val.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    return digits.slice(2, 12);
  }
  return digits.slice(0, 10);
}
