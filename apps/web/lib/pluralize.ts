export function pluralize(count: number, singular: string, plural: string = `${singular}s`) {
  const normalized = Number.isFinite(count) ? count : 0;
  return `${normalized} ${normalized === 1 ? singular : plural}`;
}
