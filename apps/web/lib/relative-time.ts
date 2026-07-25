export function relativeUpdatedLabel(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'UPDATED —';
  const elapsed = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'UPDATED NOW';
  if (minutes < 60) return `UPDATED ${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `UPDATED ${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `UPDATED ${days}D AGO`;
  const months = Math.floor(days / 30);
  if (months < 12) return `UPDATED ${months}MO AGO`;
  const years = Math.floor(months / 12);
  return `UPDATED ${years}Y AGO`;
}
