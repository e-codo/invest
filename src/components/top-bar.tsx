import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Clock } from "./clock";
import { ThemeToggle } from "./theme-toggle";

const buttonCls =
  "icon-btn grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-ink-3 hover:text-ink";

export function TopBar() {
  return (
    <div className="flex items-center justify-between gap-3">
      <Clock />
      <div className="flex items-center gap-2">
        <Link href="/settings" aria-label="Настройки" title="Настройки" className={buttonCls}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
            <circle cx="16" cy="6" r="2" />
            <circle cx="10" cy="12" r="2" />
            <circle cx="18" cy="18" r="2" />
          </svg>
        </Link>
        <ThemeToggle />
        <form action={logout}>
          <button type="submit" aria-label="Выйти" title="Выйти" className={buttonCls}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
