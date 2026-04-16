"use client";

import React from "react";

interface ProgressCircleProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function ProgressCircle({ 
  progress, 
  size = 36, 
  strokeWidth = 3,
  className = ""
}: ProgressCircleProps) {
  // Asegurar que el progreso sea un número válido y esté entre 0 y 100
  const validProgress = isNaN(progress) || progress === undefined ? 0 : Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (validProgress / 100) * circumference;

  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background Circle */}
      <svg className="absolute transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-white/10"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-500 transition-all duration-500 ease-out"
        />
      </svg>
      {/* Percentage Text */}
      <span className="text-[9px] font-black text-white/90">
        {Math.round(validProgress)}%
      </span>
    </div>
  );
}
