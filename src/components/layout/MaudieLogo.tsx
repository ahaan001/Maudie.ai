import Image from 'next/image';

interface MaudieLogoProps {
  height?: number;
}

export function MaudieLogo({ height = 32 }: MaudieLogoProps) {
  return (
    <Image
      src="/maudie_logo_final.svg"
      alt="maudie.ai"
      height={height}
      width={height * 4}
      style={{ height, width: 'auto' }}
      priority
    />
  );
}
