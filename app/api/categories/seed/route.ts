import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/api-helpers';
import { enqueueSync } from '@/lib/sync-enqueue';

// Iraqi Supermarket Standard Category Hierarchy
const IRAQI_CATEGORIES = [
  {
    name: 'مواد غذائية',
    description: 'جميع المواد الغذائية الأساسية والخزين الاستراتيجي',
    children: [
      { name: 'بقوليات وحبوب', description: 'حمص، فاصولياء، عدس، ماش، باقلاء' },
      { name: 'رز وطحين', description: 'رز عنبر، رز بسمتي، طحين صفر، طحين أسمر' },
      { name: 'زيوت ودهون', description: 'زيت دوار الشمس، زيت زيتون، سمن نباتي/حيواني، دهن حر' },
      { name: 'معكرونة وشعرية', description: 'معكرونة، سباغيتي، شعرية، اندومي/نودلز' },
      { name: 'معلبات', description: 'معجون طماطم، تونة، ساردين، فاصولياء معلبة، ذرة، حمص بطحينة' },
      { name: 'بهارات وتوابل', description: 'بهارات مشكلة، فلفل أسود، نومي بصرة، كركم، ملح، ماجي' },
    ],
  },
  {
    name: 'مشروبات وعصائر',
    description: 'مياه، عصائر، ومشروبات باردة وساخنة',
    children: [
      { name: 'مياه', description: 'مياه معدنية، مياه غازية، أكواب ماء' },
      { name: 'مشروبات غازية', description: 'بيبسي، سفن آب، ميرندا، كولا، طاقة' },
      { name: 'عصائر', description: 'عصير طبيعي، عصير باودر، شربت مركز' },
      { name: 'مشروبات ساخنة', description: 'شاي، قهوة، كابتشينو، نسكافيه، كاكاو بودرة' },
    ],
  },
  {
    name: 'ألبان وأجبان',
    description: 'منتجات مبردة، ألبان، ومشتقات الحليب',
    children: [
      { name: 'حليب', description: 'حليب سائل، حليب باودر، حليب مكثف' },
      { name: 'أجبان', description: 'جبن عرب، كرافت، مثلثات، موزاريلا، قشقوان' },
      { name: 'ألبان وقشطة', description: 'لبن رائب، زبادي، جيمر عرب، قشطة كيمر، زبدة' },
      { name: 'بيض', description: 'بيض مائدة طازج' },
    ],
  },
  {
    name: 'مجمدات',
    description: 'لحوم، أسماك، وخضار مجمدة',
    children: [
      { name: 'لحوم ودواجن مجمدة', description: 'دجاج كامل، كبة، برغر، سوسج، نقانق' },
      { name: 'أسماك مجمدة', description: 'سمك مجمد، فيليه، ربيان' },
      { name: 'خضار مجمدة', description: 'باميا، فاصولياء، بازيلاء، بطاطا/فنكر مجمد' },
      { name: 'معجنات مجمدة', description: 'عجينة بقلاوة، بورك، سمبوسة، بيتزا' },
    ],
  },
  {
    name: 'مخابز وحلويات',
    description: 'المخبوزات الطازجة والحلويات الجاهزة',
    children: [
      { name: 'خبز وصمون', description: 'صمون حجري، صمون كهربائي، خبز لبناني، خبز تنور' },
      { name: 'كيك وبسكويت', description: 'كيك جاهز، كليجة، بسكويت، ويفر، كراكرز' },
      { name: 'نستلة وشوكولاتة', description: 'نستلات، مارس، سنيكرز، بيض كندر، جكليت' },
      { name: 'مكسرات وكرزات', description: 'حب شمسي، فستق حلبي، لوز، شيبس، مقرمشات' },
    ],
  },
  {
    name: 'عناية شخصية',
    description: 'منتجات النظافة الشخصية والاستحمام',
    children: [
      { name: 'عناية بالشعر والجسم', description: 'شامبو، بلسم، صابون رقي، صابون سائل، ليفة' },
      { name: 'عناية بالبشرة', description: 'كريمات مرطبة، فازلين، واقي شمس، مزيل عرق' },
      { name: 'عناية بالفم', description: 'معجون أسنان، فرشاة، غسول فم' },
      { name: 'حلاقة وزينة', description: 'شفرات حلاقة، معجون حلاقة، جل شعر' },
    ],
  },
  {
    name: 'منظفات ومستهلكات',
    description: 'مواد التنظيف وأدوات الاستهلاك اليومية',
    children: [
      { name: 'غسيل ملابس', description: 'مسحوق غسيل، قاصر، معطر ملابس، زاهي' },
      { name: 'تنظيف منزلي', description: 'منظف أرضيات، زجاج، ديتول، فلاش، معطر جو' },
      { name: 'تنظيف أواني', description: 'سائل جلي، سيم مواعين، إسفنج' },
      { name: 'منتجات ورقية وبلاستيك', description: 'كلينكس، رول تواليت، أكياس نفايات، سفري ومواعين بلاستيك' },
    ],
  },
  {
    name: 'مستلزمات أطفال',
    description: 'تغذية وعناية الأطفال والرضع',
    children: [
      { name: 'غذاء أطفال', description: 'حليب رضع، سيريلاك' },
      { name: 'عناية أطفال', description: 'حفاظات، كلينكس مرطب، شامبو أطفال' },
      { name: 'أدوات رضاعة', description: 'قناني حليب، مصاصات، عضاضات' },
    ],
  },
  {
    name: 'متنوعات / كماليات',
    description: 'قرطاسية وأدوات الاستهلاك المنزلي',
    children: [
      { name: 'قرطاسية', description: 'أقلام، دفاتر، تلوين، لاصق شفاف' },
      { name: 'أدوات منزلية استهلاكية', description: 'بطاريات/باتريات، جداحات، قراصات غسيل، شمعات إضاءة' },
      { name: 'ألعاب وتسلية', description: 'ألعاب أطفال بسيطة، نفاخات، بطاقات هدايا' },
    ],
  },
];

export async function POST() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });

  try {
    const existingCount = await prisma.category.count({ where: { tenantId } });
    if (existingCount > 0) {
      return NextResponse.json({ seeded: false, reason: 'already_exists', count: existingCount });
    }

    let totalSeeded = 0;

    // Use individual creates (not createMany) so we get IDs for sync queueing.
    for (const cat of IRAQI_CATEGORIES) {
      const parent = await prisma.category.create({
        data: {
          tenantId,
          name: cat.name,
          description: cat.description,
        },
      });
      enqueueSync('categories', 'INSERT', parent.id, {
        id: parent.id,
        name: parent.name,
        description: parent.description,
        parentId: null,
      });
      totalSeeded++;

      for (const child of cat.children ?? []) {
        const childCat = await prisma.category.create({
          data: {
            tenantId,
            name: child.name,
            description: child.description,
            parentId: parent.id,
          },
        });
        enqueueSync('categories', 'INSERT', childCat.id, {
          id: childCat.id,
          name: childCat.name,
          description: childCat.description,
          parentId: childCat.parentId,
        });
        totalSeeded++;
      }
    }

    return NextResponse.json({ seeded: true, count: totalSeeded });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'فشل تحميل الأقسام' }, { status: 500 });
  }
}
