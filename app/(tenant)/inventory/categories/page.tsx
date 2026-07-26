'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/query/fetcher';
import { useConfirm } from '@/hooks/useConfirm';
import Link from 'next/link';
import {
  FolderTree, Plus, Edit3, Trash2, X, Save, Search,
  ArrowRight, ChevronRight, Sparkles, CheckCircle, AlertCircle,
  FolderOpen, Folder, Loader2, MoveRight, RefreshCw,
  ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

interface Category {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  parent?: { name: string } | null;
  _count?: { products: number };
  children?: Category[];
}

interface Toast {
  type: 'success' | 'error';
  message: string;
}

// ── Build tree structure ──────────────────────────────────────────────────────
function buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  categories.forEach(c => map.set(c.id, { ...c, children: [] }));
  categories.forEach(c => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ── Toast Component ───────────────────────────────────────────────────────────
function ToastNotif({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 left-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white font-bold text-sm animate-fade-in-up ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}
    >
      {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      {toast.message}
    </div>
  );
}

// ── Category Tree Node ────────────────────────────────────────────────────────
function CategoryNode({
  cat,
  depth,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  reorderMode,
  draggedId,
  dragOverId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  cat: Category;
  depth: number;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onMoveUp: (cat: Category) => void;
  onMoveDown: (cat: Category) => void;
  isFirst: boolean;
  isLast: boolean;
  reorderMode: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (cat: Category) => void;
  onDragOver: (e: React.DragEvent, cat: Category) => void;
  onDrop: (cat: Category) => void;
  onDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = cat.children && cat.children.length > 0;
  const productCount = cat._count?.products ?? 0;
  const isDragging = reorderMode && depth === 0 && draggedId === cat.id;
  const isDragOver = reorderMode && depth === 0 && dragOverId === cat.id;

  return (
    <div>
      <div
        draggable={reorderMode && depth === 0}
        onDragStart={() => { if (reorderMode && depth === 0) onDragStart(cat); }}
        onDragOver={(e) => { if (reorderMode && depth === 0) onDragOver(e, cat); }}
        onDrop={() => { if (reorderMode && depth === 0) onDrop(cat); }}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-3 px-4 py-3 transition-all group border-b border-[var(--border-color)] last:border-0 ${
          depth > 0 ? 'bg-[var(--bg-page)]/40' : 'bg-[var(--bg-card)]'
        } ${reorderMode && depth === 0 ? 'cursor-grab active:cursor-grabbing' : 'hover:bg-[var(--color-primary-light)]'} ${
          isDragging ? 'opacity-40 scale-[0.99]' : ''
        } ${isDragOver ? 'border-t-2 border-blue-400 bg-blue-50' : ''}`}
        style={{ paddingRight: `${16 + depth * 28}px` }}
      >
        {/* Reorder handle / Expand toggle */}
        {reorderMode && depth === 0 ? (
          <GripVertical size={16} className="shrink-0 text-slate-300" />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className={`shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${
              hasChildren ? 'text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]' : 'invisible'
            }`}
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}

        {/* Sort order badge — visible in reorder mode */}
        {reorderMode && depth === 0 && (
          <span className="shrink-0 w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 text-xs font-black flex items-center justify-center">
            {cat.sortOrder + 1}
          </span>
        )}

        {/* Icon */}
        <div className="shrink-0">
          {hasChildren
            ? <FolderOpen size={18} className="text-[var(--color-primary)]" />
            : <Folder size={16} className="text-slate-400" />
          }
        </div>

        {/* Name + parent badge */}
        <div className="flex-1 min-w-0">
          {/* unicodeBidi isolate prevents Arabic shaper from treating adjacent
              inline spans as one text run, which causes the last character to
              show its medial form instead of the correct final/isolated form. */}
          <span
            style={{ unicodeBidi: 'isolate' }}
            className={`font-bold ${depth === 0 ? 'text-[var(--value-neutral)] text-base' : 'text-[var(--value-muted)] text-sm'}`}
          >
            {cat.name}
          </span>
          {cat.parent && (
            <span className="mr-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
              {'فرع: '}<bdi>{cat.parent.name}</bdi>
            </span>
          )}
          {cat.description && (
            <span className="mr-2 text-xs text-[var(--value-muted)] opacity-70 hidden md:inline">
              {'— '}<bdi>{cat.description}</bdi>
            </span>
          )}
        </div>

        {/* Product count badge */}
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
          productCount > 0
            ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
            : 'bg-slate-100 text-slate-400'
        }`}>
          {productCount} منتج
        </span>

        {/* Actions */}
        {reorderMode && depth === 0 ? (
          <div className="shrink-0 flex gap-1">
            <button
              disabled={isFirst}
              onClick={() => onMoveUp(cat)}
              className="p-1.5 r-btn bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="تحريك لأعلى"
            >
              <ArrowUp size={14} />
            </button>
            <button
              disabled={isLast}
              onClick={() => onMoveDown(cat)}
              className="p-1.5 r-btn bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="تحريك لأسفل"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        ) : (
          <div className="shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(cat)}
              className="p-1.5 r-btn bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
              title="تعديل"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => onDelete(cat)}
              className="p-1.5 r-btn bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--color-danger)] hover:bg-red-50 transition-all"
              title="حذف"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {cat.children!.map((child, ci) => (
            <CategoryNode
              key={child.id} cat={child} depth={depth + 1}
              onEdit={onEdit} onDelete={onDelete}
              onMoveUp={onMoveUp} onMoveDown={onMoveDown}
              isFirst={ci === 0} isLast={ci === cat.children!.length - 1}
              reorderMode={reorderMode}
              draggedId={draggedId} dragOverId={dragOverId}
              onDragStart={onDragStart} onDragOver={onDragOver}
              onDrop={onDrop} onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  usePageTitle('الفئات');
  const { confirm, dialog } = useConfirm();
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tree, setTree] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  // Seed state
  const [seeding, setSeeding] = useState(false);

  // Reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', parentId: '' });

  const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message });

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchJson<Category[]>('/api/categories'),
  });
  const loading = categoriesQuery.isPending;

  // Seed the local (reorder-editable) copy whenever fresh data arrives
  useEffect(() => {
    if (categoriesQuery.data) {
      setCategories(categoriesQuery.data);
      setTree(buildTree(categoriesQuery.data));
    }
  }, [categoriesQuery.data]);

  useEffect(() => {
    if (categoriesQuery.isError) showToast('error', 'فشل تحميل الأقسام');
  }, [categoriesQuery.isError]);

  // Refresh helper used after mutations (and to discard local reorder edits):
  // invalidates the cache, then re-seeds the local copy unconditionally.
  const fetchCategories = async () => {
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
    const data = queryClient.getQueryData<Category[]>(['categories']);
    if (data) {
      setCategories(data);
      setTree(buildTree(data));
    }
  };

  // ── Seed ──────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/categories/seed', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.seeded) {
        showToast('success', `تم تحميل ${data.count} قسم بنجاح ✓`);
        await fetchCategories();
      } else if (data.reason === 'already_exists') {
        showToast('error', 'يوجد أقسام مضافة مسبقاً');
      } else {
        showToast('error', data.error ?? 'فشل التحميل');
      }
    } catch {
      showToast('error', 'حدث خطأ أثناء التحميل');
    } finally {
      setSeeding(false);
    }
  };

  // ── Open modal ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditCat(null);
    setFormData({ name: '', description: '', parentId: '' });
    setIsModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setFormData({ name: cat.name, description: cat.description ?? '', parentId: cat.parentId ?? '' });
    setIsModalOpen(true);
  };

  // Get all descendant IDs to prevent circular parent selection
  function getDescendantIds(catId: string, allCats: Category[]): Set<string> {
    const result = new Set<string>();
    const stack = [catId];
    while (stack.length) {
      const curr = stack.pop()!;
      result.add(curr);
      allCats.filter(c => c.parentId === curr).forEach(c => stack.push(c.id));
    }
    return result;
  }

  // Parent options: all categories except self and its descendants
  const parentOptions = categories.filter(c => {
    if (!editCat) return true;
    const excluded = getDescendantIds(editCat.id, categories);
    return !excluded.has(c.id);
  });

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        parentId: formData.parentId || null,
        ...(editCat ? { id: editCat.id } : {}),
      };

      const res = await fetch('/api/categories', {
        method: editCat ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('success', editCat ? 'تم تعديل القسم بنجاح' : 'تم إضافة القسم بنجاح');
        setIsModalOpen(false);
        await fetchCategories();
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        showToast('error', data.error ?? 'فشل الحفظ');
      }
    } catch {
      showToast('error', 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (cat: Category) => {
    const productCount = cat._count?.products ?? 0;
    const msg = productCount > 0
      ? `⚠️ هذا القسم يحتوي على ${productCount} منتج. هل أنت متأكد من حذفه؟`
      : `هل تريد حذف قسم "${cat.name}"؟`;
    if (!await confirm({ title: 'حذف القسم', message: msg, variant: 'danger', confirmLabel: 'حذف' })) return;

    try {
      const res = await fetch(`/api/categories?id=${cat.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', 'تم حذف القسم');
        await fetchCategories();
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        const data = await res.json();
        showToast('error', data.error ?? 'فشل الحذف');
      }
    } catch {
      showToast('error', 'حدث خطأ أثناء الحذف');
    }
  };

  // ── Reorder helpers ───────────────────────────────────────────────────────
  const getRootsSorted = () =>
    [...categories]
      .filter(c => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragStart = (cat: Category) => setDraggedId(cat.id);

  const handleDragOver = (e: React.DragEvent, cat: Category) => {
    e.preventDefault();
    if (cat.id !== draggedId) setDragOverId(cat.id);
  };

  const handleDrop = (targetCat: Category) => {
    if (!draggedId || draggedId === targetCat.id) {
      setDraggedId(null); setDragOverId(null); return;
    }
    const roots = getRootsSorted();
    const fromIdx = roots.findIndex(c => c.id === draggedId);
    const toIdx = roots.findIndex(c => c.id === targetCat.id);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }
    const newOrder = [...roots];
    const [removed] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, removed);
    const orderMap = new Map(newOrder.map((c, i) => [c.id, i]));
    const updated = categories.map(c => orderMap.has(c.id) ? { ...c, sortOrder: orderMap.get(c.id)! } : c);
    const sorted = [...updated].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    setCategories(updated);
    setTree(buildTree(sorted));
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  const handleMoveUp = (cat: Category) => {
    const roots = getRootsSorted();
    const idx = roots.findIndex(c => c.id === cat.id);
    if (idx <= 0) return;
    const newOrder = [...roots];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    const orderMap = new Map(newOrder.map((c, i) => [c.id, i]));
    const updated = categories.map(c => orderMap.has(c.id) ? { ...c, sortOrder: orderMap.get(c.id)! } : c);
    const sorted = [...updated].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    setCategories(updated);
    setTree(buildTree(sorted));
  };

  const handleMoveDown = (cat: Category) => {
    const roots = getRootsSorted();
    const idx = roots.findIndex(c => c.id === cat.id);
    if (idx >= roots.length - 1) return;
    const newOrder = [...roots];
    [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
    const orderMap = new Map(newOrder.map((c, i) => [c.id, i]));
    const updated = categories.map(c => orderMap.has(c.id) ? { ...c, sortOrder: orderMap.get(c.id)! } : c);
    const sorted = [...updated].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    setCategories(updated);
    setTree(buildTree(sorted));
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    try {
      const items = categories
        .filter(c => !c.parentId)
        .map(c => ({ id: c.id, sortOrder: c.sortOrder }));
      const res = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        showToast('success', 'تم حفظ الترتيب بنجاح');
        setReorderMode(false);
        await fetchCategories();
      } else {
        showToast('error', 'فشل حفظ الترتيب');
      }
    } catch {
      showToast('error', 'حدث خطأ أثناء الحفظ');
    } finally {
      setSavingOrder(false);
    }
  };

  // ── Filter (flat search) ──────────────────────────────────────────────────
  const filteredFlat = searchQuery
    ? categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const displayTree = filteredFlat
    ? buildTree(filteredFlat.length > 0 ? filteredFlat.map(c => ({
      ...c, children: []
    })) : [])
    : tree;

  // Stats
  const rootCount = categories.filter(c => !c.parentId).length;
  const childCount = categories.filter(c => !!c.parentId).length;

  return (
    <div className="min-h-screen p-4 md:p-8 text-right" dir="rtl" style={{ background: 'var(--bg-page)' }}>
      {dialog}
      <div className="max-w-5xl mx-auto">

        {/* Back */}
        <div className="mb-3 flex items-center gap-2">
          <Link
            href="/inventory"
            className="flex items-center gap-2 text-[var(--value-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] px-4 py-2 rounded-lg transition-all font-bold text-sm"
          >
            <ArrowRight size={16} />
            <span>العودة للمخزن</span>
          </Link>
        </div>

        <PageHeader
          title="أقسام المنتجات"
          subtitle="نظّم منتجاتك في هيكلية من الأقسام الرئيسية والفرعية"
          icon={FolderTree}
          gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          actions={
            <div className="flex gap-3">
              {reorderMode ? (
                <>
                  <button
                    onClick={() => { setReorderMode(false); fetchCategories(); }}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <X size={16} />
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveOrder}
                    disabled={savingOrder}
                    className="btn-primary flex items-center gap-2"
                  >
                    {savingOrder ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {savingOrder ? 'جاري الحفظ...' : 'حفظ الترتيب'}
                  </button>
                </>
              ) : (
                <>
                  {categories.length > 0 && (
                    <button
                      onClick={() => setReorderMode(true)}
                      className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <GripVertical size={16} />
                      ترتيب الأقسام
                    </button>
                  )}
                  <button onClick={openAdd} className="btn-primary flex items-center gap-2">
                    <Plus size={18} />
                    قسم جديد
                  </button>
                </>
              )}
            </div>
          }
        />

        {/* Stats row */}
        {categories.length > 0 && (
          <div className="flex gap-4 mt-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
              <FolderOpen size={20} className="text-[var(--color-primary)]" />
              <div>
                <p className="text-xs text-[var(--value-muted)]">أقسام رئيسية</p>
                <p className="text-xl font-extrabold text-[var(--value-neutral)]">{rootCount}</p>
              </div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
              <Folder size={20} className="text-slate-400" />
              <div>
                <p className="text-xs text-[var(--value-muted)]">أقسام فرعية</p>
                <p className="text-xl font-extrabold text-[var(--value-neutral)]">{childCount}</p>
              </div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
              <RefreshCw size={20} className="text-slate-400" />
              <div>
                <p className="text-xs text-[var(--value-muted)]">الإجمالي</p>
                <p className="text-xl font-extrabold text-[var(--value-neutral)]">{categories.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Seed Banner */}
        {!loading && categories.length === 0 && (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)] p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center shrink-0 shadow-lg">
              <Sparkles size={32} className="text-white" />
            </div>
            <div className="flex-1 text-center md:text-right">
              <h3 className="text-xl font-extrabold text-[var(--color-primary)] mb-1">
                لا توجد أقسام بعد!
              </h3>
              <p className="text-[var(--value-muted)] text-sm leading-relaxed">
                هل تريد تحميل الهيكلية القياسية للسوبرماركت العراقي؟<br />
                <span className="font-bold">9 قسم رئيسي + 36 قسم فرعي</span> جاهزة للاستخدام الفوري.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
              >
                {seeding ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {seeding ? 'جاري التحميل...' : 'تحميل الأقسام'}
              </button>
              <button onClick={openAdd} className="px-5 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] font-bold text-sm text-[var(--value-muted)] hover:opacity-80 transition-all">
                إضافة يدوياً
              </button>
            </div>
          </div>
        )}

        {/* Search & List */}
        {categories.length > 0 && (
          <div className="mt-8">
            {/* Search bar */}
            <div className="relative mb-4">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن قسم..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-sm font-bold focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tree / Flat results */}
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-[var(--value-muted)] flex flex-col items-center gap-3">
                  <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
                  <p className="font-bold">جاري التحميل...</p>
                </div>
              ) : filteredFlat !== null && filteredFlat.length === 0 ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                  <Search size={40} className="opacity-20" />
                  <p className="font-bold">لا توجد نتائج لـ "{searchQuery}"</p>
                </div>
              ) : (
                <div>
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-[var(--border-color)] text-xs font-bold text-slate-500">
                    <span className="flex-1">اسم القسم</span>
                    <span className="w-20 text-center">المنتجات</span>
                    <span className="w-20 text-center">إجراءات</span>
                  </div>

                  {searchQuery
                    ? // Flat filtered results (reorder disabled in search)
                    filteredFlat!.map((cat, i) => (
                      <CategoryNode
                        key={cat.id}
                        cat={{ ...cat, children: [] }}
                        depth={cat.parentId ? 1 : 0}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        isFirst={i === 0}
                        isLast={i === filteredFlat!.length - 1}
                        reorderMode={false}
                        draggedId={null} dragOverId={null}
                        onDragStart={handleDragStart} onDragOver={handleDragOver}
                        onDrop={handleDrop} onDragEnd={handleDragEnd}
                      />
                    ))
                    : // Tree view
                    displayTree.map((root, i) => (
                      <CategoryNode
                        key={root.id}
                        cat={root}
                        depth={0}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        isFirst={i === 0}
                        isLast={i === displayTree.length - 1}
                        reorderMode={reorderMode}
                        draggedId={draggedId} dragOverId={dragOverId}
                        onDragStart={handleDragStart} onDragOver={handleDragOver}
                        onDrop={handleDrop} onDragEnd={handleDragEnd}
                      />
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-fade-in-up"
            dir="rtl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                {editCat ? (
                  <><MoveRight size={22} className="text-blue-500" /> تعديل القسم</>
                ) : (
                  <><Plus size={22} className="text-blue-500" /> قسم جديد</>
                )}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Category name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم القسم *</label>
                <input
                  required
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مشروبات غازية"
                />
              </div>

              {/* Parent selector */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  القسم الأب
                  <span className="mr-2 text-xs font-normal text-gray-400">(اختر "بدون" لجعله قسماً رئيسياً)</span>
                </label>
                <select
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm text-gray-700"
                  value={formData.parentId}
                  onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                >
                  <option value="">— بدون (قسم رئيسي) —</option>
                  
                  {parentOptions.filter(c => !c.parentId).map(root => (
                    <optgroup key={`group-${root.id}`} label={`📦 ‫${root.name}‬`}>
                      <option value={root.id}>
                        {`‫${root.name}‬`}{' (نفسه كقسم أب)'}
                      </option>
                      {parentOptions.filter(sub => sub.parentId === root.id).map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {`↳ ‫${sub.name}‬`}
                        </option>
                      ))}
                    </optgroup>
                  ))}

                  {/* في حالة وجود أقسام مستوى ثالث فما فوق أو أقسام يتيمة */}
                  {parentOptions.some(c => c.parentId && parentOptions.find(p => p.id === c.parentId)?.parentId) && (
                    <optgroup label="📂 أقسام فرعية أخرى (مستويات متقدمة)">
                      {parentOptions.filter(c => c.parentId && parentOptions.find(p => p.id === c.parentId)?.parentId).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.parent ? `${c.parent.name} ⬅️ ` : ''}{c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">وصف (اختياري)</label>
                <textarea
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف مختصر للقسم..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-7">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && <ToastNotif toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
