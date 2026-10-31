import { QuotationTemplateForm } from "@/features/quotation-templates/quotation-template-form";

export const metadata = {
  title: "New Quotation Template | SubLoop",
  description: "Create a new reusable subscription quotation package.",
};

export default function NewQuotationTemplatePage() {
  return <QuotationTemplateForm />;
}
