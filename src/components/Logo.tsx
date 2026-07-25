export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ms-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* stacked layers */}
      <rect x="4" y="11" width="16" height="16" rx="4.5" fill="#3f3f46" />
      <rect x="9" y="8" width="16" height="16" rx="4.5" fill="#52525b" />
      <rect x="12" y="5" width="16" height="16" rx="4.5" fill="url(#ms-grad)" />
      {/* cut-out subject */}
      <circle cx="20" cy="13" r="3.4" fill="#fff" fillOpacity="0.92" />
    </svg>
  );
}

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-7 w-7" />
      <span className="text-[15px] font-semibold tracking-tight text-neutral-100">Model Studio</span>
    </span>
  );
}
