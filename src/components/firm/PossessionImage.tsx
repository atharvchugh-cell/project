const images = import.meta.glob('/src/assets/possessions/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;

export function PossessionImage({ id, name, tiny = false }: { id: string; name: string; tiny?: boolean }) {
  const src = images[`/src/assets/possessions/${id}.jpg`];
  if (!src) return null;
  return <img src={src} alt={name} loading="lazy" width={320} height={320} className={tiny ? 'h-14 w-14 shrink-0 rounded-md object-cover' : 'w-full aspect-[2/1] rounded-md object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]'} />;
}