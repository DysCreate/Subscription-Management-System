"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createCustomer } from "@/lib/api/customers";
import type { Customer } from "@/types";
import { cn } from "@/lib/utils";

const customerSchema = z.object({
  name: z.string().min(2, "Customer name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  gstNumber: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export interface CustomerComboboxProps {
  customers: Customer[];
  value?: string;
  onChange: (customerId: string) => void;
  onCustomerCreated?: (customer: Customer) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Accessible customer picker with inline search and a quick-create dialog.
 * Keeps the same "combobox" semantics as shadcn's command pattern.
 */
export function CustomerCombobox({
  customers,
  value,
  onChange,
  onCustomerCreated,
  disabled = false,
  error,
}: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const selected = customers.find((customer) => customer.id === value);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      companyName: "",
      phone: "",
      gstNumber: "",
    },
  });

  const handleDialogOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (!nextOpen) form.reset();
  };

  const handleCreate = async (data: CustomerFormData) => {
    try {
      setIsCreating(true);
      const customer = await createCustomer({
        name: data.name.trim(),
        email: data.email.trim(),
        companyName: data.companyName?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        gstNumber: data.gstNumber?.trim() || undefined,
      });
      toast.success(`${customer.name} added to customers`);
      onCustomerCreated?.(customer);
      onChange(customer.id);
      form.reset();
      setDialogOpen(false);
    } catch {
      toast.error("Could not create customer");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            className={cn(
              "h-auto min-h-10 w-full justify-between px-3 py-2 font-normal",
              !selected && "text-muted-foreground",
              error && "border-destructive",
            )}
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2 text-left">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-indigo-50 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {getInitials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {selected.name}
                  </span>
                  {selected.companyName && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {selected.companyName}
                    </span>
                  )}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Select a customer
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder="Search customers by name or company..." />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup heading="Customers">
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`${customer.name} ${customer.companyName ?? ""} ${customer.email}`}
                    onSelect={() => {
                      onChange(customer.id);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-muted text-[9px] font-semibold">
                        {getInitials(customer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {customer.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {customer.companyName || customer.email}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "h-4 w-4 text-indigo-600",
                        value === customer.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="create-new-customer"
                  onSelect={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                  className="gap-2 font-medium text-indigo-700 dark:text-indigo-300"
                >
                  <Plus className="h-4 w-4" />
                  Create new customer
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create customer</DialogTitle>
            <DialogDescription>
              Add a billing account without leaving the subscription builder.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(handleCreate)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="quick-customer-name">Full name *</Label>
              <Input
                id="quick-customer-name"
                placeholder="e.g. Ananya Nair"
                autoFocus
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-customer-email">Email *</Label>
              <Input
                id="quick-customer-email"
                type="email"
                placeholder="billing@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-customer-company">Company</Label>
                <Input
                  id="quick-customer-company"
                  placeholder="Company name"
                  {...form.register("companyName")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-customer-phone">Phone</Label>
                <Input
                  id="quick-customer-phone"
                  placeholder="+91 ..."
                  {...form.register("phone")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-customer-gst">GST number</Label>
              <Input
                id="quick-customer-gst"
                placeholder="e.g. 32AACCK4821P1ZQ"
                {...form.register("gstNumber")}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create customer
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
