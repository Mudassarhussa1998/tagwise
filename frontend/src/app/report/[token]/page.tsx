import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { ReportView } from "./ReportView";

export const metadata = { title: "Asset report" };

export default function ReportPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReportView />
    </Suspense>
  );
}
