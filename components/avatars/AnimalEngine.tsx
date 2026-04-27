"use client";

import React from "react";

/**
 * 6.8 - AnimalEngine: Motor de renderizado de avatars dinámicos (SVG)
 * Permite cambiar colores y tipos sin usar imágenes externas.
 */

export type AnimalType = "dog" | "cat" | "rabbit" | "panda";

export interface AvatarConfig {
  type: AnimalType;
  color: string;
}

interface AnimalAvatarProps {
  type: AnimalType;
  color: string;
  size?: number | string;
  className?: string;
}

interface AnimalAvatarConfigProps {
  config: AvatarConfig;
  size?: number | string;
  className?: string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  type: "dog",
  color: "#F59E0B",
};

export const AVATAR_COLORS = [
  "#F59E0B", "#EF4444", "#3B82F6", "#10B981", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#F97316", "#22C55E", "#6366F1",
  "#111827", "#6B7280", "#D1D5DB", "#854D0E", "#BE123C"
];

const DogAvatar = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill={color} fillOpacity="0.2" />
    <path d="M30 40C30 30 40 20 50 20C60 20 70 30 70 40V70H30V40Z" fill={color} />
    <path d="M25 35C25 25 30 20 35 20V45C35 45 25 45 25 35Z" fill={color} opacity="0.8" />
    <path d="M75 35C75 25 70 20 65 20V45C65 45 75 45 75 35Z" fill={color} opacity="0.8" />
    <circle cx="40" cy="45" r="3" fill="white" />
    <circle cx="60" cy="45" r="3" fill="white" />
    <path d="M45 55C45 55 50 60 55 55" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CatAvatar = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill={color} fillOpacity="0.2" />
    <path d="M30 45C30 35 40 25 50 25C60 25 70 35 70 45V75H30V45Z" fill={color} />
    <path d="M30 30L40 45H30V30Z" fill={color} />
    <path d="M70 30L60 45H70V30Z" fill={color} />
    <circle cx="42" cy="48" r="3" fill="white" />
    <circle cx="58" cy="48" r="3" fill="white" />
    <path d="M40 60C40 60 50 65 60 60" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const RabbitAvatar = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill={color} fillOpacity="0.2" />
    <path d="M35 50C35 40 42 33 50 33C58 33 65 40 65 50V75H35V50Z" fill={color} />
    <path d="M40 10C40 10 35 25 40 40H48V10H40Z" fill={color} />
    <path d="M60 10C60 10 65 25 60 40H52V10H60Z" fill={color} />
    <circle cx="44" cy="52" r="2.5" fill="white" />
    <circle cx="56" cy="52" r="2.5" fill="white" />
    <circle cx="50" cy="58" r="1.5" fill="pink" />
  </svg>
);

const PandaAvatar = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="45" fill={color} fillOpacity="0.2" />
    <circle cx="50" cy="55" r="25" fill={color} />
    <circle cx="35" cy="35" r="10" fill={color} />
    <circle cx="65" cy="35" r="10" fill={color} />
    <circle cx="42" cy="52" r="5" fill="white" />
    <circle cx="58" cy="52" r="5" fill="white" />
    <circle cx="42" cy="52" r="2" fill={color} />
    <circle cx="58" cy="52" r="2" fill={color} />
  </svg>
);

export function AnimalEngine(props: AnimalAvatarProps | AnimalAvatarConfigProps) {
  // Support both modes: direct props or config object
  const { type, color, size = 48, className = "" } = 'config' in props 
    ? { type: props.config.type, color: props.config.color, size: props.size, className: props.className }
    : props;

  const renderAvatar = () => {
    switch (type) {
      case "dog": return <DogAvatar color={color} />;
      case "cat": return <CatAvatar color={color} />;
      case "rabbit": return <RabbitAvatar color={color} />;
      case "panda": return <PandaAvatar color={color} />;
      default: return null;
    }
  };

  return (
    <div 
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
    >
      {renderAvatar()}
    </div>
  );
}
