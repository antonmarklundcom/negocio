import Image from 'next/image';

/**
 * Premium gallery (§6.1): a horizontal strip on mobile, a 2fr/1fr/1fr grid on
 * desktop. The first image is the hero cover; up to 5 cells render on desktop.
 */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  if (images.length === 0) return null;
  const cover = images[0]!;
  const rest = images.slice(1);

  return (
    <>
      {/* Mobile: cover + horizontal strip */}
      <div className="md:hidden">
        <div className="relative h-[214px] w-full">
          <Image src={cover} alt={name} fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        </div>
        {rest.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto px-4 py-3">
            {rest.map((src, i) => (
              <div key={i} className="relative h-[88px] w-[122px] shrink-0 overflow-hidden rounded-xl">
                <Image src={src} alt={`${name} ${i + 2}`} fill sizes="122px" className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: gallery grid */}
      <div className="hidden gap-1.5 p-1.5 md:grid md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2">
        <div className="relative row-span-2 h-[281px] overflow-hidden rounded-l-xl">
          <Image src={cover} alt={name} fill priority sizes="50vw" className="object-cover" />
        </div>
        {[0, 1, 2, 3].map((i) => {
          const src = rest[i] ?? cover;
          const last = i === 3;
          const extra = images.length - 5;
          return (
            <div key={i} className="relative h-[138px] overflow-hidden">
              <Image src={src} alt={`${name} ${i + 2}`} fill sizes="25vw" className="object-cover" />
              {last && extra > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white">
                  +{extra} fotos
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
