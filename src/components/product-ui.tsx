import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-12 rounded-2xl", className)}>
      {src && <AvatarImage src={src} alt={`Photo de ${name}`} className="object-cover" />}
      <AvatarFallback className="rounded-2xl bg-primary-soft font-display font-bold text-primary-soft-foreground">
        {initials(name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-lg font-bold text-foreground">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const bounded = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{Math.round(bounded)} %</span>
      </div>
      <progress
        className="h-2 w-full overflow-hidden rounded-full accent-primary"
        aria-label={label}
        value={bounded}
        max={100}
      />
    </div>
  );
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to as never} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}