import { Loader2 } from "lucide-react";

export function Loading() {
  return (
    <div className="flex justify-center items-center py-12">
      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
    </div>
  );
}
