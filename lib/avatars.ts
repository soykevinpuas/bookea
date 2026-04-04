/**
 * 6.1 - Avatares Animales: Configuración de la matriz de sprites para la personalización de usuarios
 * 
 * Regresamos al sprite sheet 3x3 original con una lógica de centrado ultra-precisa
 * para evitar deformaciones y recortes.
 */

export const ANIMAL_AVATARS = [
  { id: "panda", name: "Panda", x: 0, y: 0 },
  { id: "cat", name: "Gato", x: 1, y: 0 },
  { id: "koala", name: "Koala", x: 2, y: 0 },
  { id: "penguin", name: "Pingüino", x: 0, y: 1 },
  { id: "fox", name: "Zorro", x: 1, y: 1 },
  { id: "owl", name: "Búho", x: 2, y: 1 },
  { id: "rabbit", name: "Conejo", x: 0, y: 2 },
  { id: "raccoon", name: "Mapache", x: 1, y: 2 },
  { id: "sloth", name: "Perezoso", x: 2, y: 2 },
];

export type AnimalAvatarId = typeof ANIMAL_AVATARS[number]["id"];

/**
 * 6.1.2 - getAvatarStyle: Retorna el estilo de fondo para el recorte del sprite
 * 
 * Basado en inspección visual, usamos un escalado del 290% para dar aire a las
 * extremidades (como las orejas del conejo) y evitar que toquen el borde.
 */
export function getAvatarStyle(avatarUrl: string | null) {
  if (!avatarUrl?.startsWith("avatar:")) {
    return { backgroundColor: "#2563eb" };
  }

  const avatarId = avatarUrl.split(":")[1];
  const avatar = ANIMAL_AVATARS.find((a) => a.id === avatarId);
  if (!avatar) return {};

  /**
   * 6.1.2.1 - Lógica de posicionamiento Pixel-Perfect
   * Con background-size: 290%, alejamos ligeramente el contenido de los bordes.
   * Esto evita que el color blanco del sprite sheet "contamine" el círculo de color
   * y permite que personajes altos (conejo/koala) respiren.
   */
  const getPos = (val: number) => {
    // Escala 0-2 (3 elementos)
    // Usamos calc para centrar matemáticamente ignorando deformaciones de aspect-ratio
    if (val === 0) return 0;   // Izquierda/Arriba
    if (val === 1) return 50;  // Centro
    if (val === 2) return 100; // Derecha/Abajo
    return 50;
  };

  return {
    backgroundImage: `url('/avatars/animal_sprites.png')`,
    backgroundSize: "300% 300%", // Forzamos 1:1 para evitar deformaciones ovaladas
    backgroundPosition: `${getPos(avatar.x)}% ${getPos(avatar.y)}%`,
    backgroundRepeat: "no-repeat",
    imageRendering: "auto" as const,
  };
}
