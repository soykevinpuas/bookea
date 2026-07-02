// Layout Aislado del Lector EPUB: Suprime el Header y Footer global para maximizar la inmersión a pantalla completa.
export default function ReaderLayout({
  children,
}: {
  // Contenido del lector: pagina dinamica app/(app)/reader/[id]/page.tsx.
  children: React.ReactNode;
}) {
  // Fragmento intencional: deja al lector controlar toda la pantalla sin wrappers extra.
  return <>{children}</>;
}
