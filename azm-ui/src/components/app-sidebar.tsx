import { Plus, RefreshCw, ShieldCheck, Settings2, Keyboard } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { MetricTile } from "@/components/metric-tile";
import { TokenBadge } from "@/components/token-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { initials, tokenState } from "@/lib/azm-format";
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
    <Sidebar collapsible="offcanvas" className="border-r">
      <SidebarHeader className="gap-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-foreground text-background grid place-items-center font-mono font-semibold text-sm tracking-tight">
            az
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-sm font-semibold truncate">
              Azure Multi-Client
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              Read-only console
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile label="Clients" value={counts.clients} />
          <MetricTile label="Cached" value={counts.cached} />
          <MetricTile label="Valid" value={counts.valid} tone="success" />
          <MetricTile label="Expired" value={counts.expired} tone="danger" />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading || busy}
            className="cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Refresh</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCheckTokens}
            disabled={busy}
            className="cursor-pointer"
          >
            <ShieldCheck className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Check</span>
          </Button>
          <Button
            size="sm"
            onClick={onAdd}
            disabled={busy}
            className="cursor-pointer"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
            Clients
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {loading && clients.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Loading clients…
              </div>
            ) : null}
            {!loading && clients.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                No clients registered. Click <span className="font-medium">Add</span> to
                register your first tenant.
              </div>
            ) : null}
            <SidebarMenu>
              {clients.map((client) => {
                const state = tokenState(client, tokenStatus[client.name]);
                const isActive = client.name === selectedName;
                return (
                  <SidebarMenuItem key={client.name}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSelect(client.name)}
                      className={cn(
                        "h-auto py-2 cursor-pointer group",
                        "data-[active=true]:bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "size-7 rounded-md grid place-items-center text-[10px] font-mono font-semibold shrink-0 border",
                          "bg-transparent text-muted-foreground border-border",
                          isActive && "bg-foreground text-background border-foreground"
                        )}
                      >
                        {initials(client.name)}
                      </span>
                      <span className="flex flex-col min-w-0 items-start leading-tight flex-1">
                        <span className="text-sm font-medium truncate w-full">
                          {client.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate w-full">
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

      <SidebarFooter className="border-t">
        <div className="flex items-center justify-between gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenPalette}
            aria-label="Open command palette"
            className="cursor-pointer gap-1.5"
          >
            <Keyboard className="size-3.5" />
            <span className="text-xs">Palette</span>
            <kbd className="ml-1 pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>

          <div className="flex items-center">
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
