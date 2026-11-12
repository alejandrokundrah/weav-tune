import markSvg from '@/assets/logo-mark.svg?raw';

// Weav-Tune mark, preserving original colors and scaling cleanly to size
const markup = markSvg
  .replace(/width="[^"]*"/, 'width="100%"')
  .replace(/height="[^"]*"/, 'height="100%"');

export function LogoMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
