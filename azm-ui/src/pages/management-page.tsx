import { LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    <div className="space-y-6">
      <div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Bulk actions
        </span>
        <h2 className="text-lg font-semibold font-mono">azm management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ActionCard
          icon={<LogIn className="size-4 text-primary" />}
          title="Login expired"
          description="Re-authenticate only clients whose token failed validation."
          command="azm login-expired"
          primary
          disabled={busy}
          onClick={onLoginExpired}
        />
        <ActionCard
          icon={<RefreshCw className="size-4 text-primary" />}
          title="Login all"
          description="Sequential interactive login for every registered client."
          command="azm login-all"
          disabled={busy}
          onClick={onLoginAll}
        />
        <ActionCard
          icon={<ShieldAlert className="size-4 text-primary" />}
          title="Check expired"
          description="Force refresh-token validation and list expired clients."
          command="azm check-expired"
          disabled={busy}
          onClick={onCheckExpired}
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  command,
  primary,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  command: string;
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="gap-1">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary/10 grid place-items-center">
            {icon}
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end gap-3">
        <code className="text-[11px] font-mono text-muted-foreground block truncate">
          {command}
        </code>
        <Button
          onClick={onClick}
          disabled={disabled}
          variant={primary ? "default" : "outline"}
          className="cursor-pointer"
        >
          Run
        </Button>
      </CardContent>
    </Card>
  );
}
