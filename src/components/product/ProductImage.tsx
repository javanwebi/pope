import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { STORE_ASSETS } from '../../assets/images';

interface ProductImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
  disableFallback?: boolean;
  alt: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  fallbackSrc = STORE_ASSETS.categories.belts,
  disableFallback = false,
  alt,
  className = '',
  onError,
  ...rest
}) => {
  const initialSrc = (src && String(src).trim()) || (disableFallback ? '' : fallbackSrc);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(!initialSrc);

  useEffect(() => {
    const next = (src && String(src).trim()) || (disableFallback ? '' : fallbackSrc);
    setCurrentSrc(next);
    setFailed(!next);
  }, [src, fallbackSrc, disableFallback]);

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!disableFallback && fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      return;
    }
    setFailed(true);
    onError?.(event);
  };

  if (failed || !currentSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-50 text-slate-400 ${className}`}
        role="img"
        aria-label={alt || 'تصویر محصول'}
      >
        <Package className="w-8 h-8 opacity-45" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={handleError}
      className={className}
      {...rest}
    />
  );
};
