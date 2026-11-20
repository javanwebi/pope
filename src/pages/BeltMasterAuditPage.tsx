import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Layers,
  Ruler,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { toPersianDigits } from '../utils/formatters';

interface AuditSummaryPayload {
  generatedAt: string;
  reconciliation: {
    totalWarehouseSkus: number;
    totalAuditedBeltCohortSkus: number;
    totalSourceBeltFamilies: number;
    totalProposedEngineeringFamilies: number;
    totalRuntimePfamFamilies: number;
    totalRuntimeStandaloneDirectSkus: number;
    skuStatusBreakdown: {
      CORRECT_FAMILY: number;
      STANDALONE_CANDIDATE: number;
      FAMILY_MISMATCH: number;
      OUT_OF_SCOPE: number;
      PENDING_REVIEW: number;
    };
    globalUnassignedPoolTotal: number;
    reassignedSkusTotal: number;
  };
  imageAuditSummary: {
    totalBeltFamiliesAudited: number;
    familiesWithVerifiedUniqueRealPhotos: number;
    totalVerifiedUniqueFamilyPhotoSlots: number;
    familiesWithEngineeringSpecSheet: number;
    skusWithVerifiedRealMarkingPhoto: number;
    skusWithVerifiedTechnicalDrawing: number;
    skusHeldWithoutDrawingPendingDimensions: number;
    rejectedCandidateImagesCount: number;
    duplicateAssignmentsRemovedCount: number;
  };
  deliverables: Array<{
    id: number;
    filename: string;
    rows: number;
    descriptionFa: string;
  }>;
  pilotShowcase: Array<{
    pilotOrder: number;
    sourceFamilyId: string;
    proposedFamilyId: string;
    runtimePfamId: string;
    titleFa: string;
    titleEn: string;
    brand: string;
    profile: string;
    beltDivision: string;
    supplyForm: string;
    standardReference: string;
    bodyMaterial: string;
    tensileCord: string;
    totalMemberSkus: number;
    excludedIncompatibleSkusCount: number;
    excludedIncompatibleSkusSample: Array<{ sku: string; reason: string }>;
    manufacturerUrl: string;
    familySlots: Array<{
      slotNumber: number;
      slotName: string;
      status: string;
      url: string | null;
      originalSourceUrl: string | null;
      sourcePageUrl: string | null;
      noteFa: string;
    }>;
    specSheetUrl: string;
    sampleSkus: Array<{
      sku: string;
      rawTitle: string;
      rawSize: string;
      unit: string;
      sourceFamilyId: string;
      proposedFamilyId: string;
      runtimePfamId: string;
      auditStatus: string;
      recommendedAction: string;
      profile: string;
      widthMm: number | null;
      pitchLengthMm: number | null;
      insideLengthMm: number | null;
      toothCount: number | null;
      realMarkingPhoto: {
        status: string;
        url: string | null;
        originalSourceUrl: string | null;
        sourcePageUrl: string | null;
        visibleMarking: string | null;
        noteFa: string;
      };
      technicalDrawingUrl: string;
      profileDrawingUrl: string;
    }>;
  }>;
  sampleReassignments: Array<Record<string, string>>;
  sampleGlobalUnassigned: Array<Record<string, string>>;
  sampleRejectedImages: Array<Record<string, string>>;
  sampleDuplicateImages: Array<Record<string, string>>;
  manufacturerSources: Array<{
    brandCode: string;
    manufacturerName: string;
    officialWebsite: string;
    verifiedSeriesInCatalog: string[];
    technicalCatalogUrls: string[];
  }>;
}

export const BeltMasterAuditPage: React.FC = () => {
  const [data, setData] = useState<AuditSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pilot' | 'deliverables' | 'reassignments' | 'images'>('pilot');

  useEffect(() => {
    fetch('/api/belt-audit/summary')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center" dir="rtl">
        <div className="inline-block w-8 h-8 border-4 border-[#E06518] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm font-bold text-slate-600">
          در حال بارگذاری گزارش ممیزی جامع مهندسی تسمه‌های صنعتی...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center" dir="rtl">
        <p className="text-sm font-bold text-rose-600">خطا در بارگذاری داده‌های ممیزی تسمه.</p>
      </div>
    );
  }

  const { reconciliation, imageAuditSummary } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6" dir="rtl">
      {/* Header Banner */}
      <section className="rounded-3xl bg-[#2B313A] text-white p-6 sm:p-8 shadow-md border border-slate-700 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>گزارش اجرایی دستور مادر جامع صنعت پیش — مهندسی خانواده‌ها و ممیزی تصاویر تسمه صنعتی</span>
          </div>
          <Link
            to="/category/excel-v2-1-1"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
          >
            <span>بازگشت به کاتالوگ تسمه‌ها</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black leading-snug">
            مرکز ممیزی مهندسی خانواده‌های تسمه، بازتخصیص کدهای کالا و بانک تصاویر تاییدشده
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-4xl leading-6">
            اجرای کامل قوانین ۶گانه غیرقابل مذاکره: بدون جعل اطلاعات، بدون حذف هیچ کد کالا ({toPersianDigits(reconciliation.totalAuditedBeltCohortSkus.toLocaleString('en-US'))} کد ممیزی تسمه از {toPersianDigits(reconciliation.totalWarehouseSkus.toLocaleString('en-US'))} کد کل انبار)، جداسازی کامل شناسه‌های <span dir="ltr" className="inline-block font-mono">FAM-*</span> و <span dir="ltr" className="inline-block font-mono">PFAM-*</span>، حذف {toPersianDigits(imageAuditSummary.duplicateAssignmentsRemovedCount.toLocaleString('en-US'))} انتساب عکس تکراری بین خانواده‌ها (<span dir="ltr" className="inline-block font-mono">REJECTED_DUPLICATE</span>) و حذف {toPersianDigits(imageAuditSummary.rejectedCandidateImagesCount.toLocaleString('en-US'))} تصویر اشتباه یا فاقد مجوز (<span dir="ltr" className="inline-block font-mono">REJECTED_WRONG_PRODUCT</span>).
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-1">
            <div className="text-[11px] text-slate-300">کل کدهای ممیزی تسمه</div>
            <div className="text-xl font-black text-white">
              {toPersianDigits(reconciliation.totalAuditedBeltCohortSkus.toLocaleString('en-US'))}
            </div>
            <div className="text-[10px] text-emerald-300 font-bold">۰ کد گمشده یا حذف‌شده</div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-1">
            <div className="text-[11px] text-slate-300">کدهای همگن در خانواده</div>
            <div className="text-xl font-black text-emerald-400">
              {toPersianDigits(
                (
                  reconciliation.skuStatusBreakdown.CORRECT_FAMILY +
                  reconciliation.skuStatusBreakdown.STANDALONE_CANDIDATE
                ).toLocaleString('en-US'),
              )}
            </div>
            <div className="text-[10px] text-slate-300">
              شامل {toPersianDigits(reconciliation.skuStatusBreakdown.STANDALONE_CANDIDATE)} تک‌کد مستقل
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-1">
            <div className="text-[11px] text-slate-300">مخزن بازتخصیص سراسری</div>
            <div className="text-xl font-black text-amber-400">
              {toPersianDigits(reconciliation.skuStatusBreakdown.FAMILY_MISMATCH.toLocaleString('en-US'))}
            </div>
            <div className="text-[10px] text-slate-300">کد منتقل‌شده به خانواده واقعی</div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-1">
            <div className="text-[11px] text-slate-300">کالاهای غیرتسمه‌ای خارج‌شده</div>
            <div className="text-xl font-black text-sky-300">
              {toPersianDigits(reconciliation.skuStatusBreakdown.OUT_OF_SCOPE)}
            </div>
            <div className="text-[10px] text-slate-300">پولی/قالب/یاتاقان (<bdi dir="ltr" className="font-mono">OUT_OF_SCOPE</bdi>)</div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-1">
            <div className="text-[11px] text-slate-300">تصاویر تکراری حذف‌شده</div>
            <div className="text-xl font-black text-rose-400">
              {toPersianDigits(imageAuditSummary.duplicateAssignmentsRemovedCount.toLocaleString('en-US'))}
            </div>
            <div className="text-[10px] text-slate-300"><bdi dir="ltr" className="font-mono">REJECTED_DUPLICATE</bdi> (قانون ۴)</div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 space-y-1">
            <div className="text-[11px] text-slate-300">فایل‌های خروجی استاندارد</div>
            <div className="text-xl font-black text-orange-400">{toPersianDigits(17)} فایل</div>
            <div className="text-[10px] text-slate-300">آماده دانلود مستقیم CSV/JSON/MD</div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('pilot')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'pilot'
              ? 'bg-[#E06518] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#E06518]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>
            پایلوت اجرایی ({toPersianDigits(data.pilotShowcase.length)} خانواده منتخب و{' '}
            {toPersianDigits(imageAuditSummary.skusWithVerifiedRealMarkingPhoto)} کد با مارکینگ واقعی)
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deliverables')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'deliverables'
              ? 'bg-[#E06518] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#E06518]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>دانلود ۱۷ فایل خروجی الزامی (بخش چهاردهم)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reassignments')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'reassignments'
              ? 'bg-[#E06518] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#E06518]'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>مخزن سراسری (GLOBAL_UNASSIGNED_BELT_SKUS) و بازتخصیص‌ها</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'images'
              ? 'bg-[#E06518] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:border-[#E06518]'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>گزارش تصاویر ردشده، تکراری و منابع سازندگان</span>
        </button>
      </div>

      {/* TAB 1: PILOT SHOWCASE */}
      {activeTab === 'pilot' && (
        <section className="space-y-6">
          <div className="rounded-2xl bg-orange-50/70 border border-orange-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-black text-slate-800">
                پایلوت اجرایی {toPersianDigits(data.pilotShowcase.length)} خانواده منتخب با ۴ تصویر واقعی و{' '}
                {toPersianDigits(imageAuditSummary.skusWithVerifiedRealMarkingPhoto)} کد کالای تاییدشده با مارکینگ فیزیکی روی تسمه
              </h2>
              <p className="text-xs text-slate-600">
                شامل تطبیق کامل شناسه مبدا (<bdi dir="ltr" className="font-mono">FAM-*</bdi>)، شناسه مهندسی ممیزی (<bdi dir="ltr" className="font-mono">FAM-*</bdi>) و شناسه اجرایی کاتالوگ (<bdi dir="ltr" className="font-mono">PFAM-*</bdi>)، به همراه ۴ تصویر واقعی اختصاصی لوکال (<bdi dir="ltr" className="font-mono">.webp</bdi>)، جدول مشخصات مهندسی، عکس مارکینگ واقعی روی تسمه و نقشه‌های فنی CAD.
              </p>
            </div>
          </div>

          {data.pilotShowcase.map((fam) => (
            <article
              key={fam.sourceFamilyId}
              className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden space-y-5 p-5 sm:p-6"
            >
              {/* Family Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#E06518] text-white text-xs font-black">
                      خانواده پایلوت #{toPersianDigits(fam.pilotOrder)}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono font-bold"
                      dir="ltr"
                    >
                      Source: {fam.sourceFamilyId}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-mono font-bold"
                      dir="ltr"
                    >
                      Audit: {fam.proposedFamilyId}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-mono font-bold"
                      dir="ltr"
                    >
                      Runtime: {fam.runtimePfamId}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">{fam.titleFa}</h3>
                  <p className="text-xs font-mono text-slate-500" dir="ltr">
                    {fam.titleEn} | Standard: {fam.standardReference}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/products/${encodeURIComponent(fam.runtimePfamId)}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E06518] hover:bg-[#c55510] text-white text-xs font-bold transition-colors"
                  >
                    <span>مشاهده صفحه زنده خانواده در سایت</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                  <a
                    href={fam.manufacturerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-400 text-slate-700 text-xs font-bold transition-colors"
                  >
                    <span>مرجع رسمی سازنده ({fam.brand})</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Engineering Identity Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 text-xs">
                <div>
                  <span className="text-slate-500">پروفیل و ساختار: </span>
                  <strong className="font-mono text-slate-900" dir="ltr">
                    {fam.profile} ({fam.beltDivision})
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">فرم عرضه: </span>
                  <strong className="text-slate-900">{fam.supplyForm}</strong>
                </div>
                <div>
                  <span className="text-slate-500">جنس بدنه: </span>
                  <strong className="text-slate-900">{fam.bodyMaterial}</strong>
                </div>
                <div>
                  <span className="text-slate-500">کورد کششی: </span>
                  <strong className="text-slate-900">{fam.tensileCord}</strong>
                </div>
              </div>

              {/* 4 Real Family Photo Slots + Companion Engineering Spec Sheet */}
              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#E06518]" />
                  <span>
                    وضعیت ۴ تصویر واقعی خانواده (<bdi dir="ltr" className="font-mono">{fam.runtimePfamId}</bdi>)
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {fam.familySlots.map((slot) => (
                    <div
                      key={slot.slotNumber}
                      className={`rounded-2xl border overflow-hidden flex flex-col ${
                        slot.url
                          ? 'border-emerald-200 bg-white'
                          : 'border-dashed border-slate-300 bg-slate-50/70'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-slate-50 p-3 flex items-center justify-center border-b border-slate-100 relative">
                        {slot.url ? (
                          <img
                            src={slot.url}
                            alt={slot.slotName}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-center space-y-1.5 px-2">
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                              NOT_FOUND
                            </span>
                            <p className="text-[11px] font-bold text-slate-600">جایگاه خالی طبق قانون ۵</p>
                          </div>
                        )}
                        <span
                          className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold ${
                            slot.url ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                          dir="ltr"
                        >
                          {slot.slotName}
                        </span>
                      </div>
                      <div className="p-3 space-y-1 text-[11px] flex-1 flex flex-col justify-between">
                        <p className="text-slate-700 font-medium leading-4">{slot.noteFa}</p>
                        {slot.sourcePageUrl && (
                          <a
                            href={slot.sourcePageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#E06518] font-bold hover:underline pt-1"
                          >
                            <span>لینک صفحه منبع تصویر</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Companion Engineering Spec Sheet */}
                <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3 flex flex-col sm:flex-row items-center gap-3.5 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-16 rounded-xl bg-white border border-indigo-100 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={fam.specSheetUrl}
                        alt="family-specifications"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">جدول مشخصات مهندسی و بازه ابعادی خانواده</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-900 text-white text-[9.5px] font-mono font-bold" dir="ltr">
                          VERIFIED_ENGINEERING_REDRAW
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        تولیدشده از استاندارد مرجع و ابعاد واقعی کدهای عضو خانواده (<bdi dir="ltr" className="font-mono">family-specifications.svg</bdi>)
                      </p>
                    </div>
                  </div>
                  <a
                    href={fam.specSheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 text-indigo-800 text-xs font-bold shrink-0 transition-colors"
                  >
                    <span>مشاهده جدول با کیفیت اصلی</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Sample Member SKUs */}
              <div className="space-y-2.5">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-[#E06518]" />
                  <span>کدهای کالای منتخب این خانواده در پایلوت (بررسی ۲ جایگاه تصویر هر SKU)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fam.sampleSkus.map((sku) => (
                    <div
                      key={sku.sku}
                      className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold"
                              dir="ltr"
                            >
                              SKU {sku.sku}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                sku.auditStatus === 'CORRECT_FAMILY'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                              dir="ltr"
                            >
                              {sku.auditStatus}
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-800 mt-1">{sku.rawTitle}</div>
                        </div>
                        <Link
                          to={`/products/${encodeURIComponent(sku.runtimePfamId)}?sku=${encodeURIComponent(sku.sku)}`}
                          className="text-[11px] font-bold text-[#E06518] hover:underline"
                        >
                          باز کردن در صفحه محصول ←
                        </Link>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* SKU Slot 1: Real Marking Photo */}
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5 flex flex-col">
                          <div className="text-[10.5px] font-black text-slate-700 flex items-center justify-between">
                            <span>۰۱: عکس واقعی مارکینگ</span>
                            <span
                              className={`font-mono text-[9.5px] px-1.5 py-0.5 rounded ${
                                sku.realMarkingPhoto.url
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                              dir="ltr"
                            >
                              {sku.realMarkingPhoto.status}
                            </span>
                          </div>
                          <div className="aspect-[16/10] bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center p-1.5">
                            {sku.realMarkingPhoto.url ? (
                              <img
                                src={sku.realMarkingPhoto.url}
                                alt={`SKU ${sku.sku}`}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="text-[10.5px] text-slate-500 text-center px-2">
                                جایگاه خالی (NOT_FOUND — بدون جایگزینی عکس سایز دیگر)
                              </span>
                            )}
                          </div>
                          {sku.realMarkingPhoto.visibleMarking && (
                            <div
                              className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded truncate"
                              dir="ltr"
                            >
                              Marking: {sku.realMarkingPhoto.visibleMarking}
                            </div>
                          )}
                          {sku.realMarkingPhoto.sourcePageUrl && (
                            <a
                              href={sku.realMarkingPhoto.sourcePageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-[#E06518] font-bold hover:underline inline-flex items-center gap-1"
                            >
                              <span>مشاهده منبع اصلی عکس</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {/* SKU Slot 2: Technical Drawing */}
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5 flex flex-col">
                          <div className="text-[10.5px] font-black text-slate-700 flex items-center justify-between">
                            <span>۰۲: نقشه فنی ابعاد</span>
                            <span
                              className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900"
                              dir="ltr"
                            >
                              CAD_REDRAW
                            </span>
                          </div>
                          <a
                            href={sku.technicalDrawingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="aspect-[16/10] bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center p-1.5 hover:opacity-90"
                          >
                            <img
                              src={sku.profileDrawingUrl}
                              alt={`Drawing ${sku.sku}`}
                              className="w-full h-full object-contain"
                            />
                          </a>
                          <div className="text-[10px] font-mono text-slate-600 truncate" dir="ltr">
                            Profile: {sku.profile} | W: {sku.widthMm ?? '-'}mm | Lp/Li:{' '}
                            {sku.pitchLengthMm ?? sku.insideLengthMm ?? '-'}mm
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* TAB 2: 17 MANDATORY DELIVERABLES */}
      {activeTab === 'deliverables' && (
        <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              فهرست کامل ۱۷ فایل خروجی الزامی (بخش چهاردهم دستور مادر)
            </h2>
            <p className="text-xs text-slate-600">
              تمام فایل‌ها بر اساس آخرین وضعیت ممیزی مهندسی و تصفیه یک‌به‌یک تصاویر تولید شده‌اند و به‌صورت مستقیم قابل دانلود یا مشاهده هستند.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-3 px-3 font-black">ردیف</th>
                  <th className="py-3 px-3 font-black">نام فایل استاندارد</th>
                  <th className="py-3 px-3 font-black">تعداد رکورد</th>
                  <th className="py-3 px-3 font-black">شرح مهندسی محتوا</th>
                  <th className="py-3 px-3 font-black text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {data.deliverables.map((item) => (
                  <tr key={item.filename} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-bold text-slate-700">{toPersianDigits(item.id)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900" dir="ltr">
                      {item.filename}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#E06518]">
                      {toPersianDigits(item.rows.toLocaleString('en-US'))}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{item.descriptionFa}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`/api/belt-audit/deliverables/${encodeURIComponent(item.filename)}?download=1`}
                          download={item.filename}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E06518] hover:bg-[#c55510] text-white font-bold transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>دانلود</span>
                        </a>
                        <a
                          href={`/api/belt-audit/deliverables/${encodeURIComponent(item.filename)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-400 text-slate-700 font-bold transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>مشاهده</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: GLOBAL UNASSIGNED BELT SKUS & REASSIGNMENTS */}
      {activeTab === 'reassignments' && (
        <section className="space-y-5">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  مخزن مرکزی کدهای نیازمند تخصیص (GLOBAL_UNASSIGNED_BELT_SKUS) و جدول بازتخصیص سراسری
                </h2>
                <p className="text-xs text-slate-600">
                  نمایش نمونه از {toPersianDigits(data.reconciliation.globalUnassignedPoolTotal.toLocaleString('en-US'))} کد کالایی که در خانواده مبدا اشتباه قرار داشتند و پس از تطبیق سراسری پروفیل، برند و فرم عرضه به خانواده مهندسی واقعی خود منتقل شدند.
                </p>
              </div>
              <a
                href="/api/belt-audit/deliverables/global_unassigned_belt_skus.csv?download=1"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E06518] text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود کامل فایل مخزن بازتخصیص (CSV)</span>
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="py-2.5 px-3 font-black">کد کالا</th>
                    <th className="py-2.5 px-3 font-black">عنوان کالا در انبار</th>
                    <th className="py-2.5 px-3 font-black">خانواده مبدا (اشتباه)</th>
                    <th className="py-2.5 px-3 font-black">پروفیل / برند استخراج‌شده</th>
                    <th className="py-2.5 px-3 font-black">خانواده مهندسی مقصد (تصحیح‌شده)</th>
                    <th className="py-2.5 px-3 font-black">علت مهندسی جابه‌جایی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {data.sampleGlobalUnassigned.map((row) => (
                    <tr key={row.sku_id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#E06518]" dir="ltr">
                        {row.sku_id}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{row.raw_title}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[11px] text-rose-700" dir="ltr">
                          {row.original_family_id}
                        </div>
                        <div className="text-[11px] text-slate-500">{row.original_family_name}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800" dir="ltr">
                        {row.extracted_profile} | {row.extracted_brand}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[11px] text-emerald-800 font-bold" dir="ltr">
                          {row.final_assigned_family}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500" dir="ltr">
                          {row.final_runtime_pfam_id}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">{row.mismatch_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: REJECTED & DUPLICATE IMAGES + MANUFACTURER SOURCES */}
      {activeTab === 'images' && (
        <section className="space-y-6">
          {/* Rejected Wrong Product Images */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>نمونه تصاویر ردشده به علت عدم تطابق محصول یا برند (rejected_images.csv)</span>
                </h2>
                <p className="text-xs text-slate-600">
                  شامل ۲۱ تصویر کاتالوگ <bdi dir="ltr" className="font-mono">e(...).png</bdi> (مربوط به پولی، قطعه تفلونی، براکت و دیافراگم) که در دیتابیس قبلی اشتباهاً به خانواده‌های تسمه متصل شده بودند + تصاویر دندانه دوطرفه روی خانواده‌های یک‌طرفه.
                </p>
              </div>
              <a
                href="/api/belt-audit/deliverables/rejected_images.csv?download=1"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود کامل rejected_images.csv ({toPersianDigits(imageAuditSummary.rejectedCandidateImagesCount)} مورد)</span>
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <th className="py-2.5 px-3 font-black">نوع موجودیت</th>
                    <th className="py-2.5 px-3 font-black">شناسه خانواده / تصویر</th>
                    <th className="py-2.5 px-3 font-black">آدرس تصویر ردشده</th>
                    <th className="py-2.5 px-3 font-black">کد وضعیت</th>
                    <th className="py-2.5 px-3 font-black">علت مهندسی رد تصویر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {data.sampleRejectedImages.map((row, idx) => (
                    <tr key={`${row.entity_id}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-[11px]" dir="ltr">
                        {row.entity_type}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900" dir="ltr">
                        {row.entity_id}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-xs" dir="ltr">
                        {row.candidate_url}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-mono text-[10px] font-bold">
                          {row.rejection_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{row.rejection_reason_fa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Manufacturer Sources */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              بانک منابع رسمی سازندگان بین‌المللی تسمه (<bdi dir="ltr" className="font-mono">manufacturer_sources.json</bdi>)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.manufacturerSources.map((m) => (
                <div key={m.brandCode} className="rounded-2xl border border-slate-200 p-4 space-y-2 bg-slate-50/60">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                      {m.brandCode}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{m.manufacturerName}</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-600 list-disc pr-4">
                    {m.verifiedSeriesInCatalog.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
export default BeltMasterAuditPage;
