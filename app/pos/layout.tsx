'use client';

import { BranchProvider } from "@/contexts/BranchContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import SyncStatusBar from "@/components/SyncStatusBar";

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <BranchProvider>
        {/* Renders nothing outside the Electron desktop app */}
        <SyncStatusBar />
        {children}
      </BranchProvider>
    </ThemeProvider>
  );
}
