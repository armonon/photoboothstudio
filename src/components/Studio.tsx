"use client";

import { useEffect } from "react";
import { useStudio } from "@/lib/store";
import { mockProducts } from "@/lib/mock-data";
import StudioCanvas from "./StudioCanvas";
import ControlRail from "./ControlRail";
import ExportDialog from "./ExportDialog";

export default function Studio({ productId }: { productId: string }) {
  const setProduct = useStudio((s) => s.setProduct);
  useEffect(() => {
    setProduct(productId);
  }, [productId, setProduct]);

  const product = mockProducts.find((p) => p.id === productId);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div>
          <span className="font-semibold">Model Studio</span>
          <span className="ml-2 text-neutral-400">{product?.name ?? productId}</span>
        </div>
        <ExportDialog />
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex flex-1 items-center justify-center bg-neutral-900 p-6">
          <StudioCanvas />
        </section>
        <ControlRail />
      </div>
    </main>
  );
}
