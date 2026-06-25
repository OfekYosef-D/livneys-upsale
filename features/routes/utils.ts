export const israelTimeZone = 'Asia/Jerusalem';

export function isAfterCutoff({ now, cutoff }: { now: Date; cutoff: Date }): boolean {
  return now.getTime() > cutoff.getTime();
}

export function formatRouteDeadline(cutoff: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: israelTimeZone,
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(cutoff);
}
