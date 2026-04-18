"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ShoppingCart,
  Package,
  PieChart,
  Activity,
  Building2,
  FileText,
} from "lucide-react";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4" dir="rtl">
      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
