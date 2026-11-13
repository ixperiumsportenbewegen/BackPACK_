/** Het woordmerk Backpack_: zwart, met de underscore in HAN rood. */
export function Woordmerk({ className = "" }: { className?: string }) {
  return (
    <span className={`font-heading font-bold text-kop ${className}`}>
      Backpack<span className="text-merk">_</span>
    </span>
  );
}
