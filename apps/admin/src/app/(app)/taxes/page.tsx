import { TaxesView } from "@/features/taxes/taxes-view";

export const metadata = {
  title: "Taxes | SubLoop",
  description: "Manage GST rates, inclusive/exclusive taxes and fixed fee surcharges.",
};

export default function TaxesPage() {
  return <TaxesView />;
}
