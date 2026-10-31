"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 400));
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toast.success("Password reset request submitted");
    } catch {
      toast.error("Failed to process request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-xl backdrop-blur-sm">
      <CardHeader className="space-y-1 text-center sm:text-left">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Reset your password
        </CardTitle>
        <CardDescription>
          {isSubmitted
            ? "Verification link dispatched"
            : "Enter your registered work email to receive a password recovery link"}
        </CardDescription>
      </CardHeader>

      {isSubmitted ? (
        <CardContent className="space-y-6 pt-2">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 ring-8 ring-emerald-50/50 dark:ring-emerald-950/20">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold">Check your inbox</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                If this email is registered, a reset link has been sent to{" "}
                <span className="font-medium text-foreground">{submittedEmail}</span>.
              </p>
            </div>
          </div>

          {/* Quick simulation helper for tester */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-950 dark:bg-indigo-950/30 text-xs space-y-2">
            <p className="font-semibold text-indigo-900 dark:text-indigo-200">
              Demo Simulation:
            </p>
            <p className="text-muted-foreground">
              In development, click below to simulate opening the reset link sent to this email:
            </p>
            <Button asChild variant="outline" size="sm" className="w-full gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:text-indigo-300">
              <Link href="/reset-password?token=mock_subloop_token_demo_984">
                <ExternalLink className="h-3.5 w-3.5" />
                Open /reset-password with token
              </Link>
            </Button>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsSubmitted(false);
                form.reset();
              }}
              className="w-full text-xs text-muted-foreground"
            >
              Didn&apos;t receive email? Try another address
            </Button>
          </div>
        </CardContent>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="pl-9"
                  disabled={isLoading}
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </CardContent>
        </form>
      )}

      <CardFooter className="flex justify-center border-t border-border/40 pt-4 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
