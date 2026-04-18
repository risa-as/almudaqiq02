'use client';

import { BranchProvider } from "@/contexts/BranchContext";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <BranchProvider>{children}</BranchProvider>;
}
