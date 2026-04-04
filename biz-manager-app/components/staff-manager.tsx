"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { readApiResponse } from "@/lib/client-api";
import { DashboardTabs } from "@/components/dashboard-tabs";
import type { SystemRole } from "@/types/domain";

type StaffMember = {
  id: string;
  name: string;
  color: string;
  baseWage: number;
  targetWage: number;
  holidayWage: number;
  bonusWage: number;
  capacity: number;
  incentive: number;
  expectedSales: number;
  performanceBonus: number;
  mealAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  employmentType: "HOURLY" | "MONTHLY";
  monthlySalary: number;
  expectedMonthlyHours: number;
  insuranceType: "NONE" | "FREELANCER" | "FOUR_INSURANCE";
  insuranceRate: number;
  freelancerTaxRate: number;
  nationalPensionEmployeeRate: number;
  nationalPensionEmployerRate: number;
  healthInsuranceEmployeeRate: number;
  healthInsuranceEmployerRate: number;
  longTermCareEmployeeRate: number;
  longTermCareEmployerRate: number;
  employmentInsuranceEmployeeRate: number;
  employmentInsuranceEmployerRate: number;
  industrialAccidentEmployerRate: number;
};

type ScheduleSnapshot = {
  timeUnit: number;
  assignments: Record<string, Record<number, string[]>>;
} | null;

type StoreInfo = {
  storeName: string;
  ownerName: string;
  businessType: string;
};

type ContractDraft = {
  contractType: "FIXED" | "OPEN";
  startDate: string;
  endDate: string;
  workPlace: string;
  jobTitle: string;
  workDescription: string;
  payday: string;
  paymentMethod: string;
  employerAddress: string;
  employeeAddress: string;
  employeePhone: string;
  probationMonths: string;
  restRule: string;
  notes: string;
};

type StaffForm = Omit<StaffMember, "id" | "holidayWage" | "bonusWage" | "capacity" | "incentive">;
type EmploymentInsuranceScale = "UNDER_150" | "PRIORITY_SUPPORT" | "MID_SIZED" | "LARGE_PUBLIC";
type IndustrialAccidentPreset = "GENERAL_SERVICE" | "RETAIL" | "RESTAURANT_CAFE" | "MANUFACTURING" | "CUSTOM";

const WEEK = ["월", "화", "수", "목", "금", "토", "일"] as const;
const CAL = ["일", "월", "화", "수", "목", "금", "토"] as const;
const INSURANCE_REFERENCE = [
  {
    name: "국민연금",
    employee: "4.75%",
    employer: "4.75%",
    note: "기준소득월액 기준으로 계산됩니다. 2025년 7월~2026년 6월 기준 하한 40만원, 상한 637만원이 적용됩니다.",
  },
  {
    name: "건강보험",
    employee: "3.595%",
    employer: "3.595%",
    note: "직장가입자 보수월액 기준입니다. 실제 공제액은 보수와 정산 결과에 따라 달라질 수 있습니다.",
  },
  {
    name: "장기요양보험",
    employee: "건강보험료의 13.14% (약 0.472%)",
    employer: "건강보험료의 13.14% (약 0.472%)",
    note: "건강보험료에 곱해 계산합니다. 화면 입력은 임금 환산값(약 0.472%)으로 넣으면 계산이 편합니다.",
  },
  {
    name: "고용보험",
    employee: "0.90%",
    employer: "0.90% + 사업장 규모별 0.25~0.85%",
    note: "회사 부담 입력칸에는 실업급여 0.9%와 사업주 추가분을 합친 총 부담률을 넣는 것이 실무상 편합니다.",
  },
  {
    name: "산재보험",
    employee: "없음",
    employer: "업종별 상이",
    note: "근로자 부담은 없고 회사만 부담합니다. 음식점, 소매업, 제조업, 건설업 등 업종별 요율이 다릅니다.",
  },
] as const;

const EMPLOYMENT_INSURANCE_GUIDE = [
  { scope: "150인 미만", rate: "1.15%", note: "실업급여 0.9% + 사업주 추가 0.25%" },
  { scope: "150인 이상 우선지원", rate: "1.35%", note: "실업급여 0.9% + 사업주 추가 0.45%" },
  { scope: "150인 이상~1000인 미만", rate: "1.55%", note: "실업급여 0.9% + 사업주 추가 0.65%" },
  { scope: "1000인 이상/공공", rate: "1.75%", note: "실업급여 0.9% + 사업주 추가 0.85%" },
] as const;

const EMPLOYMENT_INSURANCE_RATE_MAP: Record<EmploymentInsuranceScale, { label: string; employerRate: number; note: string }> = {
  UNDER_150: { label: "150인 미만", employerRate: 1.15, note: "실업급여 0.9% + 사업주 추가 0.25%" },
  PRIORITY_SUPPORT: { label: "150인 이상 우선지원", employerRate: 1.35, note: "실업급여 0.9% + 사업주 추가 0.45%" },
  MID_SIZED: { label: "150인 이상~1000인 미만", employerRate: 1.55, note: "실업급여 0.9% + 사업주 추가 0.65%" },
  LARGE_PUBLIC: { label: "1000인 이상/공공", employerRate: 1.75, note: "실업급여 0.9% + 사업주 추가 0.85%" },
};

const INDUSTRIAL_ACCIDENT_RATE_MAP: Record<Exclude<IndustrialAccidentPreset, "CUSTOM">, { label: string; rate: number; note: string }> = {
  GENERAL_SERVICE: { label: "일반 사무/서비스", rate: 0.25, note: "사무직·일반 서비스업 기준으로 많이 쓰는 보수적 예시값입니다." },
  RETAIL: { label: "소매/판매", rate: 0.35, note: "매장 판매·소매업 기준 예시값입니다." },
  RESTAURANT_CAFE: { label: "음식점/카페", rate: 0.70, note: "외식업에서 비교적 자주 참고하는 예시값입니다." },
  MANUFACTURING: { label: "제조/생산", rate: 1.00, note: "제조·생산 현장 예시값입니다." },
};

export function StaffManager({
  initialStaff,
  role,
  schedule,
  storeInfo,
}: {
  initialStaff: StaffMember[];
  role: SystemRole;
  schedule: ScheduleSnapshot;
  storeInfo: StoreInfo;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [staff, setStaff] = useState(initialStaff);
  const [selectedStaffId, setSelectedStaffId] = useState(initialStaff[0]?.id ?? "");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [employmentInsuranceScale, setEmploymentInsuranceScale] = useState<EmploymentInsuranceScale>("UNDER_150");
  const [industrialAccidentPreset, setIndustrialAccidentPreset] = useState<IndustrialAccidentPreset>(() => inferIndustrialAccidentPreset(storeInfo.businessType));
  const [customIndustrialAccidentRate, setCustomIndustrialAccidentRate] = useState(0.7);
  const [form, setForm] = useState<StaffForm>({
    name: "",
    color: "#10b981",
    baseWage: 10030,
    targetWage: 12000,
    expectedSales: 100000,
    performanceBonus: 0,
    mealAllowance: 0,
    transportAllowance: 0,
    otherAllowance: 0,
    employmentType: "HOURLY",
    monthlySalary: 0,
    expectedMonthlyHours: 160,
    insuranceType: "NONE",
    insuranceRate: 0,
    freelancerTaxRate: 3.3,
    nationalPensionEmployeeRate: 0,
    nationalPensionEmployerRate: 0,
    healthInsuranceEmployeeRate: 0,
    healthInsuranceEmployerRate: 0,
    longTermCareEmployeeRate: 0,
    longTermCareEmployerRate: 0,
    employmentInsuranceEmployeeRate: 0,
    employmentInsuranceEmployerRate: 0,
    industrialAccidentEmployerRate: 0,
  });
  const [draft, setDraft] = useState<ContractDraft>(() => createDraft(initialStaff[0] ?? null, storeInfo));
  const normalizedForm = useMemo(
    () => normalizeStaffForm(form, employmentInsuranceScale, industrialAccidentPreset, customIndustrialAccidentRate),
    [customIndustrialAccidentRate, employmentInsuranceScale, form, industrialAccidentPreset],
  );

  useEffect(() => {
    if (staff.length > 0 && !staff.some((item) => item.id === selectedStaffId)) {
      setSelectedStaffId(staff[0].id);
    }
  }, [selectedStaffId, staff]);

  const selectedStaff = useMemo(
    () => staff.find((item) => item.id === selectedStaffId) ?? staff[0] ?? null,
    [selectedStaffId, staff],
  );

  const weeklyRows = useMemo(() => getWeeklyRows(schedule, selectedStaff), [schedule, selectedStaff]);

  const calendarLogs = useMemo(() => {
    if (!schedule || !selectedStaff) return {};
    const result: Record<string, { start: number; end: number; hours: number }> = {};
    const slots = Array.from({ length: (24 * 60) / schedule.timeUnit }, (_, index) => index * schedule.timeUnit);
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    for (let date = 1; date <= daysInMonth; date += 1) {
      const day = CAL[new Date(targetYear, targetMonth - 1, date).getDay()];
      const matched = slots.filter((slot) => schedule.assignments?.[day]?.[slot]?.includes(selectedStaff.id));
      if (matched.length) {
        const start = Math.min(...matched);
        const end = Math.max(...matched) + schedule.timeUnit;
        result[String(date)] = { start, end, hours: (end - start) / 60 };
      }
    }
    return result;
  }, [schedule, selectedStaff, targetMonth, targetYear]);

  const actualMonthHours = useMemo(
    () => Object.values(calendarLogs).reduce((sum, item) => sum + item.hours, 0),
    [calendarLogs],
  );

  const summary = useMemo(
    () => (selectedStaff ? getStaffSummary(selectedStaff, actualMonthHours || selectedStaff.expectedMonthlyHours) : null),
    [actualMonthHours, selectedStaff],
  );

  const averageFinalHourly = useMemo(() => {
    if (!staff.length) return 0;
    return Math.round(staff.reduce((sum, item) => sum + getDisplayedFinalHourly(item), 0) / staff.length);
  }, [staff]);

  const totalExpectedSales = useMemo(
    () => staff.reduce((sum, item) => sum + (item.expectedSales || item.capacity || 0), 0),
    [staff],
  );

  const storageKey = useMemo(
    () => (selectedStaff ? `labor-contract:${storeInfo.storeName}:${selectedStaff.id}` : ""),
    [selectedStaff, storeInfo.storeName],
  );

  useEffect(() => {
    if (!selectedStaff || !storageKey) return;
    const defaults = createDraft(selectedStaff, storeInfo);
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDraft(raw ? { ...defaults, ...(JSON.parse(raw) as Partial<ContractDraft>) } : defaults);
    } catch {
      setDraft(defaults);
    }
  }, [selectedStaff, storageKey, storeInfo]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {}
  }, [draft, storageKey]);

  const contractText = useMemo(() => {
    if (!selectedStaff || !summary) return "";
    return buildContractText(selectedStaff, summary, draft, storeInfo, weeklyRows, schedule?.timeUnit ?? null);
  }, [draft, schedule?.timeUnit, selectedStaff, storeInfo, summary, weeklyRows]);

  async function submit() {
    setError("");
    setNotice("");
    const nextForm = normalizedForm;
    startTransition(async () => {
      try {
        const response = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextForm),
        });
        const { data, message } = await readApiResponse<{ staff?: StaffMember; message?: string }>(response);

        if (!response.ok || !data?.staff) {
          setError(message ?? "직원 저장에 실패했습니다.");
          return;
        }

        setStaff((prev) => [data.staff!, ...prev]);
        setSelectedStaffId(data.staff.id);
        setNotice("직원 정보가 저장되었습니다.");
        setForm((prev) => ({
          ...prev,
          name: "",
          targetWage: prev.employmentType === "HOURLY" ? prev.targetWage : 12000,
          monthlySalary: 0,
          performanceBonus: 0,
          mealAllowance: 0,
          transportAllowance: 0,
          otherAllowance: 0,
        }));
      } catch {
        setError("직원 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  async function copyContract() {
    if (!contractText) return;
    try {
      await navigator.clipboard.writeText(contractText);
      setNotice("근로계약서 문구를 복사했습니다.");
    } catch {
      setNotice("복사에 실패했습니다. 인쇄 창에서 직접 복사해주세요.");
    }
  }

  function printContract() {
    if (!contractText || !selectedStaff) return;
    const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=1100");
    if (!popup) {
      setNotice("팝업이 차단되어 인쇄 창을 열지 못했습니다.");
      return;
    }
    popup.document.write(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /><title>${selectedStaff.name} 근로계약서</title><style>body{font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;margin:40px;color:#0f172a;line-height:1.7}pre{white-space:pre-wrap;font-size:14px}</style></head><body><h1>${selectedStaff.name} 근로계약서</h1><pre>${escapeHtml(contractText)}</pre></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <main style={page}>
      <div style={wrap}>
        <DashboardTabs current="/dashboard/staff" role={role} />

        <section style={hero}>
          <div>
            <div style={eyebrow}>Staff Workspace</div>
            <h1 style={title}>직원 등록 값 설명, 세금/보험 비율, 근로계약서를 같이 관리</h1>
            <p style={desc}>각 항목 밑에 무엇을 넣는 값인지 설명을 붙였고, 프리랜서 3.3%와 4대보험 세부 부담률도 따로 저장할 수 있게 바꿨습니다.</p>
          </div>
          <div style={box}>
            <div><strong>{storeInfo.storeName}</strong></div>
            <div style={muted}>대표자 {storeInfo.ownerName}</div>
            <div style={muted}>업종 {storeInfo.businessType || "일반 매장"}</div>
          </div>
        </section>

        <div style={metricGrid}>
          <Metric label="등록 직원 수" value={`${staff.length}명`} />
          <Metric label="평균 최종시급" value={`${averageFinalHourly.toLocaleString()}원`} />
          <Metric label="시간당 기대매출 합계" value={`${totalExpectedSales.toLocaleString()}원`} />
        </div>

        <div style={layout}>
          <section style={panelBox}>
            <div style={splitHeader}>
              <div>
                <h2 style={sectionTitle}>직원 등록</h2>
                <p style={helpText}>입력칸 이름 아래 설명만 남기고, 큰 가이드 대신 2026년 기준 4대보험 참고 요율과 적용 기준을 같이 보이도록 정리했습니다.</p>
              </div>
            </div>
            <div style={stack}>
              <div style={subtleBox}>
                <div style={guideHeader}>
                  <div>
                    <strong style={{ display: "block", marginBottom: 6 }}>2026년 4대보험 참고 요율</strong>
                    <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
                      아래 값은 직원 등록 시 바로 참고할 수 있는 실무용 기준입니다. 각 입력칸에는 직원 부담률과 회사 부담률을 따로 넣고, 사업장 규모나 업종에 따라 달라지는 항목은 매장 기준으로 조정하세요.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(applySuggestedInsuranceRates(form))}
                    style={secondaryButton}
                  >
                    소규모 매장 기본값 적용
                  </button>
                </div>
                <div style={insuranceGuideGrid}>
                  {INSURANCE_REFERENCE.map((item) => (
                    <div key={item.name} style={insuranceGuideCard}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{item.name}</div>
                      <div style={insuranceGuideLine}>
                        <span style={insuranceGuideLabel}>개인 부담</span>
                        <strong>{item.employee}</strong>
                      </div>
                      <div style={insuranceGuideLine}>
                        <span style={insuranceGuideLabel}>회사 부담</span>
                        <strong>{item.employer}</strong>
                      </div>
                      <div style={insuranceGuideNote}>{item.note}</div>
                    </div>
                  ))}
                </div>
                <div style={insuranceNotesWrap}>
                  <div style={insuranceNoteCard}>
                    <strong style={{ display: "block", marginBottom: 8 }}>소득에 따라 달라지는 부분</strong>
                    <div style={insuranceBullet}>국민연금은 기준소득월액 기준이라 월 보수가 하한 40만원보다 낮거나 상한 637만원보다 높으면 실제 체감 비율이 달라집니다.</div>
                    <div style={insuranceBullet}>건강보험과 장기요양보험은 보수월액 기준이라 급여 총액, 보수 정산, 육아휴직/입퇴사 여부에 따라 실제 공제액이 달라질 수 있습니다.</div>
                    <div style={insuranceBullet}>산재보험은 개인 소득보다 업종 분류 영향이 큽니다. 음식점, 소매업, 제조업, 건설업마다 요율이 다릅니다.</div>
                  </div>
                  <div style={insuranceNoteCard}>
                    <strong style={{ display: "block", marginBottom: 8 }}>고용보험 회사 부담 예시</strong>
                    {EMPLOYMENT_INSURANCE_GUIDE.map((item) => (
                      <div key={item.scope} style={employmentGuideRow}>
                        <span>{item.scope}</span>
                        <strong>{item.rate}</strong>
                        <span style={{ color: "#64748b" }}>{item.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={formGrid}>
                {renderBasicFields(form, normalizedForm, setForm)}
              </div>
              {form.insuranceType === "FREELANCER" ? (
                <div style={subtleBox}>
                  <FieldLabel title="프리랜서 원천징수율(자동 적용)" description="프리랜서는 기본적으로 3.3% 원천징수 기준으로 저장합니다.">
                    <StaticValue value={`${normalizedForm.freelancerTaxRate.toFixed(1)}%`} helper="원하면 다음 단계에서 별도 옵션으로 커스터마이즈할 수 있게 확장할 수 있습니다." />
                  </FieldLabel>
                </div>
              ) : null}
              {form.insuranceType === "FOUR_INSURANCE" ? (
                <div style={stack}>
                  <div style={subtleBox}>
                    <strong style={{ display: "block", marginBottom: 10 }}>4대보험 자동 계산</strong>
                    <div style={insuranceGrid}>
                      {renderInsuranceFields(
                        normalizedForm,
                        employmentInsuranceScale,
                        setEmploymentInsuranceScale,
                        industrialAccidentPreset,
                        setIndustrialAccidentPreset,
                        customIndustrialAccidentRate,
                        setCustomIndustrialAccidentRate,
                      )}
                    </div>
                  </div>
                  <div style={subtleBox}>
                    <div style={summaryRow}>
                      <span>근로자 공제 합계</span>
                      <strong>{getEmployeeInsuranceRate(normalizedForm).toFixed(2)}%</strong>
                    </div>
                    <div style={summaryRow}>
                      <span>회사 부담 합계</span>
                      <strong>{getEmployerInsuranceRate(normalizedForm).toFixed(2)}%</strong>
                    </div>
                  </div>
                </div>
              ) : null}
              <div style={subtleBox}>
                <div style={summaryRow}><span>주휴수당(시간당 환산)</span><strong>{getCalculatedHolidayWage(normalizedForm.baseWage).toLocaleString()}원</strong></div>
                <div style={summaryRow}><span>최종시급 보정분</span><strong>{getCalculatedBonusWage(normalizedForm.baseWage, normalizedForm.targetWage).toLocaleString()}원</strong></div>
                <div style={summaryRow}><span>설정된 보험/세금 방식</span><strong>{getInsuranceLabel(normalizedForm.insuranceType)}</strong></div>
                <div style={summaryRow}><span>월급 환산 시급</span><strong>{getFormSalaryHourly(normalizedForm).toLocaleString()}원</strong></div>
                <div style={summaryRow}><span>회사 기준 예상 실질 시급</span><strong>{getFormRealHourly(normalizedForm).toLocaleString()}원</strong></div>
              </div>
              {error ? <div style={errorText}>{error}</div> : null}
              {notice ? <div style={noticeText}>{notice}</div> : null}
              <button onClick={submit} disabled={pending || !form.name.trim()} style={primaryButton}>{pending ? "저장 중..." : "직원 저장"}</button>
            </div>
          </section>
          <div style={rightColumn}>
            <section style={panelBox}>
              <h2 style={sectionTitle}>직원 보상 구조</h2>
              <div style={chipRow}>
                {staff.map((item) => (
                  <button key={item.id} onClick={() => setSelectedStaffId(item.id)} style={{ ...chip, border: selectedStaffId === item.id ? "1px solid #10b981" : "1px solid #334155" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, display: "inline-block" }} />
                    {item.name}
                  </button>
                ))}
              </div>
              {!selectedStaff || !summary ? (
                <div style={muted}>직원을 선택하면 상세 항목이 표시됩니다.</div>
              ) : (
                <>
                  <div style={cardGrid}>
                    <Info label="최저시급" value={`${selectedStaff.baseWage.toLocaleString()}원`} />
                    <Info label="주휴수당" value={`${selectedStaff.holidayWage.toLocaleString()}원`} />
                    <Info label="상여" value={`${selectedStaff.bonusWage.toLocaleString()}원`} />
                    <Info label="최종시급" value={`${selectedStaff.targetWage.toLocaleString()}원`} />
                    <Info label="추가수당" value={`${summary.extraAllowance.toLocaleString()}원`} helper={`식비 ${selectedStaff.mealAllowance.toLocaleString()} / 교통비 ${selectedStaff.transportAllowance.toLocaleString()} / 기타 ${selectedStaff.otherAllowance.toLocaleString()}`} />
                    <Info label="성과급" value={`${selectedStaff.performanceBonus.toLocaleString()}원`} />
                    <Info label="보험 방식" value={getInsuranceLabel(selectedStaff.insuranceType)} helper={`회사 부담 합계 ${getEmployerInsuranceRate(selectedStaff).toFixed(2)}%`} />
                    <Info label="근로자 공제 합계" value={`${getEmployeeInsuranceRate(selectedStaff).toFixed(2)}%`} />
                    <Info label="월급 환산 시급" value={`${summary.salaryHourly.toLocaleString()}원`} />
                    <Info label="실질 시급" value={`${summary.realHourly.toLocaleString()}원`} helper="회사 부담 비용 포함" />
                    <Info label="월 총고용비" value={`${summary.employerMonthlyCost.toLocaleString()}원`} />
                    <Info label="예상 월 기대매출" value={`${summary.monthlyExpectedSales.toLocaleString()}원`} />
                  </div>
                  <div style={subtleBox}>
                    고용형태 {selectedStaff.employmentType === "MONTHLY" ? "월급제" : "시급제"} · 예상 월 근로시간 {selectedStaff.expectedMonthlyHours}시간 · 현재 선택 월 스케줄 기준 {actualMonthHours.toFixed(1)}시간
                  </div>
                </>
              )}
            </section>

            <section style={panelBox}>
              <div style={splitHeader}>
                <h2 style={sectionTitle}>직원 스케줄 달력</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={targetYear} onChange={(event) => setTargetYear(Number(event.target.value))} style={miniInput}>
                    {[2025, 2026, 2027].map((year) => <option key={year} value={year}>{year}년</option>)}
                  </select>
                  <select value={targetMonth} onChange={(event) => setTargetMonth(Number(event.target.value))} style={miniInput}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}
                  </select>
                </div>
              </div>
              {!selectedStaff ? (
                <div style={muted}>직원을 선택해주세요.</div>
              ) : !schedule ? (
                <div style={muted}>저장된 스케줄이 아직 없습니다.</div>
              ) : (
                <>
                  <div style={weekGrid}>
                    {weeklyRows.map((row) => (
                      <div key={row.day} style={subtleBox}>
                        <strong>{row.day}</strong>
                        <div style={muted}>{row.working ? `${formatTime(row.start)} - ${formatTime(row.end)} · ${row.hours.toFixed(1)}h` : "휴무"}</div>
                      </div>
                    ))}
                  </div>
                  <div style={calendarGrid}>
                    {CAL.map((day) => <div key={day} style={dayHead}>{day}</div>)}
                    {renderCalendar(targetYear, targetMonth, calendarLogs)}
                  </div>
                </>
              )}
            </section>

            <section style={panelBox}>
              <div style={splitHeader}>
                <h2 style={sectionTitle}>근로계약서</h2>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => selectedStaff && setDraft(createDraft(selectedStaff, storeInfo))} style={secondaryButton}>기본값 복구</button>
                  <button onClick={copyContract} style={secondaryButton}>복사</button>
                  <button onClick={printContract} style={primaryButton}>인쇄</button>
                </div>
              </div>
              {!selectedStaff || !summary ? (
                <div style={muted}>직원을 선택하면 계약서 초안을 자동으로 생성합니다.</div>
              ) : (
                <div style={contractLayout}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={formGrid}>
                      <TextInput value={draft.startDate} onChange={(value) => setDraft({ ...draft, startDate: value })} placeholder="계약 시작일" />
                      <TextInput value={draft.endDate} onChange={(value) => setDraft({ ...draft, endDate: value })} placeholder="계약 종료일" disabled={draft.contractType === "OPEN"} />
                      <select value={draft.contractType} onChange={(event) => setDraft({ ...draft, contractType: event.target.value as "FIXED" | "OPEN" })} style={input}>
                        <option value="FIXED">기간제 계약</option>
                        <option value="OPEN">기간의 정함 없음</option>
                      </select>
                      <TextInput value={draft.workPlace} onChange={(value) => setDraft({ ...draft, workPlace: value })} placeholder="근무장소" />
                      <TextInput value={draft.jobTitle} onChange={(value) => setDraft({ ...draft, jobTitle: value })} placeholder="직무" />
                      <TextInput value={draft.workDescription} onChange={(value) => setDraft({ ...draft, workDescription: value })} placeholder="업무내용" />
                      <TextInput value={draft.payday} onChange={(value) => setDraft({ ...draft, payday: value })} placeholder="임금지급일" />
                      <TextInput value={draft.paymentMethod} onChange={(value) => setDraft({ ...draft, paymentMethod: value })} placeholder="지급방법" />
                      <TextInput value={draft.employerAddress} onChange={(value) => setDraft({ ...draft, employerAddress: value })} placeholder="사업장 주소" />
                      <TextInput value={draft.employeeAddress} onChange={(value) => setDraft({ ...draft, employeeAddress: value })} placeholder="근로자 주소" />
                      <TextInput value={draft.employeePhone} onChange={(value) => setDraft({ ...draft, employeePhone: value })} placeholder="근로자 연락처" />
                      <TextInput value={draft.probationMonths} onChange={(value) => setDraft({ ...draft, probationMonths: value })} placeholder="수습기간(개월)" />
                    </div>
                    <textarea value={draft.restRule} onChange={(event) => setDraft({ ...draft, restRule: event.target.value })} placeholder="휴게시간과 휴무 규정" style={textArea} />
                    <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="기타 약정 또는 비고" style={{ ...textArea, minHeight: 120 }} />
                  </div>
                  <div style={previewBox}>
                    <div style={{ fontWeight: 700, marginBottom: 12 }}>{selectedStaff.name} 근로계약서 미리보기</div>
                    <div style={previewText}>{contractText}</div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function renderBasicFields(form: StaffForm, normalizedForm: StaffForm, setForm: (value: StaffForm) => void) {
  return (
    <>
      <FieldLabel title="직원 이름" description="계약서와 스케줄에 표시될 이름입니다.">
        <TextInput value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="예: 매니저 김민수" />
      </FieldLabel>
      <FieldLabel title="표시 색상" description="스케줄 표에서 이 직원을 구분하는 색입니다.">
        <TextInput value={form.color} onChange={(value) => setForm({ ...form, color: value })} placeholder="#10b981" />
      </FieldLabel>
      <FieldLabel title="급여 방식" description="시급제면 시급을 직접 넣고, 월급제면 월급 총액으로 자동 환산합니다.">
        <select value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value as "HOURLY" | "MONTHLY" })} style={input}>
          <option value="HOURLY">시급제</option>
          <option value="MONTHLY">월급제</option>
        </select>
      </FieldLabel>
      <FieldLabel title="최저시급 또는 기본시급" description="법정 최저시급 또는 실제 기본시급을 입력합니다.">
        <NumberInput value={form.baseWage} onChange={(value) => setForm({ ...form, baseWage: value })} placeholder="예: 10030" />
      </FieldLabel>
      <FieldLabel title="예상 월 근로시간" description="월급 환산과 월 총고용비 계산의 기준 시간입니다.">
        <NumberInput value={form.expectedMonthlyHours} onChange={(value) => setForm({ ...form, expectedMonthlyHours: value })} placeholder="예: 160" />
      </FieldLabel>
      {form.employmentType === "HOURLY" ? (
        <>
          <FieldLabel title="최종시급" description="주휴수당, 상여를 포함해 실제로 맞추고 싶은 최종 시급입니다.">
            <NumberInput value={form.targetWage} onChange={(value) => setForm({ ...form, targetWage: value })} placeholder="예: 12000" />
          </FieldLabel>
          <FieldLabel title="예상 월급(자동 계산)" description="시급제 기준으로 최종시급 x 예상 월 근로시간을 계산한 값입니다.">
            <StaticValue value={`${Math.round(normalizedForm.targetWage * normalizedForm.expectedMonthlyHours).toLocaleString()}원`} helper="월급제와 충돌하지 않도록 시급제일 때만 자동 계산으로 보여줍니다." />
          </FieldLabel>
        </>
      ) : (
        <>
          <FieldLabel title="월급 총액" description="월급제로 지급하는 총 세전 금액입니다.">
            <NumberInput value={form.monthlySalary} onChange={(value) => setForm({ ...form, monthlySalary: value })} placeholder="예: 2500000" />
          </FieldLabel>
          <FieldLabel title="월급 환산 시급(자동 계산)" description="월급 총액을 예상 월 근로시간으로 나눈 환산 시급입니다.">
            <StaticValue value={`${normalizedForm.targetWage.toLocaleString()}원`} helper="월급제에서는 최종시급이 이 값으로 자동 맞춰집니다." />
          </FieldLabel>
        </>
      )}
      <FieldLabel title="주휴수당(자동 계산)" description="기본시급의 20%를 시간당 주휴수당 환산값으로 보여줍니다.">
        <StaticValue value={`${getCalculatedHolidayWage(form.baseWage).toLocaleString()}원`} helper="기본시급을 바꾸면 자동으로 같이 바뀝니다." />
      </FieldLabel>
      <FieldLabel title="상여/보정분(자동 계산)" description="최종시급이 기본시급 + 주휴수당보다 높으면 차액을 자동 계산합니다.">
        <StaticValue value={`${getCalculatedBonusWage(normalizedForm.baseWage, normalizedForm.targetWage).toLocaleString()}원`} helper="직원 보상 구조의 상여 항목과 연결됩니다." />
      </FieldLabel>
      <FieldLabel title="시간당 기대매출" description="이 직원이 근무할 때 기대하는 시간당 매출 기여값입니다.">
        <NumberInput value={form.expectedSales} onChange={(value) => setForm({ ...form, expectedSales: value })} placeholder="예: 100000" />
      </FieldLabel>
      <FieldLabel title="성과급" description="월 단위 성과급이나 인센티브 금액입니다.">
        <NumberInput value={form.performanceBonus} onChange={(value) => setForm({ ...form, performanceBonus: value })} placeholder="예: 50000" />
      </FieldLabel>
      <FieldLabel title="식비" description="식대로 따로 지급하는 금액입니다.">
        <NumberInput value={form.mealAllowance} onChange={(value) => setForm({ ...form, mealAllowance: value })} placeholder="예: 100000" />
      </FieldLabel>
      <FieldLabel title="교통비" description="출퇴근 교통비 지원 금액입니다.">
        <NumberInput value={form.transportAllowance} onChange={(value) => setForm({ ...form, transportAllowance: value })} placeholder="예: 50000" />
      </FieldLabel>
      <FieldLabel title="기타수당" description="유니폼, 야간수당 등 별도 지급하는 금액입니다.">
        <NumberInput value={form.otherAllowance} onChange={(value) => setForm({ ...form, otherAllowance: value })} placeholder="예: 30000" />
      </FieldLabel>
      <FieldLabel title="보험/세금 방식" description="프리랜서인지, 4대보험인지, 해당 없음인지 선택합니다.">
        <select value={form.insuranceType} onChange={(event) => setForm({ ...form, insuranceType: event.target.value as StaffForm["insuranceType"] })} style={input}>
          <option value="NONE">보험 없음</option>
          <option value="FREELANCER">프리랜서 3.3%</option>
          <option value="FOUR_INSURANCE">4대보험</option>
        </select>
      </FieldLabel>
    </>
  );
}

function renderInsuranceFields(
  form: StaffForm,
  employmentInsuranceScale: EmploymentInsuranceScale,
  setEmploymentInsuranceScale: (value: EmploymentInsuranceScale) => void,
  industrialAccidentPreset: IndustrialAccidentPreset,
  setIndustrialAccidentPreset: (value: IndustrialAccidentPreset) => void,
  customIndustrialAccidentRate: number,
  setCustomIndustrialAccidentRate: (value: number) => void,
) {
  return (
    <>
      <FieldLabel title="사업장 규모" description="고용보험 회사 부담률 자동 계산에 사용됩니다.">
        <select value={employmentInsuranceScale} onChange={(event) => setEmploymentInsuranceScale(event.target.value as EmploymentInsuranceScale)} style={input}>
          {Object.entries(EMPLOYMENT_INSURANCE_RATE_MAP).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
      </FieldLabel>
      <FieldLabel title="산재보험 업종군" description="업종군에 따라 산재보험 회사 부담률을 자동으로 반영합니다.">
        <select value={industrialAccidentPreset} onChange={(event) => setIndustrialAccidentPreset(event.target.value as IndustrialAccidentPreset)} style={input}>
          <option value="GENERAL_SERVICE">일반 사무/서비스</option>
          <option value="RETAIL">소매/판매</option>
          <option value="RESTAURANT_CAFE">음식점/카페</option>
          <option value="MANUFACTURING">제조/생산</option>
          <option value="CUSTOM">직접 입력</option>
        </select>
      </FieldLabel>
      {industrialAccidentPreset === "CUSTOM" ? (
        <FieldLabel title="산재보험 직접 입력" description="사업장 고지서 기준 회사 부담 산재보험 요율을 직접 넣습니다.">
          <NumberInput value={customIndustrialAccidentRate} onChange={setCustomIndustrialAccidentRate} placeholder="예: 0.7" />
        </FieldLabel>
      ) : (
        <FieldLabel title="산재보험 자동 반영" description={INDUSTRIAL_ACCIDENT_RATE_MAP[industrialAccidentPreset].note}>
          <StaticValue value={`${form.industrialAccidentEmployerRate.toFixed(3)}%`} helper="산재보험은 근로자 부담 없이 회사만 부담합니다." />
        </FieldLabel>
      )}
      <FieldLabel title="국민연금 근로자 부담률" description="기준소득월액 기준으로 자동 반영됩니다.">
        <StaticValue value={`${form.nationalPensionEmployeeRate.toFixed(2)}%`} helper="직원 부담과 회사 부담이 동일합니다." />
      </FieldLabel>
      <FieldLabel title="국민연금 회사 부담률" description="기준소득월액 기준으로 자동 반영됩니다.">
        <StaticValue value={`${form.nationalPensionEmployerRate.toFixed(2)}%`} helper="국민연금 기준소득월액 상하한의 영향을 받습니다." />
      </FieldLabel>
      <FieldLabel title="건강보험 근로자 부담률" description="직장가입자 보수월액 기준으로 자동 반영됩니다.">
        <StaticValue value={`${form.healthInsuranceEmployeeRate.toFixed(3)}%`} helper="보수 정산 시 실제 공제액은 일부 달라질 수 있습니다." />
      </FieldLabel>
      <FieldLabel title="건강보험 회사 부담률" description="직장가입자 보수월액 기준으로 자동 반영됩니다.">
        <StaticValue value={`${form.healthInsuranceEmployerRate.toFixed(3)}%`} helper="직원 부담과 회사 부담이 동일합니다." />
      </FieldLabel>
      <FieldLabel title="장기요양 근로자 부담률" description="건강보험료의 13.14%를 임금 환산값으로 자동 반영합니다.">
        <StaticValue value={`${form.longTermCareEmployeeRate.toFixed(3)}%`} helper="건강보험료에 연동되어 함께 움직이는 항목입니다." />
      </FieldLabel>
      <FieldLabel title="장기요양 회사 부담률" description="건강보험료의 13.14%를 임금 환산값으로 자동 반영합니다.">
        <StaticValue value={`${form.longTermCareEmployerRate.toFixed(3)}%`} helper="직원 부담과 회사 부담이 동일합니다." />
      </FieldLabel>
      <FieldLabel title="고용보험 근로자 부담률" description="실업급여 기준 0.9%로 자동 반영됩니다.">
        <StaticValue value={`${form.employmentInsuranceEmployeeRate.toFixed(2)}%`} helper="근로자 부담은 회사 규모와 관계없이 동일합니다." />
      </FieldLabel>
      <FieldLabel title="고용보험 회사 부담률" description={EMPLOYMENT_INSURANCE_RATE_MAP[employmentInsuranceScale].note}>
        <StaticValue value={`${form.employmentInsuranceEmployerRate.toFixed(2)}%`} helper={`${EMPLOYMENT_INSURANCE_RATE_MAP[employmentInsuranceScale].label} 기준 자동 계산`} />
      </FieldLabel>
      <FieldLabel title="산재보험 회사 부담률" description="근로자 부담 없이 회사만 부담합니다.">
        <StaticValue value={`${form.industrialAccidentEmployerRate.toFixed(3)}%`} helper={industrialAccidentPreset === "CUSTOM" ? "직접 입력한 업종 요율입니다." : INDUSTRIAL_ACCIDENT_RATE_MAP[industrialAccidentPreset].note} />
      </FieldLabel>
    </>
  );
}

function getWeeklyRows(schedule: ScheduleSnapshot, member: StaffMember | null) {
  return WEEK.map((day) => {
    if (!schedule || !member) return { day, working: false, start: null, end: null, hours: 0 };
    const slots = Object.keys(schedule.assignments?.[day] ?? {})
      .map(Number)
      .sort((a, b) => a - b)
      .filter((slot) => schedule.assignments?.[day]?.[slot]?.includes(member.id));
    if (slots.length === 0) return { day, working: false, start: null, end: null, hours: 0 };
    const start = slots[0];
    const end = slots[slots.length - 1] + schedule.timeUnit;
    return { day, working: true, start, end, hours: (end - start) / 60 };
  });
}

function getDisplayedFinalHourly(member: Pick<StaffMember, "employmentType" | "monthlySalary" | "expectedMonthlyHours" | "targetWage">) {
  if (member.employmentType === "MONTHLY" && member.monthlySalary > 0 && member.expectedMonthlyHours > 0) {
    return Math.round(member.monthlySalary / member.expectedMonthlyHours);
  }
  return member.targetWage;
}

function inferIndustrialAccidentPreset(businessType: string) {
  const source = businessType.toLowerCase();
  if (source.includes("카페") || source.includes("식당") || source.includes("외식") || source.includes("음식")) return "RESTAURANT_CAFE" as const;
  if (source.includes("소매") || source.includes("도소매") || source.includes("판매") || source.includes("편의점")) return "RETAIL" as const;
  if (source.includes("제조") || source.includes("생산") || source.includes("공장")) return "MANUFACTURING" as const;
  return "GENERAL_SERVICE" as const;
}

function getIndustrialAccidentRate(preset: IndustrialAccidentPreset, customRate: number) {
  if (preset === "CUSTOM") return Number(customRate) || 0;
  return INDUSTRIAL_ACCIDENT_RATE_MAP[preset].rate;
}

function normalizeStaffForm(
  form: StaffForm,
  employmentInsuranceScale: EmploymentInsuranceScale,
  industrialAccidentPreset: IndustrialAccidentPreset,
  customIndustrialAccidentRate: number,
): StaffForm {
  const expectedMonthlyHours = Math.max(1, Number(form.expectedMonthlyHours) || 160);
  const targetWage =
    form.employmentType === "MONTHLY" && Number(form.monthlySalary) > 0
      ? Math.round(Number(form.monthlySalary) / expectedMonthlyHours)
      : Number(form.targetWage) || 0;

  if (form.insuranceType === "FOUR_INSURANCE") {
    const employmentInsuranceEmployerRate = EMPLOYMENT_INSURANCE_RATE_MAP[employmentInsuranceScale].employerRate;
    const industrialAccidentEmployerRate = getIndustrialAccidentRate(industrialAccidentPreset, customIndustrialAccidentRate);
    return {
      ...form,
      targetWage,
      monthlySalary: form.employmentType === "MONTHLY" ? Number(form.monthlySalary) || 0 : 0,
      expectedMonthlyHours,
      freelancerTaxRate: 3.3,
      nationalPensionEmployeeRate: 4.75,
      nationalPensionEmployerRate: 4.75,
      healthInsuranceEmployeeRate: 3.595,
      healthInsuranceEmployerRate: 3.595,
      longTermCareEmployeeRate: 0.472,
      longTermCareEmployerRate: 0.472,
      employmentInsuranceEmployeeRate: 0.9,
      employmentInsuranceEmployerRate,
      industrialAccidentEmployerRate,
      insuranceRate: Number((4.75 + 3.595 + 0.472 + employmentInsuranceEmployerRate + industrialAccidentEmployerRate).toFixed(3)),
    };
  }

  if (form.insuranceType === "FREELANCER") {
    return {
      ...form,
      targetWage,
      monthlySalary: form.employmentType === "MONTHLY" ? Number(form.monthlySalary) || 0 : 0,
      expectedMonthlyHours,
      freelancerTaxRate: 3.3,
      nationalPensionEmployeeRate: 0,
      nationalPensionEmployerRate: 0,
      healthInsuranceEmployeeRate: 0,
      healthInsuranceEmployerRate: 0,
      longTermCareEmployeeRate: 0,
      longTermCareEmployerRate: 0,
      employmentInsuranceEmployeeRate: 0,
      employmentInsuranceEmployerRate: 0,
      industrialAccidentEmployerRate: 0,
      insuranceRate: 0,
    };
  }

  return {
    ...form,
    targetWage,
    monthlySalary: form.employmentType === "MONTHLY" ? Number(form.monthlySalary) || 0 : 0,
    expectedMonthlyHours,
    freelancerTaxRate: 3.3,
    nationalPensionEmployeeRate: 0,
    nationalPensionEmployerRate: 0,
    healthInsuranceEmployeeRate: 0,
    healthInsuranceEmployerRate: 0,
    longTermCareEmployeeRate: 0,
    longTermCareEmployerRate: 0,
    employmentInsuranceEmployeeRate: 0,
    employmentInsuranceEmployerRate: 0,
    industrialAccidentEmployerRate: 0,
    insuranceRate: 0,
  };
}

function getEmployeeInsuranceRate(member: Pick<StaffMember, "insuranceType" | "freelancerTaxRate" | "nationalPensionEmployeeRate" | "healthInsuranceEmployeeRate" | "longTermCareEmployeeRate" | "employmentInsuranceEmployeeRate">) {
  if (member.insuranceType === "FREELANCER") return Number(member.freelancerTaxRate) || 0;
  if (member.insuranceType !== "FOUR_INSURANCE") return 0;
  return (
    Number(member.nationalPensionEmployeeRate) +
    Number(member.healthInsuranceEmployeeRate) +
    Number(member.longTermCareEmployeeRate) +
    Number(member.employmentInsuranceEmployeeRate)
  );
}

function getCalculatedHolidayWage(baseWage: number) {
  return Math.round((Number(baseWage) || 0) * 0.2);
}

function getCalculatedBonusWage(baseWage: number, targetWage: number) {
  const holidayWage = getCalculatedHolidayWage(baseWage);
  return Math.max(0, (Number(targetWage) || 0) - ((Number(baseWage) || 0) + holidayWage));
}

function applySuggestedInsuranceRates(form: StaffForm): StaffForm {
  return {
    ...form,
    insuranceType: "FOUR_INSURANCE",
  };
}

function getEmployerInsuranceRate(member: Pick<StaffMember, "insuranceType" | "nationalPensionEmployerRate" | "healthInsuranceEmployerRate" | "longTermCareEmployerRate" | "employmentInsuranceEmployerRate" | "industrialAccidentEmployerRate">) {
  if (member.insuranceType !== "FOUR_INSURANCE") return 0;
  return (
    Number(member.nationalPensionEmployerRate) +
    Number(member.healthInsuranceEmployerRate) +
    Number(member.longTermCareEmployerRate) +
    Number(member.employmentInsuranceEmployerRate) +
    Number(member.industrialAccidentEmployerRate)
  );
}

function getFormSalaryHourly(form: StaffForm) {
  return getDisplayedFinalHourly(form);
}

function getFormRealHourly(form: StaffForm) {
  const hours = form.expectedMonthlyHours || 160;
  const extra = form.mealAllowance + form.transportAllowance + form.otherAllowance + form.performanceBonus;
  const payroll = form.employmentType === "MONTHLY" && form.monthlySalary > 0 ? form.monthlySalary : form.targetWage * hours;
  const employerCost = Math.round((payroll + extra) * (1 + getEmployerInsuranceRate(form) / 100));
  return hours > 0 ? Math.round(employerCost / hours) : getDisplayedFinalHourly(form);
}

function getStaffSummary(member: StaffMember, hours: number) {
  const workingHours = hours > 0 ? hours : member.expectedMonthlyHours;
  const extraAllowance = member.mealAllowance + member.transportAllowance + member.otherAllowance;
  const basePay = member.employmentType === "MONTHLY" && member.monthlySalary > 0 ? member.monthlySalary : member.targetWage * workingHours;
  const salaryHourly = getDisplayedFinalHourly(member);
  const subtotal = basePay + extraAllowance + member.performanceBonus;
  const employerMonthlyCost = Math.round(subtotal * (1 + getEmployerInsuranceRate(member) / 100));
  const realHourly = workingHours > 0 ? Math.round(employerMonthlyCost / workingHours) : salaryHourly;
  const monthlyExpectedSales = Math.round((member.expectedSales || member.capacity || 0) * workingHours);
  return { extraAllowance, salaryHourly, realHourly, employerMonthlyCost, monthlyExpectedSales, workingHours };
}

function createDraft(member: StaffMember | null, storeInfo: StoreInfo): ContractDraft {
  const today = new Date();
  return {
    contractType: "FIXED",
    startDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
    endDate: `${today.getFullYear()}-${String(today.getMonth() + 6).padStart(2, "0")}-31`,
    workPlace: storeInfo.storeName,
    jobTitle: member?.employmentType === "MONTHLY" ? "매장 운영 담당" : "시간제 스태프",
    workDescription: `${storeInfo.businessType || "매장"} 운영, 고객 응대, 판매 보조`,
    payday: "매월 10일",
    paymentMethod: "계좌이체",
    employerAddress: "",
    employeeAddress: "",
    employeePhone: "",
    probationMonths: "0",
    restRule: "1일 근로시간이 4시간을 초과하면 30분, 8시간을 초과하면 1시간의 휴게시간을 부여합니다.",
    notes: "서명 전 임금, 근로시간, 휴게, 휴일, 사회보험 적용 여부를 최종 확인합니다.",
  };
}

function buildContractText(
  member: StaffMember,
  summary: ReturnType<typeof getStaffSummary>,
  draft: ContractDraft,
  storeInfo: StoreInfo,
  weeklyRows: Array<{ day: string; working: boolean; start: number | null; end: number | null; hours: number }>,
  timeUnit: number | null,
) {
  const weekly = weeklyRows.some((row) => row.working)
    ? weeklyRows.map((row) => (row.working ? `- ${row.day}: ${formatTime(row.start)} ~ ${formatTime(row.end)} (${row.hours.toFixed(1)}시간)` : `- ${row.day}: 휴무`)).join("\n")
    : "- 저장된 주간 스케줄이 없습니다.";

  const insuranceText = member.insuranceType === "FREELANCER"
    ? `프리랜서 원천징수 ${member.freelancerTaxRate.toFixed(2)}%`
    : member.insuranceType === "FOUR_INSURANCE"
      ? `국민연금 ${member.nationalPensionEmployeeRate.toFixed(2)} / ${member.nationalPensionEmployerRate.toFixed(2)}, 건강보험 ${member.healthInsuranceEmployeeRate.toFixed(2)} / ${member.healthInsuranceEmployerRate.toFixed(2)}, 장기요양 ${member.longTermCareEmployeeRate.toFixed(2)} / ${member.longTermCareEmployerRate.toFixed(2)}, 고용보험 ${member.employmentInsuranceEmployeeRate.toFixed(2)} / ${member.employmentInsuranceEmployerRate.toFixed(2)}, 산재보험 회사 ${member.industrialAccidentEmployerRate.toFixed(2)}`
      : "보험 없음";

  return [
    "근로계약서",
    "",
    `사업장명: ${storeInfo.storeName}`,
    `대표자: ${storeInfo.ownerName}`,
    `업종: ${storeInfo.businessType || "일반 매장"}`,
    `근로자: ${member.name}`,
    `계약기간: ${draft.contractType === "OPEN" ? `${formatDateText(draft.startDate)}부터 기간의 정함 없음` : `${formatDateText(draft.startDate)} ~ ${formatDateText(draft.endDate)}`}`,
    `근무장소: ${draft.workPlace}`,
    `직무: ${draft.jobTitle}`,
    `업무내용: ${draft.workDescription}`,
    "",
    `예상 월 근로시간: ${Math.round(summary.workingHours).toLocaleString()}시간`,
    `스케줄 배정 단위: ${timeUnit ? `${timeUnit}분` : "미설정"}`,
    weekly,
    `휴게 및 휴무 기준: ${draft.restRule}`,
    "",
    `기본시급: ${member.baseWage.toLocaleString()}원`,
    `주휴수당 환산: ${member.holidayWage.toLocaleString()}원`,
    `상여: ${member.bonusWage.toLocaleString()}원`,
    `최종시급: ${member.targetWage.toLocaleString()}원`,
    `월급 환산 시급: ${summary.salaryHourly.toLocaleString()}원`,
    `성과급: ${member.performanceBonus.toLocaleString()}원`,
    `추가수당 합계: ${summary.extraAllowance.toLocaleString()}원`,
    `보험/세금 정보: ${insuranceText}`,
    `회사 기준 실질 시급: ${summary.realHourly.toLocaleString()}원`,
    `예상 월 총고용비: ${summary.employerMonthlyCost.toLocaleString()}원`,
    `임금지급일: ${draft.payday}`,
    `지급방법: ${draft.paymentMethod}`,
    "",
    `시간당 기대매출: ${(member.expectedSales || member.capacity || 0).toLocaleString()}원`,
    `예상 월 기대매출: ${summary.monthlyExpectedSales.toLocaleString()}원`,
    "",
    draft.notes || "별도 약정 없음",
    "",
    `사용자 ${storeInfo.ownerName} ____________________`,
    `근로자 ${member.name} ____________________`,
  ].join("\n");
}

function renderCalendar(year: number, month: number, logs: Record<string, { start: number; end: number; hours: number }>) {
  const cells: ReactNode[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  for (let index = 0; index < firstDay; index += 1) cells.push(<div key={`empty-${index}`} style={{ minHeight: 84 }} />);
  for (let date = 1; date <= daysInMonth; date += 1) {
    const log = logs[String(date)];
    cells.push(
      <div key={date} style={calendarCell}>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{date}</div>
        {log ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{formatTime(log.start)}</div>
            <div style={{ fontSize: 12, color: "#34d399" }}>{formatTime(log.end)}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{log.hours.toFixed(1)}h</div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "#475569" }}>휴무</div>
        )}
      </div>,
    );
  }
  return cells;
}

function getInsuranceLabel(type: StaffMember["insuranceType"]) {
  if (type === "FREELANCER") return "프리랜서 3.3%";
  if (type === "FOUR_INSURANCE") return "4대보험";
  return "보험 없음";
}

function formatDateText(value: string) {
  if (!value) return "미정";
  const [year, month, day] = value.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatTime(value: number | null) {
  if (value === null) return "--:--";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={box}>
      <div style={{ color: "#94a3b8", marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 24 }}>{value}</div>
    </div>
  );
}

function Info({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div style={subtleBox}>
      <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
      {helper ? <div style={{ color: "#64748b", marginTop: 6, fontSize: 12 }}>{helper}</div> : null}
    </div>
  );
}

function FieldLabel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div style={fieldCard}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

function StaticValue({ value, helper }: { value: string; helper?: string }) {
  return (
    <div style={staticValueBox}>
      <strong style={{ fontSize: 18 }}>{value}</strong>
      {helper ? <div style={{ color: "#64748b", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{helper}</div> : null}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled }: { value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} style={{ ...input, opacity: disabled ? 0.55 : 1 }} />;
}

function NumberInput({ value, onChange, placeholder }: { value: number; onChange: (value: number) => void; placeholder: string }) {
  return <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} placeholder={placeholder} style={input} />;
}

const page = { minHeight: "100vh", background: "#020617", padding: 24 } as const;
const wrap = { maxWidth: 1380, margin: "0 auto", display: "grid", gap: 18 } as const;
const hero = { padding: 24, borderRadius: 24, background: "linear-gradient(180deg, #0f172a 0%, #0b1220 100%)", border: "1px solid #1e293b", display: "grid", gap: 20, gridTemplateColumns: "2fr 1fr" } as const;
const eyebrow = { color: "#34d399", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" } as const;
const title = { margin: "8px 0", fontSize: 34, lineHeight: 1.2 } as const;
const desc = { margin: 0, color: "#94a3b8", lineHeight: 1.7 } as const;
const muted = { color: "#94a3b8" } as const;
const layout = { display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)", alignItems: "start" } as const;
const metricGrid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" } as const;
const box = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" } as const;
const panelBox = { ...box, minWidth: 0, overflow: "hidden", boxSizing: "border-box" } as const;
const subtleBox = { padding: 14, borderRadius: 16, background: "#020617", border: "1px solid #1e293b" } as const;
const fieldCard = { padding: 14, borderRadius: 16, background: "#020617", border: "1px solid #1e293b" } as const;
const formGrid = { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } as const;
const insuranceGrid = { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } as const;
const cardGrid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 14 } as const;
const stack = { display: "grid", gap: 12 } as const;
const input = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", width: "100%", boxSizing: "border-box" } as const;
const staticValueBox = { ...input, display: "grid", alignItems: "center", minHeight: 74 } as const;
const miniInput = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" } as const;
const textArea = { ...input, resize: "vertical", minHeight: 92, width: "100%" } as const;
const chipRow = { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 } as const;
const chip = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, background: "#020617", color: "#e2e8f0" } as const;
const primaryButton = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" } as const;
const secondaryButton = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", fontWeight: 600, cursor: "pointer" } as const;
const sectionTitle = { margin: 0 } as const;
const splitHeader = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" } as const;
const guideHeader = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 14 } as const;
const helpText = { margin: "6px 0 0", color: "#94a3b8", lineHeight: 1.6 } as const;
const summaryRow = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" } as const;
const noticeText = { color: "#a7f3d0" } as const;
const insuranceGuideGrid = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 12 } as const;
const insuranceGuideCard = { padding: 12, borderRadius: 14, background: "#081121", border: "1px solid #22304a", display: "grid", gap: 8 } as const;
const insuranceGuideLine = { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" } as const;
const insuranceGuideLabel = { color: "#94a3b8", fontSize: 12 } as const;
const insuranceGuideNote = { color: "#94a3b8", fontSize: 12, lineHeight: 1.55 } as const;
const insuranceNotesWrap = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" } as const;
const insuranceNoteCard = { padding: 12, borderRadius: 14, background: "#081121", border: "1px solid #22304a" } as const;
const insuranceBullet = { color: "#cbd5e1", fontSize: 12, lineHeight: 1.65, marginTop: 6 } as const;
const employmentGuideRow = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", columnGap: 10, rowGap: 2, alignItems: "center", paddingTop: 8 } as const;
const weekGrid = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", marginBottom: 16 } as const;
const calendarGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 } as const;
const dayHead = { textAlign: "center", fontSize: 12, color: "#64748b", paddingBottom: 6 } as const;
const calendarCell = { minHeight: 84, padding: 10, borderRadius: 14, border: "1px solid #1e293b", background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between" } as const;
const contractLayout = { display: "grid", gap: 16, gridTemplateColumns: "minmax(320px, 460px) 1fr" } as const;
const previewBox = { padding: 16, borderRadius: 18, border: "1px solid #1e293b", background: "#020617" } as const;
const previewText = { whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 13, color: "#e2e8f0", fontFamily: "\"Malgun Gothic\", \"Apple SD Gothic Neo\", sans-serif" } as const;
const errorText = { color: "#fca5a5" } as const;
const rightColumn = { display: "grid", gap: 16, minWidth: 0 } as const;
