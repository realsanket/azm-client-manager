import { LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ManagementPage({
  busy,
  onCheckExpired,
  onLoginAll,
  onLoginExpired,
}: {
  busy: boolean;
  onCheckExpired: () => void;
  onLoginAll: () => void;
  onLoginExpired: () => void;
}) {
  return (
    <div className="space-y-8">
      <header>
        <span className="eyebrow">bulk operations</span>
        <h2
          className="mt-1 text-3xl font-serif tracking-tight"
          style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50' }}
        >
          Manage every client at once.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
          Run the same maintenance action across every registered tenant. Use
          these sparingly — each triggers real Azure CLI login flows.
        </p>
      </header>

      <div className="border-y border-border/70 divide-y divide-border/70">
        <Row
          num="01"
          icon={<LogIn className="size-4 text-foreground" />}
          title="Login expired"
          command="azm login-expired"
          description="Interactive re-login for clients whose refresh token failed."
          primary
          disabled={busy}
          onClick={onLoginExpired}
        />
        <Row
          num="02"
          icon={<RefreshCw className="size-4 text-foreground" />}
          title="Login all"
          command="azm login-all"
          description="Sequential interactive login for every registered client."
          disabled={busy}
          onClick={onLoginAll}
        />
        <Row
          num="03"
          icon={<ShieldAlert className="size-4 text-foreground" />}
          title="Check expired"
          command="azm check-expired"
          description="Force refresh-token validation. Lists which clients need attention."
          disabled={busy}
          onClick={onCheckExpired}
        />
      </div>
    </div>
  );
}

function Row({
  num,
  icon,
  title,
  command,
  description,
  primary,
  disabled,
  onClick,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  command: string;
  description: string;
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-4 py-4 px-1">
      <span className="font-mono text-xs text-muted-foreground/70 tabular-nums w-6">
        {num}
      </span>
      <span className="size-9 grid place-items-center rounded-sm border border-border">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="font-serif text-lg tracking-tight"
            style={{ fontVariationSettings: '"opsz" 24, "SOFT" 30' }}
          >
            {title}
          </span>
          <code className="font-mono text-[11px] text-muted-foreground truncate">
            {command}
          </code>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <Button
        onClick={onClick}
        disabled={disabled}
        variant={primary ? "default" : "outline"}
        className="cursor-pointer font-mono rounded-sm"
      >
        run
      </Button>
    </div>
  );
}
