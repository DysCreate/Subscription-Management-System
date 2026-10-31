"use client";

import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordRuleResult {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasSpecial: boolean;
  score: number;
  isAllValid: boolean;
  strengthLabel: "Weak" | "Fair" | "Good" | "Strong";
  strengthColor: string;
}

export function evaluatePassword(password: string): PasswordRuleResult {
  const hasMinLength = password.length > 8; // MORE than 8 characters (>= 9)
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const score = [hasMinLength, hasUppercase, hasLowercase, hasSpecial].filter(
    Boolean,
  ).length;

  let strengthLabel: "Weak" | "Fair" | "Good" | "Strong" = "Weak";
  let strengthColor = "bg-rose-500";

  if (score <= 1) {
    strengthLabel = "Weak";
    strengthColor = "bg-rose-500";
  } else if (score === 2) {
    strengthLabel = "Fair";
    strengthColor = "bg-amber-500";
  } else if (score === 3) {
    strengthLabel = "Good";
    strengthColor = "bg-blue-500";
  } else if (score === 4) {
    strengthLabel = "Strong";
    strengthColor = "bg-emerald-500";
  }

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasSpecial,
    score,
    isAllValid: score === 4,
    strengthLabel,
    strengthColor,
  };
}

export interface PasswordValidationBoxProps {
  password?: string;
  className?: string;
}

export function PasswordValidationBox({
  password = "",
  className,
}: PasswordValidationBoxProps) {
  const result = evaluatePassword(password);

  const rules = [
    {
      id: "length",
      label: "More than 8 characters (9+)",
      valid: result.hasMinLength,
    },
    {
      id: "uppercase",
      label: "At least one uppercase letter (A-Z)",
      valid: result.hasUppercase,
    },
    {
      id: "lowercase",
      label: "At least one lowercase letter (a-z)",
      valid: result.hasLowercase,
    },
    {
      id: "special",
      label: "At least one special character (!@#$%...)",
      valid: result.hasSpecial,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-2.5",
        className,
      )}
    >
      {/* Strength indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="font-medium">Password strength</span>
          <span
            className={cn(
              "font-semibold transition-colors",
              password.length === 0
                ? "text-muted-foreground"
                : result.score <= 1
                  ? "text-rose-500"
                  : result.score === 2
                    ? "text-amber-500"
                    : result.score === 3
                      ? "text-blue-500"
                      : "text-emerald-500",
            )}
          >
            {password.length === 0 ? "Empty" : result.strengthLabel}
          </span>
        </div>

        {/* 4-bar segments */}
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((step) => {
            const isFilled = password.length > 0 && result.score >= step;
            return (
              <div
                key={step}
                className={cn(
                  "h-full rounded-full transition-all duration-200",
                  isFilled ? result.strengthColor : "bg-muted",
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Live 4 rules checklist */}
      <ul className="space-y-1.5 pt-1">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2 transition-colors duration-150",
              rule.valid
                ? "text-emerald-600 dark:text-emerald-400 font-medium"
                : "text-muted-foreground",
            )}
          >
            {rule.valid ? (
              <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </div>
            ) : (
              <Circle className="h-3 w-3 stroke-[2] opacity-40" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
