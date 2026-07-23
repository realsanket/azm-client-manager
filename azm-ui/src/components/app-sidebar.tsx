import { Plus, RefreshCw, ShieldCheck, Settings2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { MetricTile } from "@/components/metric-tile";
import { TokenBadge } from "@/components/token-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { tokenState } from "@/lib/azm-format";
import { hueForClient } from "@/lib/client-hue";
import { cn } from "@/lib/utils";
import type { AzmClient } from "@/hooks/useAzm";

interface Counts {
  clients: number;
  cached: number;
  valid: number;
  expired: number;
}

export function AppSidebar({
  busy,
  clients,
  counts,
  loading,
  selectedName,
  tokenStatus,
  onAdd,
  onOpenPresets,
  onOpenPalette,
  onRefresh,
  onCheckTokens,
  onSelect,
}: {
  busy: boolean;
  clients: AzmClient[];
  counts: Counts;
  loading: boolean;
  selectedName: string | null;
  tokenStatus: Record<string, boolean>;
  onAdd: () => void;
  onOpenPresets: () => void;
  onOpenPalette: () => void;
  onRefresh: () => void;
  onCheckTokens: () => void;
  onSelect: (name: string) => void;
}) {
  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/70">
      <SidebarHeader className="gap-3 pb-3 pt-3 px-3">
        <div className="flex items-baseline justify-between">
          <span
            className="font-serif text-lg leading-none text-foreground tracking-tight"
            style={{
              fontVariationSettings: '"opsz" 96, "SOFT" 40',
              fontWeight: 500,
            }}
          >
            az
            <span className="text-muted-foreground/50 font-thin mx-[0.05em] font-sans">
              │
            </span>
            m
          </span>
          <span className="eyebrow text-[9.5px]">console</span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 -mx-0.5">
          <MetricTile label="clients" value={counts.clients} />
          <MetricTile label="cached" value={counts.cached} />
          <MetricTile label="valid" value={counts.valid} tone="success" />
          <MetricTile label="expired" value={counts.expired} tone="danger" />
        </div>

        <div className="grid grid-cols-3 gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading || busy}
            className="cursor-pointer font-mono text-[11px] gap-1 h-7 px-2 rounded-sm border-border/70"
            title="Refresh clients"
          >
            <RefreshCw className="size-3" />
            <span className="lowercase">refresh</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCheckTokens}
            disabled={busy}
            className="cursor-pointer font-mono text-[11px] gap-1 h-7 px-2 rounded-sm border-border/70"
            title="Check tokens"
          >
            <ShieldCheck className="size-3" />
            <span className="lowercase">check</span>
          </Button>
          <Button
            size="sm"
            onClick={onAdd}
            disabled={busy}
            className="cursor-pointer font-mono text-[11px] gap-1 h-7 px-2 rounded-sm"
          >
            <Plus className="size-3" />
            add
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="eyebrow px-3">
            clients
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {loading && clients.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground font-mono">
                loading…
              </div>
            ) : null}
            {!loading && clients.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No clients yet. Add one to begin.
              </div>
            ) : null}
            <SidebarMenu className="gap-0.5">
              {clients.map((client) => {
                const state = tokenState(client, tokenStatus[client.name]);
                const isActive = client.name === selectedName;
                const hue = hueForClient(client.name);
                return (
                  <SidebarMenuItem key={client.name}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelect(client.name)}
                      className={cn(
                        "relative h-auto py-2 pl-3 pr-2 rounded-none cursor-pointer group",
                        "data-[active=true]:bg-accent/70"
                      )}
                      style={
                        isActive
                          ? ({
                              boxShadow: `inset 2px 0 0 0 ${hue}`,
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      <span
                        className="size-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: hue }}
                        aria-hidden
                      />
                      <span className="flex flex-col min-w-0 items-start leading-tight flex-1">
                        <span
                          className={cn(
                            "font-serif text-[15px] truncate w-full",
                            "font-medium tracking-tight"
                          )}
                          style={{
                            fontVariationSettings: '"opsz" 36, "SOFT" 30',
                          }}
                        >
                          {client.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate w-full font-mono">
                          {client.tenant}
                        </span>
                      </span>
                      <TokenBadge state={state} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/70 gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-left cursor-pointer hover:bg-accent transition-colors duration-150"
          aria-label="Open command palette"
        >
          <span className="font-mono text-xs text-muted-foreground">
            <span className="text-foreground/70">⌘</span>K palette
          </span>
          <span className="text-muted-foreground/40 text-xs">↵</span>
        </button>

        <div className="flex items-center justify-between px-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenPresets}
            aria-label="Team preset settings"
            className="cursor-pointer"
          >
            <Settings2 className="size-4" />
          </Button>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
