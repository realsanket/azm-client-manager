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
import { TokenBadge } from "@/components/token-badge";
import { tokenState } from "@/lib/azm-format";
import { hueForClient } from "@/lib/client-hue";
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
      <div className="h-64 grid place-items-center text-sm text-muted-foreground font-mono">
        Select or add a client.
      </div>
    );
  }

  const hue = hueForClient(client.name);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow">client</span>
          <h2
            className="mt-1 flex items-baseline gap-2 text-3xl font-serif tracking-tight min-w-0"
            style={{ fontVariationSettings: '"opsz" 96, "SOFT" 50' }}
          >
            <span
              className="shrink-0 text-xl leading-none translate-y-[-2px]"
              style={{ color: hue }}
              aria-hidden
            >
              ▸
            </span>
            <span className="truncate">{client.name}</span>
          </h2>
        </div>
        <TokenBadge state={tokenState(client, currentToken)} />
      </header>

      <dl className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/70 border-y border-border/70">
        <Field label="tenant" value={client.tenant} />
        <Field label="subscription" value={client.subscription || "not set"} />
        <Field label="email" value={client.email} />
        <Field
          label="cache"
          value={client.logged_in ? "present" : "missing"}
        />
      </dl>

      <section className="space-y-2">
        <span className="eyebrow">actions</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <Button
            onClick={() => onStatus(client)}
            disabled={busy}
            className="cursor-pointer font-mono rounded-sm"
          >
            <Activity className="size-3.5" />
            status
          </Button>
          <Button
            variant="outline"
            onClick={() => onCheck(client)}
            disabled={busy}
            className="cursor-pointer font-mono rounded-sm"
          >
            <ShieldCheck className="size-3.5" />
            check
          </Button>
          <Button
            variant="outline"
            onClick={() => onLogin(client)}
            disabled={busy}
            className="cursor-pointer font-mono rounded-sm"
          >
            <LogIn className="size-3.5" />
            login
          </Button>
          <Button
            variant="outline"
            onClick={() => onSwitch(client)}
            disabled={busy}
            className="cursor-pointer font-mono rounded-sm"
          >
            <Repeat className="size-3.5" />
            switch
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <span className="eyebrow">subscription</span>
        <div className="flex gap-2 items-stretch">
          <Input
            value={subscriptionDraft}
            onChange={(event) => onSubscriptionDraftChange(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="font-mono text-sm rounded-sm"
            aria-label="Subscription ID"
          />
          <Button
            onClick={() => onSetSubscription(client)}
            disabled={busy || !subscriptionDraft.trim()}
            className="cursor-pointer font-mono rounded-sm shrink-0"
          >
            <Save className="size-3.5" />
            save
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <span className="eyebrow">command log</span>
        <div className="flex gap-2 items-stretch">
          <Input
            type="number"
            min={1}
            max={500}
            value={logLines}
            onChange={(event) => onSetLogLines(Number(event.target.value))}
            className="font-mono text-sm rounded-sm w-24 shrink-0"
            aria-label="Number of log lines"
          />
          <Button
            variant="outline"
            onClick={() => onLog(client)}
            disabled={busy}
            className="cursor-pointer font-mono rounded-sm"
          >
            <FileText className="size-3.5" />
            show log
          </Button>
          <Button
            variant="destructive"
            onClick={() => onRemove(client)}
            disabled={busy}
            className="cursor-pointer font-mono rounded-sm ml-auto"
          >
            <Trash2 className="size-3.5" />
            remove client
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd
        className="mt-1 font-mono text-sm text-foreground truncate"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
