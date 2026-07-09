import { useState } from "react";

/**
 * Login navigation takes a moment (redirect to the Wix-hosted login page) —
 * show a spinner immediately and ignore further clicks.
 */
export default function LoginLink({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <a
      href="/api/auth/login?returnUrl=/"
      className={`${className ?? ""} ${busy ? "auth-busy" : ""}`}
      aria-disabled={busy}
      onClick={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        setBusy(true);
      }}
    >
      {busy && <span className="auth-spinner" aria-hidden="true" />}
      {busy ? "Redirecting…" : label}
    </a>
  );
}
