import Image, { type ImageProps } from "next/image";

type AppImageProps = Omit<ImageProps, "src" | "alt"> & {
  src: string;
  alt: string;
};

export default function AppImage({
  alt,
  fill,
  height,
  src,
  unoptimized = true,
  width,
  ...props
}: AppImageProps) {
  if (fill) {
    return <Image alt={alt} fill src={src} unoptimized={unoptimized} {...props} />;
  }

  return (
    <Image
      alt={alt}
      height={height ?? 144}
      src={src}
      unoptimized={unoptimized}
      width={width ?? 96}
      {...props}
    />
  );
}
