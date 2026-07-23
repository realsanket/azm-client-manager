import {
  Activity,
  ShieldCheck,
  LogIn,
  Repeat,
  FileText,
  Trash2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { TokenBadge } from "@/components/token-badge";
import { tokenState } from "@/lib/azm-format";
import type { AzmClient } from "@/hooks/useAzm";

export function ClientPage({
  busy,
  client,
  currentToken,
  logLines,
  subscriptionDraft,
  onCheck,
  onLogin,
  onLog,
  onRemove,
  onSetLogLines,
  onSetSubscription,
  onStatus,
  onSubscriptionDraftChange,
  onSwitch,
}: {
  busy: boolean;
  client: AzmClient | null;
  currentToken: boolean | undefined;
  logLines: number;
  subscriptionDraft: string;
  onCheck: (client: AzmClient) => void;
  onLogin: (client: AzmClient) => void;
  onLog: (client: AzmClient) => void;
  onRemove: (client: AzmClient) => void;
  onSetLogLines: (value: number) => void;
  onSetSubscription: (client: AzmClient) => void;
  onStatus: (client: AzmClient) => void;
  onSubscriptionDraftChange: (value: string) => void;
  onSwitch: (client: AzmClient) => void;
}) {
  if (!client) {
    return (
      <div className="h-full min-h-64 grid place-items-center text-sm text-muted-foreground border border-dashed rounded-md">
        Select or add a client
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Client context
          </span>
          <h2 className="text-lg font-semibold font-mono">{client.name}</h2>
        </div>
        <TokenBadge state={tokenState(client, currentToken)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Detail label="Tenant" value={client.tenant} />
        <Detail
          label="Subscription"
          value={client.subscription || "Not set"}
        />
        <Detail label="Email" value={client.email} />
        <Detail
          label="Token cache"
          value={client.logged_in ? "Present" : "Missing"}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button
          onClick={() => onStatus(client)}
          disabled={busy}
          className="cursor-pointer"
        >
          <Activity className="size-4" />
          Status
        </Button>
        <Button
          variant="outline"
          onClick={() => onCheck(client)}
          disabled={busy}
          className="cursor-pointer"
        >
          <ShieldCheck className="size-4" />
          Check
        </Button>
        <Button
          variant="outline"
          onClick={() => onLogin(client)}
          disabled={busy}
          className="cursor-pointer"
        >
          <LogIn className="size-4" />
          Login
        </Button>
        <Button
          variant="outline"
          onClick={() => onSwitch(client)}
          disabled={busy}
          className="cursor-pointer"
        >
          <Repeat className="size-4" />
          Switch
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label
              htmlFor="subscription-input"
              className="text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              Subscription ID
            </Label>
            <Input
              id="subscription-input"
              value={subscriptionDraft}
              onChange={(event) =>
                onSubscriptionDraftChange(event.target.value)
              }
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="font-mono text-sm"
            />
          </div>
          <Button
            onClick={() => onSetSubscription(client)}
            disabled={busy || !subscriptionDraft.trim()}
            className="cursor-pointer"
          >
            <Save className="size-4" />
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5 max-w-28">
            <Label
              htmlFor="log-lines"
              className="text-[11px] uppercase tracking-wider text-muted-foreground"
            >
              Log lines
            </Label>
            <Input
              id="log-lines"
              type="number"
              min={1}
              max={500}
              value={logLines}
              onChange={(event) => onSetLogLines(Number(event.target.value))}
              className="font-mono text-sm"
            />
          </div>
          <div />
          <Button
            variant="outline"
            onClick={() => onLog(client)}
            disabled={busy}
            className="cursor-pointer"
          >
            <FileText className="size-4" />
            Show log
          </Button>
          <Button
            variant="destructive"
            onClick={() => onRemove(client)}
            disabled={busy}
            className="cursor-pointer"
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <strong
        className="block text-sm font-mono mt-1 truncate"
        title={value}
      >
        {value}
      </strong>
    </div>
  );
}
