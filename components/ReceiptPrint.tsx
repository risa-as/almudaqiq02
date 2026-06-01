import React from "react";
import { formatCurrency } from "@/lib/format";

export interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  footerMessage: string;
}

export interface ReceiptData {
  transactionId: number | string;
  receiptNumber?: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    unitName: string;
  }[];
  totalAmount: number;
  discountAmount?: number;
  paymentMethod?: "CASH" | "CARD" | "CREDIT" | "SPLIT";
  isCredit?: boolean;
  customerName?: string;
  cashierName?: string;
}

interface ReceiptPrintProps {
  receipt: ReceiptData;
  isPreview?: boolean;
  storeSettings?: StoreSettings | null;
}

const PAY_LABELS: Record<string, string> = {
  CASH: "نقدي",
  CARD: "بطاقة",
  CREDIT: "آجل",
  SPLIT: "مختلط",
};

// Minimal inline SVG icons — crisp at small sizes, print-safe
const Ico = {
  store: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  phone: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.58 3.44 2 2 0 0 1 3.55 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.79a16 16 0 0 0 6.29 6.29l1.63-1.63a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  pin: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  tag: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  user: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  card: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  hash: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
  cal: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

const dash: React.CSSProperties = { borderTop: "1px dashed #ccc", margin: "0" };
const thinLine: React.CSSProperties = { borderTop: "1px solid #bbb", margin: "0" };

function Row({ label, value, bold }: { label: React.ReactNode; value: React.ReactNode; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2.5px 0" }}>
      <span style={{ color: "#555", fontSize: 10 }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 700, fontSize: 10.5, color: "#000" }}>{value}</span>
    </div>
  );
}

function ReceiptBody({ receipt, settings }: { receipt: ReceiptData; settings: StoreSettings }) {
  const subTotal = receipt.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = receipt.discountAmount ?? 0;
  const d = new Date(receipt.date);
  const dateStr = d.toLocaleDateString("ar-IQ");
  const timeStr = d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
  const payLabel = receipt.paymentMethod
    ? PAY_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod
    : receipt.isCredit ? "آجل" : null;

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", color: "#000", background: "#fff", width: "100%", direction: "rtl" }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ textAlign: "center", padding: "14px 14px 10px" }}>
        <div style={{ marginBottom: 6, lineHeight: 1 }}>{Ico.store}</div>
        <p style={{ fontSize: 15, fontWeight: 900, margin: "0 0 5px", letterSpacing: "0.3px" }}>
          {settings.storeName || "المتجر"}
        </p>
        {settings.storePhone && (
          <p style={{ fontSize: 10, margin: "2px 0", color: "#333", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {Ico.phone}&nbsp;{settings.storePhone}
          </p>
        )}
        {settings.storeAddress && (
          <p style={{ fontSize: 10, margin: "2px 0", color: "#333", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {Ico.pin}&nbsp;{settings.storeAddress}
          </p>
        )}
      </div>

      <div style={thinLine} />

      {/* ═══ META INFO ═══ */}
      <div style={{ padding: "7px 14px" }}>
        {/* فاتورة + التاريخ والوقت في صف واحد */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10 }}>
            {Ico.hash}&nbsp;<span style={{ color: "#555" }}>فاتورة:</span>&nbsp;
            <span style={{ fontWeight: 900, fontSize: 11 }}>#{receipt.receiptNumber || receipt.transactionId}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              {Ico.cal}&nbsp;<span style={{ fontWeight: 700 }}>{dateStr}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              {Ico.clock}&nbsp;<span style={{ fontWeight: 700 }}>{timeStr}</span>
            </span>
          </span>
        </div>

        {/* الكاشير + العميل + طريقة الدفع في صف واحد */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          {receipt.cashierName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10 }}>
              {Ico.user}&nbsp;<span style={{ color: "#555" }}>الكاشير:</span>&nbsp;
              <span style={{ fontWeight: 700 }}>{receipt.cashierName}</span>
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10 }}>
            {Ico.users}&nbsp;<span style={{ color: "#555" }}>العميل:</span>&nbsp;
            <span style={{ fontWeight: 700 }}>{receipt.customerName || "عام"}</span>
          </span>
          {payLabel && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10 }}>
              {Ico.card}&nbsp;<span style={{ color: "#555" }}>الدفع:</span>&nbsp;
              <span style={{ fontWeight: 800 }}>{payLabel}</span>
            </span>
          )}
        </div>
      </div>

      <div style={dash} />

      {/* ═══ ITEMS TABLE ═══ */}
      <div style={{ padding: "0 14px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "right", padding: "6px 2px 4px", fontWeight: 800, fontSize: 10.5, borderBottom: "1px solid #888" }}>المادة</th>
              <th style={{ textAlign: "center", padding: "6px 2px 4px", fontWeight: 800, fontSize: 10.5, borderBottom: "1px solid #888", width: 34 }}>الكمية</th>
              <th style={{ textAlign: "left", padding: "6px 2px 4px", fontWeight: 800, fontSize: 10.5, borderBottom: "1px solid #888", width: 64 }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: "1px dashed #ddd" }}>
                <td style={{ padding: "5px 2px", textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: "#000" }}>{item.name}</div>
                  <div style={{ fontSize: 9, color: "#777", marginTop: 1 }}>
                    {formatCurrency(item.price)}&nbsp;·&nbsp;{item.unitName}
                  </div>
                </td>
                <td style={{ textAlign: "center", padding: "5px 2px", fontWeight: 900, fontSize: 13, color: "#000" }}>
                  {item.quantity}
                </td>
                <td style={{ textAlign: "left", padding: "5px 2px", fontWeight: 800, fontSize: 11, fontVariantNumeric: "tabular-nums", color: "#000" }}>
                  {formatCurrency(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ DISCOUNT ═══ */}
      {discount > 0 && (
        <>
          <div style={{ ...dash, margin: "4px 0 0" }} />
          <div style={{ padding: "5px 14px 0", fontSize: 10.5 }}>
            <Row label="المجموع الفرعي" value={formatCurrency(subTotal)} />
            <Row
              label={<span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>{Ico.tag}&nbsp;خصم</span>}
              value={`-${formatCurrency(discount)}`}
              bold
            />
          </div>
        </>
      )}

      {/* ═══ TOTAL ═══ */}
      <div style={{ margin: "6px 0 0", padding: "9px 14px", background: "#f5f5f5", borderTop: "1px solid #999", borderBottom: "1px solid #999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: "#333" }}>المجموع الكلي</span>
        <span style={{ fontWeight: 900, fontSize: 20, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px", color: "#000" }}>
          {formatCurrency(receipt.totalAmount)}
        </span>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{ textAlign: "center", padding: "10px 14px 12px" }}>
        <p style={{ margin: "0 0 3px", fontWeight: 800, fontSize: 12, color: "#000", letterSpacing: "0.5px" }}>
          ✦&nbsp;شكراً لزيارتكم&nbsp;✦
        </p>
        {settings.footerMessage && (
          <p style={{ fontSize: 10, color: "#555", margin: "3px 0 0", lineHeight: 1.6 }}>
            {settings.footerMessage}
          </p>
        )}
      </div>

    </div>
  );
}

export const ReceiptPrint = React.forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ receipt, isPreview = false, storeSettings: settingsProp }, ref) => {
    const [settings, setSettings] = React.useState<StoreSettings>({
      storeName: "",
      storePhone: "",
      storeAddress: "",
      footerMessage: "",
    });

    React.useEffect(() => {
      if (settingsProp) { setSettings(settingsProp); return; }
      fetch("/api/settings")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setSettings({
            storeName: data.storeName || "",
            storePhone: data.storePhone || "",
            storeAddress: data.storeAddress || "",
            footerMessage: data.footerMessage || "",
          });
        })
        .catch(() => {});
    }, [settingsProp]);

    return (
      <>
        {/* Screen preview */}
        {isPreview && (
          <div
            ref={ref}
            style={{
              width: "100%",
              maxWidth: 320,
              margin: "0 auto",
              borderRadius: 5,
              overflow: "hidden",
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            }}
          >
            <ReceiptBody receipt={receipt} settings={settings} />
          </div>
        )}

        {/* Print-only */}
        <div id="printable-receipt" style={{ display: "none" }}>
          <ReceiptBody receipt={receipt} settings={settings} />
        </div>

        <style jsx global>{`
          @media print {
            @page { margin: 0; size: 80mm auto; }
            body * { visibility: hidden !important; }
            #printable-receipt,
            #printable-receipt * { visibility: visible !important; }
            #printable-receipt {
              display: block !important;
              position: absolute !important;
              left: 0 !important; top: 0 !important;
              width: 78mm !important;
              max-width: 78mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `}</style>
      </>
    );
  }
);

ReceiptPrint.displayName = "ReceiptPrint";
