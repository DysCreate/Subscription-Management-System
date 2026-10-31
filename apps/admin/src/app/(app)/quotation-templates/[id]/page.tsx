"use client";

import * as React from "react";
import { QuotationTemplateForm } from "@/features/quotation-templates/quotation-template-form";

export default function QuotationTemplateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <QuotationTemplateForm templateId={params.id} />;
}
