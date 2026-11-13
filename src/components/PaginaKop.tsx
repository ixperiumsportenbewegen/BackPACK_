import Image from "next/image";

/** Paginakop met een outdoorfoto. Altijd een donkere laag onder de witte titel, zodat de tekst leesbaar blijft. */
export function PaginaKop({ titel, foto }: { titel: string; foto: string }) {
  return (
    <div className="relative overflow-hidden rounded-han bg-kop">
      <Image
        src={`/fotos/${foto}-800.webp`}
        alt=""
        width={800}
        height={600}
        sizes="(min-width: 768px) 768px, 100vw"
        className="h-32 w-full object-cover opacity-70"
      />
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent p-4">
        <h1 className="text-3xl !text-white">{titel}</h1>
      </div>
    </div>
  );
}
