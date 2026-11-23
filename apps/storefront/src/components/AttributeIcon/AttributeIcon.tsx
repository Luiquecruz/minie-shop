export interface AttributeIconProps {
  iconKey?: string;
  size?: number;
  className?: string;
}

const ICON_PATHS: Record<string, string> = {
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  wifi: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  droplet: 'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z',
  battery: 'M6 7h11a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2zm16 4v2',
  cup: 'M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v3M10 2v3M14 2v3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'volume-x': 'M11 5L6 9H2v6h4l5 4V5zm11 4l-6 6m0-6l6 6',
  video: 'M23 7l-7 5 7 5V7zM1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1V5z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  monitor: 'M2 3h20v14H2zM8 21h8M12 17v4',
  crosshair: 'M12 2v4m0 12v4M2 12h4m12 0h4M12 12m-7 0a7 7 0 1014 0 7 7 0 10-14 0',
  sun: 'M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 12m-5 0a5 5 0 1010 0 5 5 0 10-10 0',
};

const DEFAULT_ICON_PATH =
  'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

/**
 * Renders crisp inline SVG icons for catalog attribute `icon_key` values.
 * Unknown or missing keys safely fall back to a default checkmark circle icon.
 */
export function AttributeIcon({
  iconKey,
  size = 16,
  className = '',
}: AttributeIconProps) {
  const path =
    iconKey && Object.hasOwn(ICON_PATHS, iconKey)
      ? ICON_PATHS[iconKey]
      : DEFAULT_ICON_PATH;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-icon-key={
        iconKey && Object.hasOwn(ICON_PATHS, iconKey) ? iconKey : 'default'
      }
    >
      <path d={path} />
    </svg>
  );
}

export default AttributeIcon;
