const map: Record<string, string> = {
  הזמין: 'bg-black text-white',
  'לא הזמין': 'bg-[#e6e1d8] text-black',
  'נשלחה תזכורת': 'bg-white text-black ring-1 ring-black/15',
  'פתח לינק': 'bg-[#e6e1d8] text-black',
  'צריך מעקב': 'bg-black text-white',
  'הוסיף מוצר במבצע': 'bg-white text-black ring-1 ring-black/15',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${map[status] ?? 'bg-[#e6e1d8] text-black'}`}>{status}</span>;
}
