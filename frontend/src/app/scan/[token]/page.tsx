import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ScanView } from "./ScanView";

export const metadata = { title: "Asset check" };

export default function ScanPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ScanView />
    </Suspense>
  );
}
