'use client';

/**
 * Animated success checkmark with optional confetti particles
 * Used after important actions (BC created, supplier added, etc.)
 *
 * - SVG animated checkmark using stroke-dashoffset
 * - Circle draws first, then checkmark draws
 * - Optional subtle confetti particles (CSS-only)
 * - Uses keyframes from globals.css
 */

import { useEffect, useState } from 'react';

interface SuccessAnimationProps {
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  showConfetti?: boolean;
}

const sizeConfig = {
  sm: { container: 'w-16 h-16', stroke: 2.5, icon: 'w-16 h-16' },
  md: { container: 'w-20 h-20', stroke: 2.5, icon: 'w-20 h-20' },
  lg: { container: 'w-28 h-28', stroke: 3, icon: 'w-28 h-28' },
};

const confettiColors = ['#EC7620', '#34C759', '#007AFF', '#FF9500', '#AF52DE'];

export function SuccessAnimation({
  title,
  subtitle,
  size = 'md',
  showConfetti = false,
}: SuccessAnimationProps) {
  const [visible, setVisible] = useState(false);
  const config = sizeConfig[size];

  useEffect(() => {
    // Small delay so the bounce-in animation triggers after mount
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Confetti + circle container */}
      <div className={`relative ${config.container} mb-6`}>
        {/* Confetti particles */}
        {showConfetti && visible && (
          <>
            {confettiColors.map((color, i) => {
              // Position confetti dots in a circle around the checkmark
              const angle = (i / confettiColors.length) * 360;
              const rad = (angle * Math.PI) / 180;
              const offsetX = Math.cos(rad) * 44;
              const offsetY = Math.sin(rad) * 44;
              return (
                <span
                  key={i}
                  className="absolute w-[6px] h-[6px] rounded-full"
                  style={{
                    backgroundColor: color,
                    left: `calc(50% + ${offsetX}px - 3px)`,
                    top: `calc(50% + ${offsetY}px - 3px)`,
                    animation: `confetti-fade 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${0.4 + i * 0.08}s both`,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Animated SVG */}
        <div className={`${config.icon} ${visible ? 'animate-bounce-in' : 'opacity-0'}`}>
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Background glow */}
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="url(#successGradient)"
            />
            {/* Circle outline — draws in */}
            <circle
              cx="40"
              cy="40"
              r="32"
              stroke="#34C759"
              strokeWidth={config.stroke}
              fill="none"
              strokeLinecap="round"
              style={{
                strokeDasharray: 201,
                strokeDashoffset: visible ? 0 : 201,
                transition: 'stroke-dashoffset 0.6s cubic-bezier(0.65, 0, 0.35, 1)',
              }}
            />
            {/* Checkmark — draws after circle */}
            <path
              d="M28 41 L36 49 L52 33"
              stroke="white"
              strokeWidth={config.stroke + 0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className={visible ? 'animate-check-draw' : ''}
              style={{
                strokeDasharray: 24,
                strokeDashoffset: 24,
              }}
            />
            <defs>
              <radialGradient id="successGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#34C759" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#34C759" stopOpacity="0.05" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Title */}
      <h2
        className={`font-bold text-[#1D1D1F] ${
          size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-lg' : 'text-xl'
        } ${visible ? 'animate-slide-up' : 'opacity-0'}`}
        style={{ animationDelay: '0.3s' }}
      >
        {title}
      </h2>

      {/* Subtitle */}
      {subtitle && (
        <p
          className={`text-[#86868B] mt-2 ${
            size === 'lg' ? 'text-base' : 'text-sm'
          } ${visible ? 'animate-slide-up' : 'opacity-0'}`}
          style={{ animationDelay: '0.45s' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
