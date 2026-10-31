"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDef {
  /** Unique key matching the query-param / API filter key. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Available options for the dropdown. */
  options: FilterOption[];
}

export interface FilterBarProps {
  /** Current search query. */
  searchValue: string;
  /** Called when the search text changes. */
  onSearchChange: (value: string) => void;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Filter definitions rendered as select dropdowns. */
  filters?: FilterDef[];
  /** Current filter values keyed by FilterDef.key. */
  filterValues?: Record<string, string>;
  /** Called when a filter value changes. */
  onFilterChange?: (key: string, value: string) => void;
  /** Called to reset all filters and search. */
  onReset?: () => void;
  className?: string;
}

/**
 * Horizontal bar with a search input and optional select-based filters.
 * Used at the top of every list page for search + filter + reset.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  filterValues = {},
  onFilterChange,
  onReset,
  className,
}: FilterBarProps) {
  const hasActiveFilters =
    searchValue.length > 0 ||
    Object.values(filterValues).some((v) => v && v !== "all");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center",
        className,
      )}
    >
      {/* Search input */}
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* Filter selects */}
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={filterValues[filter.key] ?? "all"}
          onValueChange={(val) => onFilterChange?.(filter.key, val)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {filter.label}</SelectItem>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Reset button */}
      {hasActiveFilters && onReset && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="gap-1 text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}
