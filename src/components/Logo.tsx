/** Three stops on a line: received, reserved, confirmed. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 34 12" aria-hidden className="h-3 w-[2.125rem]">
        <path d="M6 6h22" stroke="#5b6e87" strokeWidth="2" />
        <circle cx="6" cy="6" r="4.5" fill="#5c8bff" />
        <circle cx="17" cy="6" r="4.5" fill="#e0a21a" />
        <circle cx="28" cy="6" r="4.5" fill="#35c27a" />
      </svg>
      <span className="type-wide text-xl">balcão</span>
    </span>
  );
}
