"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, PackageX } from "lucide-react";
import { ProductForm } from "@/features/products/product-form";
import { getProductById } from "@/lib/api/products";
import { Button } from "@/components/ui/button";

export default function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", params.id],
    queryFn: () => getProductById(params.id),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-xs text-muted-foreground animate-pulse">
          Loading product details...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <PackageX className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Product Not Found</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            The product you requested does not exist or may have been removed.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
        </Button>
      </div>
    );
  }

  return <ProductForm initialProduct={product} />;
}
