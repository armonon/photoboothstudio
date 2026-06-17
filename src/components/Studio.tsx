"use client";

import { useEffect } from "react";
import { useStudio } from "@/lib/store";
import StudioCanvas from "./StudioCanvas";
import ControlRail from "./ControlRail";
import ExportDialog from "./ExportDialog";
import type { GarmentDesign, MannequinPlate } from "@/lib/types";

export default function Studio({
  product,
  plates,
}: {
  product: GarmentDesign;
  plates: MannequinPlate[];
}) {
  const setProduct = useStudio((s) => s.setProduct);
  const setFit = useStudio((s) => s.setFit);
  useEffect(() => {
    setProduct(product.id);
    setFit(product.fitStyle);
  }, [product.fitStyle, product.id, setFit, setProduct]);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div>
          <span className="font-semibold">Model Studio</span>
          <span className="ml-2 text-neutral-400">{product.name}</span>
        </div>
        <ExportDialog product={product} plates={plates} />
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex flex-1 items-center justify-center bg-neutral-900 p-6">
          <StudioCanvas product={product} plates={plates} />
        </section>
        <ControlRail />
      </div>
    </main>
  );
}
