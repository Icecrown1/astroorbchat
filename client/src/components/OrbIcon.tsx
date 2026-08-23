/** Единый символ звёзд-орбов: фирменная восьмиконечная звезда (как на сайте и в октаграмме). */
export function OrbIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M8 0l1.6 4.9L14.9 3 11.4 6.9 16 8l-4.6 1.1 3.5 3.9-5.3-1.9L8 16l-1.6-4.9L1.1 13l3.5-3.9L0 8l4.6-1.1L1.1 3l5.3 1.9L8 0z"
        fill="currentColor"
      />
    </svg>
  );
}
