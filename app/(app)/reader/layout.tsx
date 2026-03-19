// 4.3 - Layout Aislado del Lector EPUB: Suprime el Header y Footer global para maximizar la inmersión a pantalla completa.
export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
