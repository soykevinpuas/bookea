interface Book3DProps {
  src: string;
  title: string;
  className?: string;
  showShadow?: boolean;
  objectFit?: "cover" | "contain";
  percentComplete?: number;
}

export default function Book3D({
  src,
  title,
  className = "",
  showShadow = true,
  objectFit = "cover",
  percentComplete = 0,
}: Book3DProps) {
  const isCompleted = percentComplete >= 100;

  return (
    <div className={`relative w-full h-full ${className}`} data-book-cover>
      <div className={`relative h-full overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800 ${
        showShadow ? 'shadow-sm' : ''
      } ${isCompleted ? 'ring-1 ring-amber-500/40' : ''}`}>
        <img
          src={src || ''}
          alt={title}
          loading="lazy"
          className={`w-full h-full object-${objectFit}`}
        />
        {isCompleted && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]" />
        )}
      </div>
    </div>
  );
}
