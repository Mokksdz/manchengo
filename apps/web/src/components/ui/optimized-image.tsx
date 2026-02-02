'use client';

import Image, { ImageProps } from 'next/image';

/**
 * OptimizedImage - Wrapper around next/image with sensible defaults
 *
 * Usage:
 *   <OptimizedImage src="/logo.png" alt="Manchengo Logo" width={200} height={50} />
 *   <OptimizedImage src={userAvatar} alt={userName} fill className="object-cover" />
 */

interface OptimizedImageProps extends Omit<ImageProps, 'loading'> {
  fallback?: string;
}

export function OptimizedImage({
  fallback = '/placeholder.svg',
  alt,
  ...props
}: OptimizedImageProps) {
  return (
    <Image
      alt={alt}
      loading="lazy"
      quality={80}
      placeholder="blur"
      blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PC9zdmc+"
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.src = fallback;
      }}
      {...props}
    />
  );
}
