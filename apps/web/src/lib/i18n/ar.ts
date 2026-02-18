// ═══════════════════════════════════════════════════════════════════════════
// INTERNATIONALISATION — Chaines arabes (RTL)
// ═══════════════════════════════════════════════════════════════════════════
// Usage: import { t } from '@/lib/i18n/ar';
// ═══════════════════════════════════════════════════════════════════════════

export const t = {
  // ── Actions communes ─────────────────────────────────────────────────
  actions: {
    add: 'إضافة',
    edit: 'تعديل',
    delete: 'حذف',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جاري الحفظ...',
    create: 'إنشاء',
    creating: 'جاري الإنشاء...',
    confirm: 'تأكيد',
    validate: 'التحقق',
    view: 'عرض',
    close: 'إغلاق',
    refresh: 'تحديث',
    reset: 'إعادة تعيين',
    resetting: 'جاري إعادة التعيين...',
    search: 'بحث',
    export: 'تصدير',
    history: 'السجل',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    send: 'إرسال',
    download: 'تحميل',
  },

  // ── États & Statuts ──────────────────────────────────────────────────
  status: {
    draft: 'مسودة',
    submitted: 'مُقدَّم',
    validated: 'مُصادق عليه',
    rejected: 'مرفوض',
    cancelled: 'ملغى',
    inProgress: 'قيد التنفيذ',
    completed: 'مكتمل',
    active: 'نشط',
    inactive: 'غير نشط',
    paid: 'مدفوع',
    pending: 'قيد الانتظار',
    sent: 'مُرسَل',
    confirmed: 'مؤكد',
    received: 'مُستلَم',
    partial: 'جزئي',
    ordered: 'مطلوب',
    bcGenerated: 'تم إنشاء أمر الشراء',
  },

  // ── Chargement & Messages vides ──────────────────────────────────────
  loading: {
    default: 'جاري التحميل...',
    alerts: 'جاري تحميل التنبيهات...',
    purchaseOrders: 'جاري تحميل أوامر الشراء...',
    suppliers: 'جاري تحميل الموردين...',
    clients: 'جاري تحميل العملاء...',
    invoices: 'جاري تحميل الفواتير...',
    stock: 'جاري تحميل المخزون...',
  },

  empty: {
    clients: 'لم يتم العثور على عملاء',
    suppliers: 'لا يوجد موردون',
    invoices: 'لم يتم العثور على فواتير',
    alerts: 'لا توجد تنبيهات نشطة',
    alertsResolved: 'تم معالجة جميع التنبيهات',
    movements: 'لم يتم العثور على حركات',
    receptions: 'لم يتم العثور على استلامات لهذه الفترة',
    purchaseOrders: 'لم يتم العثور على أوامر شراء',
    products: 'لم يتم العثور على منتجات',
  },

  // ── Erreurs ──────────────────────────────────────────────────────────
  errors: {
    generic: 'حدث خطأ',
    unknown: 'خطأ غير معروف',
    save: 'خطأ أثناء الحفظ',
    delete: 'خطأ أثناء الحذف',
    create: 'خطأ أثناء الإنشاء',
    update: 'خطأ أثناء التحديث',
    load: 'خطأ أثناء التحميل',
    send: 'خطأ أثناء الإرسال',
    network: 'خطأ في الشبكة',
    session: 'انتهت صلاحية الجلسة',
    fixErrors: 'يرجى تصحيح الأخطاء أعلاه',
  },

  // ── Succès ───────────────────────────────────────────────────────────
  success: {
    save: 'تم الحفظ بنجاح',
    create: 'تم الإنشاء بنجاح',
    delete: 'تم الحذف بنجاح',
    update: 'تم التحديث بنجاح',
    send: 'تم الإرسال بنجاح',
    bcSent: 'تم إرسال أمر الشراء بنجاح',
    bcGenerated: 'تم إنشاء أمر الشراء بنجاح',
    passwordReset: 'تم إعادة تعيين كلمة المرور بنجاح',
  },

  // ── Validation (formulaires) ─────────────────────────────────────────
  validation: {
    required: 'هذا الحقل مطلوب',
    clientCodeRequired: 'رمز العميل مطلوب',
    clientNameRequired: 'اسم العميل مطلوب',
    nifRequired: 'رقم التعريف الضريبي مطلوب',
    nifInvalid: 'رقم التعريف الضريبي غير صالح – يجب أن يتكون من 15 رقمًا',
    rcInvalid: 'السجل التجاري غير صالح',
    aiInvalid: 'رقم AI غير صالح',
    nisInvalid: 'رقم NIS غير صالح – يجب أن يتكون من 15 رقمًا',
    phoneInvalid: 'رقم الهاتف غير صالح',
    emailInvalid: 'البريد الإلكتروني غير صالح',
    passwordMin: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل',
    quantityPositive: 'يجب أن تكون الكمية إيجابية',
    justificationRequired: 'التبرير مطلوب',
  },

  // ── Entités & Labels ─────────────────────────────────────────────────
  entities: {
    client: 'عميل',
    clients: 'العملاء',
    supplier: 'مورد',
    suppliers: 'الموردون',
    invoice: 'فاتورة',
    invoices: 'الفواتير',
    product: 'منتج',
    products: 'المنتجات',
    rawMaterial: 'مادة أولية',
    finishedProduct: 'منتج نهائي',
    purchaseOrder: 'أمر شراء',
    purchaseOrders: 'أوامر الشراء',
    demand: 'طلب',
    demands: 'الطلبات',
    delivery: 'توصيل',
    deliveries: 'التوصيلات',
    recipe: 'وصفة',
    recipes: 'الوصفات',
    production: 'الإنتاج',
    stock: 'المخزون',
    inventory: 'الجرد',
    user: 'مستخدم',
    users: 'المستخدمون',
    device: 'جهاز',
    devices: 'الأجهزة',
    alert: 'تنبيه',
    alerts: 'التنبيهات',
  },

  // ── Colonnes de tableaux ─────────────────────────────────────────────
  columns: {
    code: 'الرمز',
    name: 'الاسم',
    type: 'النوع',
    address: 'العنوان',
    phone: 'الهاتف',
    contact: 'جهة الاتصال',
    actions: 'الإجراءات',
    quantity: 'الكمية',
    amount: 'المبلغ',
    totalHt: 'المجموع بدون ضريبة',
    totalTtc: 'المجموع شامل الضريبة',
    netToPay: 'صافي المستحق',
    unitPriceHt: 'سعر الوحدة',
    date: 'التاريخ',
    reference: 'المرجع',
    status: 'الحالة',
    receptions: 'الاستلامات',
  },

  // ── Types client ─────────────────────────────────────────────────────
  clientTypes: {
    DISTRIBUTEUR: 'موزع',
    GROSSISTE: 'تاجر جملة',
    SUPERETTE: 'سوبر ماركت صغير',
    FAST_FOOD: 'وجبات سريعة',
    AUTRE: 'أخرى',
  } as Record<string, string>,

  // ── Types alerte ─────────────────────────────────────────────────────
  alertTypes: {
    MP_CRITIQUE: 'مادة أولية حرجة',
    RUPTURE: 'نفاد المخزون',
    FOURNISSEUR_RETARD: 'تأخر المورد',
    PRODUCTION_BLOQUEE: 'إنتاج متوقف',
  } as Record<string, string>,

  // ── Mois ─────────────────────────────────────────────────────────────
  months: [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  ],

  // ── Filtres ──────────────────────────────────────────────────────────
  filters: {
    all: 'الكل',
    allFeminine: 'الكل',
    year: 'السنة',
    month: 'الشهر',
    from: 'من',
    to: 'إلى',
    period: 'الفترة',
  },

  // ── Titres modals ────────────────────────────────────────────────────
  modals: {
    newClient: 'عميل جديد',
    editClient: 'تعديل العميل',
    salesHistory: 'سجل المبيعات',
    receptionHistory: 'سجل الاستلامات',
    movementHistory: 'سجل الحركات',
    newReception: 'استلام جديد',
    inventoryStock: 'جرد المخزون',
    newProduction: 'إنتاج جديد',
    alertCenter: 'مركز التنبيهات',
    generateBc: 'إنشاء أمر شراء',
  },

  // ── Fiscal (DGI) ────────────────────────────────────────────────────
  fiscal: {
    dgiCompliance: 'المعلومات الضريبية',
    nif: 'رقم التعريف الضريبي',
    rc: 'السجل التجاري',
    ai: 'رقم AI',
    nis: 'رقم NIS',
    tva: 'ضريبة القيمة المضافة',
    timbreFiscal: 'الطابع الجبائي',
  },

  // ── Pagination ───────────────────────────────────────────────────────
  pagination: {
    page: 'صفحة',
    of: 'من',
    previousPage: 'الصفحة السابقة',
    nextPage: 'الصفحة التالية',
  },

  // ── Currency ─────────────────────────────────────────────────────────
  currency: {
    dzd: 'د.ج',
    dzdFull: 'دينار جزائري',
  },

  // ── Dashboard ────────────────────────────────────────────────────────
  dashboard: {
    title: 'لوحة التحكم',
    welcome: 'مرحبًا',
    overview: 'نظرة عامة',
    recentActivity: 'النشاط الأخير',
    quickActions: 'إجراءات سريعة',
  },

  // ── Navigation ───────────────────────────────────────────────────────
  nav: {
    dashboard: 'لوحة التحكم',
    stock: 'المخزون',
    production: 'الإنتاج',
    procurement: 'المشتريات',
    sales: 'المبيعات',
    clients: 'العملاء',
    suppliers: 'الموردون',
    reports: 'التقارير',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
  },
} as const;
