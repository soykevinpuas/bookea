// Standalone layout for the EPUB Reader — strips out the global Header and Footer
// so they don't overlap the immersive full-screen reading experience.
export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
