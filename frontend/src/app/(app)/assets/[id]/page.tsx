import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { AssetView } from "./AssetView";

export default function AssetPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AssetView />
    </Suspense>
  );
}
