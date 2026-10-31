import {
  LayoutDashboard,
  Repeat,
  FileText,
  Users,
  Receipt,
  CreditCard,
  Package,
  Layers,
  Percent,
  Tag,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  group: string;
  adminOnly?: boolean;
  items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    group: "Sales",
    items: [
      {
        title: "Subscriptions",
        href: "/subscriptions",
        icon: Repeat,
      },
      {
        title: "Quotation Templates",
        href: "/quotation-templates",
        icon: FileText,
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
      },
    ],
  },
  {
    group: "Billing",
    items: [
      {
        title: "Invoices",
        href: "/invoices",
        icon: Receipt,
      },
      {
        title: "Payments",
        href: "/payments",
        icon: CreditCard,
      },
    ],
  },
  {
    group: "Catalog",
    items: [
      {
        title: "Products",
        href: "/products",
        icon: Package,
      },
      {
        title: "Plans",
        href: "/plans",
        icon: Layers,
      },
      {
        title: "Taxes",
        href: "/taxes",
        icon: Percent,
      },
      {
        title: "Discounts",
        href: "/discounts",
        icon: Tag,
      },
    ],
  },
  {
    group: "Admin",
    adminOnly: true,
    items: [
      {
        title: "Staff Members",
        href: "/staff",
        icon: ShieldCheck,
        adminOnly: true,
      },
    ],
  },
];

export function getBreadcrumbFromPath(pathname: string): {
  group: string;
  item: string;
} {
  for (const grp of NAVIGATION_GROUPS) {
    for (const itm of grp.items) {
      if (
        pathname === itm.href ||
        (itm.href !== "/dashboard" && pathname.startsWith(itm.href))
      ) {
        return {
          group: grp.group,
          item: itm.title,
        };
      }
    }
  }

  // Fallback
  return {
    group: "SubLoop",
    item: pathname.replace("/", "").replace(/-/g, " ") || "Dashboard",
  };
}
