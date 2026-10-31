import { QuotationTemplatesList } from "@/features/quotation-templates/quotation-templates-list";

export const metadata = {
  title: "Quotation Templates | SubLoop",
  description: "Standardized quotation packages with pre-bundled products, plans and terms.",
};

export default function QuotationTemplatesPage() {
  return <QuotationTemplatesList />;
}
