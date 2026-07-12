/** سطر ترحيب حسب وقت اليوم مع اسم المستخدم إن توفّر. */
export function greetingFor(username?: string | null): string {
  const base = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'
  return username ? `${base}، ${username} 👋` : `${base} 👋`
}
