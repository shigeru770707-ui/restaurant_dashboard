interface IconProps {
  size?: number
  className?: string
}

export function InstagramIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none">
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)" />
    </svg>
  )
}

export function LineIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      <path
        d="M12 2C6.48 2 2 5.82 2 10.5c0 4.21 3.74 7.74 8.78 8.4.34.07.81.22.93.51.1.26.07.67.03.94l-.15.89c-.05.27-.21 1.05.92.57 1.13-.48 6.1-3.59 8.33-6.15C22.77 13.48 22 11.56 22 10.5 22 5.82 17.52 2 12 2zm-3.5 11a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0V12h1.5a.5.5 0 0 1 0 1H8.5zm2.5-.5a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 1 0v4zm4.5.5h-2a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0v1.5h1.5a.5.5 0 0 1 0 1H13v1h1.5a.5.5 0 0 1 0 1zm3-3h-1.5a.5.5 0 0 1 0-1H18v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1H19v.5a.5.5 0 0 1-1 0V10z"
        fill="#00B900"
      />
    </svg>
  )
}

export function GA4Icon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      <path d="M22 3.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v17.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V3.2z" fill="#F9AB00" />
      <path d="M14 9.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v11.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V9.2z" fill="#E37400" />
      <circle cx="4" cy="19" r="3" fill="#E37400" />
    </svg>
  )
}

export function GBPIcon({ size = 20, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
      <circle cx="12" cy="9" r="3" fill="#fff" />
    </svg>
  )
}
