import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { AssetsView } from "./AssetsView";

export const metadata = { title: "Assets" };

export default function AssetsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AssetsView />
    </Suspense>
  );
}
