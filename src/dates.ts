const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type GenerationStamp = {
  iso: string;
  label: string;
};

/** Calendar day on this computer. Not a date copied from the register. */
export function generationStamp(now = new Date()): GenerationStamp {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const label = `${day} ${MONTHS[now.getMonth()]} ${year}`;
  return { iso, label };
}

export function printDateLine(now = new Date()): string {
  const { label } = generationStamp(now);
  return `Print date: ${label} (generated when this PDF was made, not copied from the school)`;
}

export function assumedDatePhrase(now = new Date()): string {
  const { iso, label } = generationStamp(now);
  return `${iso} (assumed — generated ${label}, not a date from the school)`;
}
