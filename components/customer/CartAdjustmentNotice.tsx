export function CartAdjustmentNotice({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900" role="status">
      {message}
    </p>
  );
}
