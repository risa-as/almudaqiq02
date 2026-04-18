import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM ?? 'noreply@supermarket-saas.com'

export async function sendSubscriptionExpirySoon(
  to: string,
  tenantName: string,
  daysLeft: number
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `تنبيه: اشتراكك في ${tenantName} سينتهي خلال ${daysLeft} أيام`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #f59e0b;">⚠️ تنبيه انتهاء الاشتراك</h2>
        <p>عزيزي العميل،</p>
        <p>اشتراكك في نظام <strong>${tenantName}</strong> سينتهي خلال <strong>${daysLeft} أيام</strong>.</p>
        <p>يرجى التواصل مع الدعم الفني لتجديد اشتراكك والاستمرار في استخدام النظام بدون انقطاع.</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">هذا بريد تلقائي من نظام إدارة المتاجر SaaS</p>
      </div>
    `,
  })
}

export async function sendSubscriptionExpired(to: string, tenantName: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `انتهى اشتراكك في ${tenantName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #ef4444;">❌ انتهاء الاشتراك</h2>
        <p>عزيزي العميل،</p>
        <p>انتهى اشتراكك في نظام <strong>${tenantName}</strong>.</p>
        <p>تم تحويل حسابك إلى وضع القراءة فقط. بياناتك محفوظة ويمكنك تجديد الاشتراك خلال 30 يوماً.</p>
        <p>يرجى التواصل مع الدعم الفني لتجديد الاشتراك.</p>
      </div>
    `,
  })
}

export async function sendSyncFailureAlert(
  to: string,
  branchName: string,
  failureCount: number
) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `تنبيه: فشل المزامنة في فرع ${branchName}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: #ef4444;">🔄 فشل المزامنة</h2>
        <p>فشلت المزامنة في فرع <strong>${branchName}</strong> بشكل متكرر (${failureCount} محاولة).</p>
        <p>يرجى التحقق من اتصال الإنترنت في الفرع والتواصل مع الدعم الفني إذا استمرت المشكلة.</p>
      </div>
    `,
  })
}
