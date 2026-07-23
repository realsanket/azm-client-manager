import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CommandResult } from "@/hooks/useAzm";

export function AddClientDialog({
  busy,
  open,
  onAdd,
  onOpenChange,
}: {
  busy: boolean;
  open: boolean;
  onAdd: (
    name: string,
    tenant: string,
    email: string,
    subscription?: string
  ) => Promise<CommandResult>;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [subscription, setSubscription] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setTenant("");
    setEmail("");
    setSubscription("");
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const result = await onAdd(name, tenant, email, subscription || undefined);
    if (result.exitCode === 0) {
      reset();
      onOpenChange(false);
    } else {
      setError((result.stderr || result.stdout || "Failed to add client").trim());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            azm add
          </span>
          <DialogTitle>Add client</DialogTitle>
          <DialogDescription>
            Register a new tenant. Subscription is optional — it will be
            auto-detected on first login.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <Field
            id="add-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="client-name"
            autoFocus
            required
          />
          <Field
            id="add-tenant"
            label="Tenant"
            value={tenant}
            onChange={setTenant}
            placeholder="tenant.onmicrosoft.com"
            required
          />
          <Field
            id="add-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="user@company.com"
            required
          />
          <Field
            id="add-subscription"
            label="Subscription (optional)"
            value={subscription}
            onChange={setSubscription}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono px-3 py-2">
              {error}
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !name || !tenant || !email}
              className="cursor-pointer"
            >
              Add client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type,
  required,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
