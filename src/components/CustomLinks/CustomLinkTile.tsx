'use client';

import type { CustomLinkItem } from '@/types/custom-link';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { getDefaultImageFor, isSafeHttpUrl, normalizeUrl } from '@/lib/utils/url-util';

type CustomLinkTileProps = {
  item: CustomLinkItem;
};

export default function CustomLinkTile({ item }: CustomLinkTileProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const finalImageUrl = getDefaultImageFor(item.type);
  const isLocalImage = finalImageUrl.startsWith('/');
  // Defense in depth: never render legacy javascript:/data: URLs stored before
  // validation. Normalize first so pre-fix bare domains ("example.com") keep working.
  const normalizedHref = normalizeUrl(item.url);
  const safeHref = isSafeHttpUrl(normalizedHref) ? normalizedHref : '#';

  return (
    <Link
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative inline-flex items-center justify-center w-8 h-8"
      title={item.title}
    >
      <div className="relative w-8 h-8">
        {/* Skeleton */}
        <div className={`absolute inset-0 bg-muted/50 rounded transition-opacity duration-200 ${imageLoading ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
        {isLocalImage
          ? (
            <Image
              src={finalImageUrl}
              alt={`${item.title} icon`}
              width={32}
              height={32}
              className={`absolute inset-0 w-full h-full object-contain transition-all duration-200 hover:scale-110 ${imageLoading ? 'opacity-0' : 'opacity-80 hover:opacity-100'}`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              priority={false}
              sizes="32px"
            />
          )
          : !imageError
            ? (
              <Image
                src={finalImageUrl}
                alt={`${item.title} icon`}
                className={`absolute inset-0 w-full h-full object-contain transition-all duration-200 hover:scale-110 ${imageLoading ? 'opacity-0' : 'opacity-80 hover:opacity-100'}`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            )
            : (
              <div className="w-8 h-8 bg-muted/50 rounded flex items-center justify-center text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                {item.type.charAt(0).toUpperCase()}
              </div>
            )}
      </div>
    </Link>
  );
}
