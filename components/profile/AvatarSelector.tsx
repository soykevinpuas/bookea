"use client";

import { Check, Loader2, Info, Shuffle } from "lucide-react";
import { AnimalEngine, AvatarStyleType, AVATAR_COLORS, generateRandomSeed } from "@/components/avatars/AnimalEngine";
import { useState, useEffect, useRef } from "react";
import { parseAvatarConfig, stringifyAvatarConfig } from "@/lib/avatars-v2";

/**
 * 6.4 - AvatarSelector: Nuevo constructor de identidad con DiceBear API
 * Permite elegir estilo y color de fondo
 */

interface AvatarSelectorProps {
  currentAvatarConfig?: string | null;
  onSelect: (configStr: string) => void;
  isUpdating?: boolean;
}

const STYLES: { id: AvatarStyleType; name: string }[] = [
  { id: "avataaars", name: "Persona" },
  { id: "bottts", name: "Robot" },
  { id: "lorelei", name: "Artístico" },
];

const DEFAULT_AVATAR_COLOR = "b6e3f4";

const normalizeHexColor = (value: string | null | undefined, fallback = DEFAULT_AVATAR_COLOR) => {
  const color = (value || "").replace("#", "").trim().toLowerCase();
  return /^[0-9a-f]{6}$/.test(color) ? color : fallback;
};

const getRandomAvatarColor = (currentColor?: string) => {
  const colors = AVATAR_COLORS.filter((color) => color !== currentColor);
  const pool = colors.length > 0 ? colors : AVATAR_COLORS;
  return pool[Math.floor(Math.random() * pool.length)] || DEFAULT_AVATAR_COLOR;
};

const hasSavedAvatar = (config?: string | null) => !!config && config.startsWith("v2:");

export default function AvatarSelector({ currentAvatarConfig, onSelect, isUpdating }: AvatarSelectorProps) {
  const initialConfig = parseAvatarConfig(currentAvatarConfig);
  const initialColor = hasSavedAvatar(currentAvatarConfig)
    ? normalizeHexColor(initialConfig.color)
    : getRandomAvatarColor();
  
  // Inicializar semilla: leer del config o caché, NUNCA generar una nueva automáticamente
  const [seed, setSeed] = useState<string>(() => {
    // 1. Intentar usar la semilla del config actual
    if (initialConfig.seed && initialConfig.seed !== "") {
      return initialConfig.seed;
    }
    // 2. Intentar leer del caché local
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('bookea-avatar-cache');
        if (cached) {
          const config = JSON.parse(cached);
          if (config.seed && config.seed !== "") {
            return config.seed;
          }
        }
      } catch {}
    }
    // 3. Si no hay semilla, usar "default" (NO generar una nueva)
    return "default";
  });
  
  const [selectedType, setSelectedType] = useState<AvatarStyleType>(initialConfig.type as AvatarStyleType || "avataaars");
  const [selectedColor, setSelectedColor] = useState<string>(initialColor);
  const [colorText, setColorText] = useState<string>(initialColor);
  const [isShuffling, setIsShuffling] = useState(false);
  const draftConfigRef = useRef({ type: selectedType, color: selectedColor, seed });

  // Sincronizar con props externas SOLO en el primer montaje
  const isInitialized = useRef(false);

  const persistDraft = (config: { type: AvatarStyleType; color: string; seed: string }) => {
    const normalizedConfig = { ...config, color: normalizeHexColor(config.color) };
    draftConfigRef.current = normalizedConfig;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bookea-avatar-cache', JSON.stringify(normalizedConfig));
    }
  };

  useEffect(() => {
    draftConfigRef.current = {
      type: selectedType,
      color: normalizeHexColor(selectedColor),
      seed,
    };
  }, [selectedType, selectedColor, seed]);
  
  useEffect(() => {
    if (!isInitialized.current && currentAvatarConfig) {
      queueMicrotask(() => {
        if (isInitialized.current) return;
        const config = parseAvatarConfig(currentAvatarConfig);
        const normalizedColor = normalizeHexColor(config.color);
        setSelectedType((config.type as AvatarStyleType) || "avataaars");
        setSelectedColor(normalizedColor);
        setColorText(normalizedColor);
        if (config.seed && config.seed !== "") {
          setSeed(config.seed);
        }
        persistDraft({
          type: (config.type as AvatarStyleType) || "avataaars",
          color: normalizedColor,
          seed: config.seed && config.seed !== "" ? config.seed : draftConfigRef.current.seed,
        });
        isInitialized.current = true;
      });
    }
  }, [currentAvatarConfig]);

  // Cuando cambia el estilo, MANTENER la misma semilla exacta
  const handleStyleChange = (newType: AvatarStyleType) => {
    setSelectedType(newType);
    persistDraft({ ...draftConfigRef.current, type: newType });
  };

  const handleColorChange = (rawColor: string) => {
    const nextColor = normalizeHexColor(rawColor, draftConfigRef.current.color);
    setSelectedColor(nextColor);
    setColorText(nextColor);
    persistDraft({ ...draftConfigRef.current, color: nextColor });
  };

  const handleRandomColor = () => {
    handleColorChange(getRandomAvatarColor(draftConfigRef.current.color));
  };

  // Mezclar: generar nueva semilla sin cambiar estilo
  const handleShuffle = () => {
    setIsShuffling(true);
    const newSeed = generateRandomSeed();
    setSeed(newSeed);
    persistDraft({ ...draftConfigRef.current, seed: newSeed });
    // Esperar a que el SVG se renderice (2 segundos para dar tiempo)
    setTimeout(() => setIsShuffling(false), 2000);
  };

  const handleSave = () => {
    const config = {
      ...draftConfigRef.current,
      type: selectedType,
      color: normalizeHexColor(selectedColor),
      seed,
    };
    const configStr = stringifyAvatarConfig(config);
    persistDraft(config);
    onSelect(configStr);
  };

  const hasChanges = stringifyAvatarConfig({ type: selectedType, color: normalizeHexColor(selectedColor), seed }) !== (currentAvatarConfig || "");

  return (
    <div className="space-y-10">
      {/* 6.4.1 - Previsualización Gigante */}
      <div className="flex flex-col items-center">
        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-blue-500/20 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <AnimalEngine 
              type={selectedType} 
              color={selectedColor} 
              seed={seed}
              size={140} 
              className="relative bg-white dark:bg-[#151515] shadow-2xl border-4 border-white dark:border-white/5 outline outline-1 outline-white/10" 
            />
            {/* Botón de mezclar/shuffle */}
             <button
               onClick={handleShuffle}
               disabled={isShuffling}
               className="absolute bottom-2 right-2 p-2 bg-white/80 dark:bg-black/80 rounded-full hover:scale-110 transition-transform shadow-lg disabled:opacity-50"
               title="Generar nuevo avatar"
             >
               {isShuffling ? (
                 <Loader2 className="w-6 h-6 animate-spin" />
               ) : (
                 '🎲'
               )}
             </button>
          </div>
        </div>
        <p className="mt-4 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Tu Identidad</p>
      </div>

      {/* 6.4.2 - Selector de Estilo */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-2">
          1. Elige tu Estilo
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => handleStyleChange(style.id)}
              className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 p-2 ${
                selectedType === style.id 
                  ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10" 
                  : "border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 bg-white dark:bg-white/5"
              }`}
            >
              <AnimalEngine type={style.id} color={selectedType === style.id ? selectedColor : "94a3b8"} seed={seed} size={40} />
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mt-1">{style.name}</span>
              {selectedType === style.id && (
                <div className="absolute top-1 right-1">
                  <Check className="w-3 h-3 text-amber-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

       {/* 6.4.3 - Selector de Color */}
       <div className="space-y-4">
         <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-2">
           2. Personaliza el Color de Fondo
         </h3>
         <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
	           <input
	             type="color"
	             value={`#${normalizeHexColor(selectedColor)}`}
	             onChange={(e) => handleColorChange(e.target.value)}
	             className="w-20 h-20 rounded-2xl border-4 border-gray-200 dark:border-white/10 cursor-pointer shadow-lg hover:scale-105 transition-transform"
	           />
	           <div className="flex-1 space-y-2">
	             <div>
	               <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-1">Color seleccionado</p>
	               <p className="text-lg font-mono font-black text-gray-900 dark:text-white">#{selectedColor}</p>
	             </div>
	             <div className="flex gap-2">
	               <input
	                 type="text"
	                 value={colorText}
	                 onChange={(e) => {
	                   const val = e.target.value.replace('#', '').trim();
	                   if (/^[0-9a-fA-F]{0,6}$/.test(val)) {
	                     setColorText(val);
	                     if (/^[0-9a-fA-F]{6}$/.test(val)) {
	                       handleColorChange(val);
	                     }
	                   }
	                 }}
	                 onBlur={() => setColorText(normalizeHexColor(selectedColor))}
	                 placeholder="Hex sin #"
	                 className="min-w-0 flex-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
	                 maxLength={6}
	               />
	               <button
	                 type="button"
	                 onClick={handleRandomColor}
	                 disabled={isUpdating}
	                 className="shrink-0 px-3 rounded-xl bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/60 hover:text-blue-500 hover:border-blue-500/50 transition-colors disabled:opacity-50"
	                 title="Color aleatorio"
	               >
	                 <Shuffle className="w-4 h-4" />
	               </button>
	             </div>
	           </div>
	         </div>
	       </div>

      {/* 6.4.4 - Botón de Guardado */}
      <button
        onClick={handleSave}
        disabled={isUpdating || !hasChanges}
        className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl"
      >
        {isUpdating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar Cambios"
        )}
      </button>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
        <Info className="w-4 h-4 text-blue-500" />
        <p className="text-[10px] text-blue-500/80 leading-tight">
          Tu avatar es visible en la comunidad y al dejar reseñas. ¡Hazlo único!
        </p>
      </div>
    </div>
  );
}
