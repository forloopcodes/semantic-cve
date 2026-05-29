import { ShieldAlert } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 text-accent" />
          <span>Semantic CVE &mdash; vulnerability intelligence platform</span>
        </div>
        <p className="text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Semantic CVE
        </p>
      </div>
    </footer>
  );
}
