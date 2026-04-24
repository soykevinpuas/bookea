"use client";

import { motion } from "framer-motion";
import { Check, Loader2, Info } from "lucide-react";
import { AnimalEngine, AnimalType, AVATAR_COLORS } from "@/components/avatars/AnimalEngine";
import { useState, useEffect } from "react";
import { parseAvatarConfig, stringifyAvatarConfig } from "@/lib/avatars-v2";

/**
 * 6.4 - AvatarSelector: Nuevo constructor de identidad animal personalizable.
 * Permite elegir animal y color de una paleta curada.
 */

interface AvatarSelectorProps {
  currentAvatarConfig?: string | null;
  onSelect: (configStr: string) => void;
  isUpdating?: boolean;
}

const ANIMALS: { id: AnimalType; name: string }[] = [
  { id: "dog", name: "Perro" },
  { id: "cat", name: "Gato" },
  { id: "rabbit", name: "Conejo" },
  { id: "panda", name: "Panda" },
];

export default function AvatarSelector({ currentAvatarConfig, onSelect, isUpdating }: AvatarSelectorProps) {
  const initialConfig = parseAvatarConfig(currentAvatarConfig);
  const [selectedType, setSelectedType] = useState<AnimalType>(initialConfig.type);
  const [selectedColor, setSelectedColor] = useState<string>(initialConfig.color);

  // Sincronizar con props externas cuando carguen
  useEffect(() => {
    const config = parseAvatarConfig(currentAvatarConfig);
    setSelectedType(config.type);
    setSelectedColor(config.color);
  }, [currentAvatarConfig]);

  const handleSave = () => {
    const configStr = stringifyAvatarConfig({ type: selectedType, color: selectedColor });
    onSelect(configStr);
  };

  const hasChanges = stringifyAvatarConfig({ type: selectedType, color: selectedColor }) !== (currentAvatarConfig || "");

  return (
    <div className="space-y-10">
      {/* 6.4.1 - Previsualización Gigante */}
      <div className="flex flex-col items-center">
        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-blue-500/20 rounded-full blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <AnimalEngine 
            type={selectedType} 
            color={selectedColor} 
            size={140} 
            className="relative bg-white dark:bg-[#151515] shadow-2xl border-4 border-white dark:border-white/5 outline outline-1 outline-white/10" 
          />
        </div>
        <p className="mt-4 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Tu Identidad</p>
      </div>

      {/* 6.4.2 - Selector de Especie */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-2">
          1. Elige tu Avatar
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {ANIMALS.map((animal) => (
            <button
              key={animal.id}
              onClick={() => setSelectedType(animal.id)}
              className={`relative aspect-square rounded-2xl border-2 transition-all flex items-center justify-center overflow-hidden ${
                selectedType === animal.id 
                  ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10" 
                  : "border-gray-100 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 bg-white dark:bg-white/5"
              }`}
            >
              <AnimalEngine type={animal.id} color={selectedType === animal.id ? selectedColor : "#94a3b8"} size={40} />
              {selectedType === animal.id && (
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
          2. Personaliza el Color
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`w-full aspect-square rounded-full border-4 transition-all transform hover:scale-110 flex items-center justify-center ${
                selectedColor === color 
                  ? "border-white dark:border-amber-500 shadow-lg scale-110" 
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && <Check className="w-4 h-4 text-white drop-shadow-md" />}
            </button>
          ))}
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
          Tu avatar animal es visible en la comunidad y al dejar reseñas. ¡Hazlo único!
        </p>
      </div>
    </div>
  );
}

