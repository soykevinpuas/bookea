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

  const isComplete = validProgress >= 100;
  
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
          className={`${isComplete ? 'text-amber-500' : 'text-blue-500'} transition-all duration-500 ease-out`}
          style={{
            filter: isComplete ? 'drop-shadow(0 0 3px rgba(245, 158, 11, 0.6))' : 'none'
          }}
        />
      </svg>
      {/* Percentage Text */}
      <span className={`
        ${isComplete ? 'text-[7.5px] text-amber-500' : 'text-[9px] text-white/90'} 
        font-black leading-none tabular-nums tracking-tighter
      `}>
        {Math.round(validProgress)}{!isComplete && '%'}
      </span>
    </div>
  );
}
