import type React from "react";

export function Gear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        {...props}
        style={{ display: "block" }}
    >
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13.1c.04-.36.06-.73.06-1.1 0-.37-.02-.74-.06-1.1l2.03-1.58a.6.6 0 0 0 .14-.76l-1.92-3.32a.6.6 0 0 0-.72-.27l-2.4.96a8.7 8.7 0 0 0-1.9-1.1l-.36-2.54A.6.6 0 0 0 13.68 1h-3.36a.6.6 0 0 0-.59.5l-.36 2.54c-.68.27-1.32.63-1.9 1.1l-2.4-.96a.6.6 0 0 0-.72.27L2.43 7.77a.6.6 0 0 0 .14.76L4.6 10.1c-.04.36-.06.73-.06 1.1 0 .37.02.74.06 1.1l-2.03 1.58a.6.6 0 0 0-.14.76l1.92 3.32c.15.27.48.38.76.27l2.4-.96c.58.46 1.22.83 1.9 1.1l.36 2.54c.04.28.28.5.59.5h3.36c.3 0 .55-.22.59-.5l.36-2.54c.68-.27 1.32-.63 1.9-1.1l2.4.96c.28.11.6 0 .72-.27l1.92-3.32a.6.6 0 0 0-.14-.76L19.4 13.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}