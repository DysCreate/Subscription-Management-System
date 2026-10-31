"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Plus,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { RoleGate } from "@/components/role-gate";
import { ForbiddenPage } from "@/components/forbidden-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordValidationBox } from "@/components/password-rules";
import { useAuth } from "@/hooks/use-auth";
import type { Role } from "@/types";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const INITIAL_STAFF: StaffMember[] = [
  {
    id: "usr_admin_01",
    name: "Aarav Menon",
    email: "aarav@brightloop.software",
    role: "admin",
    isActive: true,
    createdAt: "2025-08-01",
  },
  {
    id: "usr_staff_02",
    name: "Neha Sharma",
    email: "neha.sharma@brightloop.software",
    role: "staff",
    isActive: true,
    createdAt: "2025-09-15",
  },
  {
    id: "usr_staff_03",
    name: "Rohan Verma",
    email: "rohan.v@brightloop.software",
    role: "staff",
    isActive: true,
    createdAt: "2025-10-02",
  },
  {
    id: "usr_staff_04",
    name: "Priya Nair",
    email: "priya.nair@brightloop.software",
    role: "staff",
    isActive: false,
    createdAt: "2025-10-20",
  },
];

const addStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "staff"]),
  temporaryPassword: z
    .string()
    .refine((val) => val.length > 8, {
      message: "Password must be more than 8 characters",
    })
    .refine((val) => /[A-Z]/.test(val), {
      message: "Password must contain an uppercase letter",
    })
    .refine((val) => /[a-z]/.test(val), {
      message: "Password must contain a lowercase letter",
    })
    .refine((val) => /[^A-Za-z0-9]/.test(val), {
      message: "Password must contain a special character",
    }),
});

type AddStaffFormData = z.infer<typeof addStaffSchema>;

export default function StaffPage() {
  const { user } = useAuth();
  const [staffList, setStaffList] = React.useState<StaffMember[]>(INITIAL_STAFF);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<AddStaffFormData>({
    resolver: zodResolver(addStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "staff",
      temporaryPassword: "",
    },
    mode: "onChange",
  });

  const passwordValue = form.watch("temporaryPassword") || "";

  const onSubmit = async (data: AddStaffFormData) => {
    try {
      setIsSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      const newMember: StaffMember = {
        id: `usr_${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role as Role,
        isActive: true,
        createdAt: new Date().toISOString().split("T")[0] as string,
      };

      setStaffList((prev) => [newMember, ...prev]);
      toast.success(`Staff member "${data.name}" added successfully`);
      setSheetOpen(false);
      form.reset();
    } catch {
      toast.error("Failed to add staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (member: StaffMember) => {
    // Prevent self-deactivation
    if (member.email === user?.email) {
      toast.error("You cannot deactivate your own active session");
      return;
    }

    setStaffList((prev) =>
      prev.map((item) => {
        if (item.id === member.id) {
          const newStatus = !item.isActive;
          toast.success(
            `Staff member ${item.name} has been ${
              newStatus ? "reactivated" : "deactivated"
            }`,
          );
          return { ...item, isActive: newStatus };
        }
        return item;
      }),
    );
  };

  return (
    <RoleGate allow={["admin"]} fallback={<ForbiddenPage />}>
      <div className="space-y-6">
        <PageHeader
          title="Staff Members"
          description="Manage workspace members, assign administrative privileges, and control account status."
          actions={
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  <Plus className="h-4 w-4" />
                  Add staff member
                </Button>
              </SheetTrigger>

              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader className="text-left space-y-1 pb-4 border-b">
                  <SheetTitle className="text-lg font-bold">
                    Add staff member
                  </SheetTitle>
                  <SheetDescription>
                    Invite a team member with role permissions and a temporary password.
                  </SheetDescription>
                </SheetHeader>

                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 py-4"
                >
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="staff-name"
                        placeholder="Aditi Roy"
                        className="pl-9"
                        disabled={isSubmitting}
                        {...form.register("name")}
                      />
                    </div>
                    {form.formState.errors.name && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="staff-email"
                        type="email"
                        placeholder="aditi@brightloop.software"
                        className="pl-9"
                        disabled={isSubmitting}
                        {...form.register("email")}
                      />
                    </div>
                    {form.formState.errors.email && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Role */}
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-role">Role</Label>
                    <Select
                      defaultValue="staff"
                      onValueChange={(val: "admin" | "staff") =>
                        form.setValue("role", val)
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="staff-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff (Standard)</SelectItem>
                        <SelectItem value="admin">Admin (Full Access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Temporary Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-password">Temporary Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="staff-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Assign temporary password"
                        className="pl-9 pr-10"
                        disabled={isSubmitting}
                        {...form.register("temporaryPassword")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground focus:outline-none"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {form.formState.errors.temporaryPassword && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.temporaryPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Live 4 rules checklist */}
                  <PasswordValidationBox password={passwordValue} />

                  <SheetFooter className="pt-4 border-t">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating staff member...
                        </>
                      ) : (
                        "Save Staff Member"
                      )}
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          }
        />

        {/* Staff Table Card */}
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((member) => {
                const initials = member.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const isCurrent = member.email === user?.email;

                return (
                  <TableRow key={member.id} className="hover:bg-muted/40">
                    {/* Name + Email + Avatar */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600/90 to-violet-600/90 text-xs font-bold text-white shadow-sm">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground text-sm">
                              {member.name}
                            </span>
                            {isCurrent && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 text-indigo-600 dark:text-indigo-400 border-indigo-200">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role Badge */}
                    <TableCell>
                      <Badge
                        variant={member.role === "admin" ? "default" : "secondary"}
                        className="text-[11px] font-semibold uppercase tracking-wider capitalize"
                      >
                        {member.role}
                      </Badge>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>
                      {member.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {member.createdAt}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <Button
                        variant={member.isActive ? "outline" : "default"}
                        size="sm"
                        disabled={isCurrent}
                        onClick={() => handleToggleStatus(member)}
                        className="h-8 text-xs font-medium"
                      >
                        {member.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </RoleGate>
  );
}
