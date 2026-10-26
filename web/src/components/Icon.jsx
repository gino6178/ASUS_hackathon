// Line icons on a 24 grid, drawn with currentColor so they follow the text they sit in.
const P = {
  home: <path d="M4 11.5 12 4.5l8 7V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  match: <path d="M5 19v-7M11 19V5M17 19v-10M3 19.5h18" />,
  coaches: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.4-3.4 2.8-5.3 6-5.3s5.6 1.9 6 5.3" /><circle cx="17" cy="9" r="2.4" /><path d="M16.4 14.3c2.6.2 4.3 1.9 4.6 4.6" /></>,
  table: <><circle cx="12" cy="12.5" r="4.8" /><circle cx="12" cy="3.6" r="1.6" /><circle cx="20.2" cy="9.6" r="1.6" /><circle cx="3.8" cy="9.6" r="1.6" /><circle cx="17" cy="20" r="1.6" /><circle cx="7" cy="20" r="1.6" /></>,
  live: <><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" /><path d="M8.1 7.9a5.8 5.8 0 0 0 0 8.2M15.9 7.9a5.8 5.8 0 0 1 0 8.2M5.2 5a9.8 9.8 0 0 0 0 14M18.8 5a9.8 9.8 0 0 1 0 14" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />,
  memory: <path d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v14l-6.5-3.8L5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  down: <path d="m6 9 6 6 6-6" />,
  back: <path d="M15 5l-7 7 7 7" />,
  mic: <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v3" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.2" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: <path d="M8 5.5v13M16 5.5v13" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: <path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17v.2" />,
  download: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />,
};

export default function Icon({ name, size = 20, className = "" }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </svg>
  );
}
