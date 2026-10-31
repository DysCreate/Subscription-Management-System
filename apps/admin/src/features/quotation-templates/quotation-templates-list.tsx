"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Copy,
  Edit,
  FileText,
  Layers,
  Lock,
  MoreHorizontal,
  Plus,
  Play,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import {
  deleteQuotationTemplate,
  duplicateQuotationTemplate,
  getQuotationTemplates,
} from "@/lib/api/quotation-templates";
import type { QuotationTemplate } from "@/types";

export function QuotationTemplatesList() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [deletingTemplateId, setDeletingTemplateId] = React.useState<string | null>(null);

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ["quotation-templates"],
    queryFn: getQuotationTemplates,
  });

  const filteredTemplates = React.useMemo(() => {
    return templates.filter((template) => {
      const query = search.toLowerCase();
      const matchesName = template.name.toLowerCase().includes(query);
      const matchesPlan = (template.planName ?? "").toLowerCase().includes(query);
      return matchesName || matchesPlan;
    });
  }, [templates, search]);

  const handleDuplicate = async (id: string, name: string) => {
    if (!isAdmin) {
      toast.error("Admin write access required to duplicate templates.");
      return;
    }
    try {
      await duplicateQuotationTemplate(id);
      toast.success(`Template "${name}" duplicated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["quotation-templates"] });
    } catch {
      toast.error("Failed to duplicate template.");
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplateId) return;
    try {
      await deleteQuotationTemplate(deletingTemplateId);
      toast.success("Quotation template deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["quotation-templates"] });
    } catch {
      toast.error("Failed to delete template.");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleUseTemplate = (id: string) => {
    router.push(`/subscriptions/new?template=${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Templates"
        description="Preconfigure reusable packages with predefined plans, products, quantities and validity periods."
        actions={
          isAdmin ? (
            <Button
              onClick={() => router.push("/quotation-templates/new")}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1.5 py-1 px-2.5">
                <Lock className="h-3 w-3" />
                Staff Mode: Usage Enabled
              </Badge>
            </div>
          )
        }
      />

      {/* Staff banner */}
      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/20 px-4 py-3 text-xs text-indigo-800 dark:text-indigo-300">
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <p>
            You are logged in as <strong>Staff</strong>. You can view all quotation templates and click <strong>&quot;Use template&quot;</strong> to generate client subscriptions instantly.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates by name or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs bg-background"
          />
        </div>
      </div>

      {/* Templates Table */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
            Loading quotation templates…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-destructive">
            Failed to load quotation templates. Please refresh.
          </div>
        ) : filteredTemplates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotation templates found"
            description={
              search
                ? `No template matches "${search}".`
                : "Create your first quotation template to speed up subscription sales."
            }
            actionLabel={isAdmin ? "New Template" : undefined}
            onAction={isAdmin ? () => router.push("/quotation-templates/new") : undefined}
          />
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Plan</TableHead>
                <TableHead className="text-xs font-semibold">Lines count</TableHead>
                <TableHead className="text-xs font-semibold">Validity days</TableHead>
                <TableHead className="text-xs font-semibold">Last updated</TableHead>
                <TableHead className="text-xs font-semibold text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => {
                const lineCount = template.lines?.length ?? template.productIds?.length ?? 0;
                const validityDays = template.validityDays ?? 30;
                const lastUpdated = template.updatedAt ?? template.createdAt;

                return (
                  <TableRow key={template.id} className="hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <TableCell className="py-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {template.name}
                          </span>
                          {template.description && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[280px]">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Plan */}
                    <TableCell className="py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {template.planName || template.planId || "Standard Plan"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Lines count */}
                    <TableCell className="py-3 text-xs">
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-normal"
                      >
                        {lineCount} {lineCount === 1 ? "line" : "lines"}
                      </Badge>
                    </TableCell>

                    {/* Validity days */}
                    <TableCell className="py-3 text-xs text-foreground">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {validityDays} days
                      </span>
                    </TableCell>

                    {/* Last updated */}
                    <TableCell className="py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(lastUpdated)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Primary Use Template Action */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUseTemplate(template.id)}
                          className="h-7 text-xs gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          <Play className="h-3 w-3 fill-indigo-600 dark:fill-indigo-400" />
                          Use template
                        </Button>

                        {/* More Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">More options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={() => router.push(`/quotation-templates/${template.id}`)}
                              className="text-xs gap-2 cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                              {isAdmin ? "Edit Template" : "View Template"}
                            </DropdownMenuItem>

                            {isAdmin && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleDuplicate(template.id, template.name)}
                                  className="text-xs gap-2 cursor-pointer"
                                >
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingTemplateId(template.id)}
                                  className="text-xs gap-2 text-destructive cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingTemplateId}
        onOpenChange={(open) => !open && setDeletingTemplateId(null)}
        title="Delete Quotation Template"
        description="Are you sure you want to delete this quotation template? Existing subscriptions and historical quotations created from it will remain intact."
        confirmLabel="Delete Template"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
