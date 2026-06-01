"use client";
import { usePageTitle } from '@/hooks/usePageTitle';

import { useEffect, useState } from "react";
import {
  Shield,
  User,
  Mail,
  Lock,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Calendar,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

interface Profile {
  id: string;
  username: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

function FieldGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <Icon size={14} className="text-blue-500" />
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800
        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white
        disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      dir={type === "email" || type === "password" ? "ltr" : "rtl"}
    />
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 pl-10 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-800
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
        dir="ltr"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  usePageTitle('الإعدادات');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  useEffect(() => {
    fetch("/api/super-admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d);
        setUsername(d.username ?? "");
        setEmail(d.email ?? "");
      })
      .catch(() => toast.error("فشل تحميل البيانات"))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل الحفظ");
        return;
      }
      toast.success("تم حفظ المعلومات بنجاح");
      setProfile((prev) =>
        prev
          ? { ...prev, username, email, updatedAt: new Date().toISOString() }
          : prev,
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (newPw !== confirmPw) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقتين");
      return;
    }
    if (newPw.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/super-admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تغيير كلمة المرور");
        return;
      }
      toast.success("تم تغيير كلمة المرور بنجاح");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } finally {
      setSaving(false);
    }
  }

  const passwordMatch = newPw && confirmPw && newPw === confirmPw;
  const passwordMismatch = newPw && confirmPw && newPw !== confirmPw;

  if (loading)
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #094B9F 0%, #063A8A 100%)",
            boxShadow: "0 8px 24px rgba(14,99,212,0.3)",
          }}
        >
          <Shield size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">إعدادات الحساب</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            تعديل معلومات حساب السوبر ادمن
          </p>
        </div>
      </div>

      {/* Account Info strip */}
      {profile && (
        <div
          className="rounded-2xl p-4 flex items-center gap-4 flex-wrap"
          style={{
            background:
              "linear-gradient(135deg, rgba(14,99,212,0.06) 0%, rgba(9,75,159,0.04) 100%)",
            border: "1px solid rgba(14,99,212,0.12)",
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #094B9F, #063A8A)",
              color: "white",
            }}
          >
            {profile.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900">{profile.username}</p>
            <p className="text-xs text-gray-500">
              {profile.email || "لا يوجد بريد إلكتروني"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar size={12} />
            عضو منذ{" "}
            {new Date(profile.createdAt).toLocaleDateString("ar-IQ", {
              year: "numeric",
              month: "long",
            })}
          </div>
        </div>
      )}

      {/* ── Section 1: Profile Info ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="px-6 py-4 border-b border-gray-50 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #f8f7ff 0%, #f0f0ff 100%)",
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #094B9F, #063A8A)" }}
          >
            <User size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              المعلومات الشخصية
            </h2>
            <p className="text-xs text-gray-400">
              اسم المستخدم والبريد الإلكتروني
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <FieldGroup label="اسم المستخدم" icon={User}>
            <Input
              value={username}
              onChange={setUsername}
              placeholder="superadmin"
            />
          </FieldGroup>
          <FieldGroup label="البريد الإلكتروني" icon={Mail}>
            <Input
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="admin@example.com"
            />
          </FieldGroup>
          <div className="pt-2">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #094B9F, #063A8A)",
                boxShadow: "0 4px 16px rgba(14,99,212,0.3)",
              }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "جارٍ الحفظ..." : "حفظ المعلومات"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Change Password ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="px-6 py-4 border-b border-gray-50 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #fff8f0 0%, #fff0e6 100%)",
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
          >
            <Lock size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">
              تغيير كلمة المرور
            </h2>
            <p className="text-xs text-gray-400">
              يجب إدخال كلمة المرور الحالية للتأكيد
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <FieldGroup label="كلمة المرور الحالية" icon={KeyRound}>
            <PasswordInput
              value={currentPw}
              onChange={setCurrentPw}
              placeholder="••••••••"
            />
          </FieldGroup>
          <FieldGroup label="كلمة المرور الجديدة" icon={Lock}>
            <PasswordInput
              value={newPw}
              onChange={setNewPw}
              placeholder="6 أحرف على الأقل"
            />
            {newPw && newPw.length < 6 && (
              <p className="text-xs text-orange-500 flex items-center gap-1 mt-1">
                <AlertCircle size={11} /> يجب أن تكون 6 أحرف على الأقل
              </p>
            )}
          </FieldGroup>
          <FieldGroup label="تأكيد كلمة المرور الجديدة" icon={Lock}>
            <div className="relative">
              <PasswordInput
                value={confirmPw}
                onChange={setConfirmPw}
                placeholder="أعد كتابة كلمة المرور"
              />
            </div>
            {passwordMatch && (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                <CheckCircle2 size={11} /> كلمتا المرور متطابقتان
              </p>
            )}
            {passwordMismatch && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle size={11} /> كلمتا المرور غير متطابقتين
              </p>
            )}
          </FieldGroup>
          <div className="pt-2">
            <button
              onClick={savePassword}
              disabled={
                saving ||
                !currentPw ||
                !newPw ||
                !confirmPw ||
                !!passwordMismatch
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
              style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                boxShadow: "0 4px 16px rgba(249,115,22,0.3)",
              }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {saving ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 3: Account Meta ── */}
      {profile && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            معلومات الحساب
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "معرّف الحساب", value: profile.id, mono: true },
              { label: "الدور", value: "Super Admin", mono: false },
              {
                label: "تاريخ الإنشاء",
                value: new Date(profile.createdAt).toLocaleDateString("ar-IQ", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
                mono: false,
              },
              {
                label: "آخر تعديل",
                value: new Date(profile.updatedAt).toLocaleDateString("ar-IQ", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
                mono: false,
              },
            ].map(({ label, value, mono }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {label}
                </p>
                <p
                  className={`text-sm font-semibold text-gray-700 truncate ${mono ? "font-mono text-xs" : ""}`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
