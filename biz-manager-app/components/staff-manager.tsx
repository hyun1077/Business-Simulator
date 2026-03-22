"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
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

const WEEK = ["월", "화", "수", "목", "금", "토", "일"] as const;
const CAL = ["일", "월", "화", "수", "목", "금", "토"] as const;

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
  const [form, setForm] = useState({
    name: "",
    color: "#10b981",
    baseWage: 10030,
    targetWage: 12000,
    expectedSales: 100000,
    performanceBonus: 0,
    mealAllowance: 0,
    transportAllowance: 0,
    otherAllowance: 0,
    employmentType: "HOURLY" as "HOURLY" | "MONTHLY",
    monthlySalary: 0,
    expectedMonthlyHours: 160,
    insuranceType: "NONE" as "NONE" | "FREELANCER" | "FOUR_INSURANCE",
    insuranceRate: 0,
  });
  const [draft, setDraft] = useState<ContractDraft>(() => createDraft(initialStaff[0] ?? null, storeInfo));

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
    startTransition(async () => {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? "직원 저장에 실패했습니다.");
        return;
      }

      setStaff((prev) => [result.staff, ...prev]);
      setSelectedStaffId(result.staff.id);
      setForm({
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
      });
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
            <h1 style={title}>직원 비용 구조, 근무 달력, 근로계약서를 한 화면에서 관리</h1>
            <p style={desc}>최저시급, 주휴수당, 상여, 추가수당, 성과급, 보험 부담률, 월급 환산 시급까지 한 번에 확인할 수 있습니다.</p>
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
          <section style={box}>
            <h2 style={sectionTitle}>직원 등록</h2>
            <div style={formGrid}>
              <TextInput value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="직원 이름" />
              <TextInput value={form.color} onChange={(value) => setForm({ ...form, color: value })} placeholder="#10b981" />
              <NumberInput value={form.baseWage} onChange={(value) => setForm({ ...form, baseWage: value })} placeholder="최저시급 또는 기본시급" />
              <NumberInput value={form.targetWage} onChange={(value) => setForm({ ...form, targetWage: value })} placeholder="최종시급" />
              <NumberInput value={form.expectedSales} onChange={(value) => setForm({ ...form, expectedSales: value })} placeholder="시간당 기대매출" />
              <NumberInput value={form.performanceBonus} onChange={(value) => setForm({ ...form, performanceBonus: value })} placeholder="성과급" />
              <NumberInput value={form.mealAllowance} onChange={(value) => setForm({ ...form, mealAllowance: value })} placeholder="식비" />
              <NumberInput value={form.transportAllowance} onChange={(value) => setForm({ ...form, transportAllowance: value })} placeholder="교통비" />
              <NumberInput value={form.otherAllowance} onChange={(value) => setForm({ ...form, otherAllowance: value })} placeholder="기타수당" />
              <select value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value as "HOURLY" | "MONTHLY" })} style={input}>
                <option value="HOURLY">시급제</option>
                <option value="MONTHLY">월급제</option>
              </select>
              <NumberInput value={form.monthlySalary} onChange={(value) => setForm({ ...form, monthlySalary: value })} placeholder="월급 총액" />
              <NumberInput value={form.expectedMonthlyHours} onChange={(value) => setForm({ ...form, expectedMonthlyHours: value })} placeholder="예상 월 근로시간" />
              <select value={form.insuranceType} onChange={(event) => setForm({ ...form, insuranceType: event.target.value as "NONE" | "FREELANCER" | "FOUR_INSURANCE" })} style={input}>
                <option value="NONE">보험 없음</option>
                <option value="FREELANCER">프리랜서 3.3%</option>
                <option value="FOUR_INSURANCE">4대보험</option>
              </select>
              <NumberInput value={form.insuranceRate} onChange={(value) => setForm({ ...form, insuranceRate: value })} placeholder="회사 부담률(%)" />
            </div>
            {error ? <div style={errorText}>{error}</div> : null}
            <button onClick={submit} disabled={pending} style={primaryButton}>{pending ? "저장 중..." : "직원 저장"}</button>
          </section>

          <div style={{ display: "grid", gap: 16 }}>
            <section style={box}>
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
                    <Info label="보험 방식" value={getInsuranceLabel(selectedStaff.insuranceType)} helper={`회사 부담률 ${selectedStaff.insuranceRate.toFixed(1)}%`} />
                    <Info label="월급 환산 시급" value={`${summary.salaryHourly.toLocaleString()}원`} />
                    <Info label="실질 시급" value={`${summary.realHourly.toLocaleString()}원`} helper="회사 부담 비용 포함" />
                    <Info label="월 총고용비" value={`${summary.employerMonthlyCost.toLocaleString()}원`} />
                    <Info label="시간당 기대매출" value={`${selectedStaff.expectedSales.toLocaleString()}원`} />
                    <Info label="예상 월 기대매출" value={`${summary.monthlyExpectedSales.toLocaleString()}원`} />
                  </div>
                  <div style={subtleBox}>
                    고용형태 {selectedStaff.employmentType === "MONTHLY" ? "월급제" : "시급제"} · 예상 월 근로시간 {selectedStaff.expectedMonthlyHours}시간 · 현재 선택 월 스케줄 기준 {actualMonthHours.toFixed(1)}시간
                  </div>
                </>
              )}
            </section>
            <section style={box}>
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

            <section style={box}>
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
                      <select value={draft.contractType} onChange={(event) => setDraft({ ...draft, contractType: event.target.value as "FIXED" | "OPEN" })} style={input}>
                        <option value="FIXED">기간제 계약</option>
                        <option value="OPEN">기간의 정함 없음</option>
                      </select>
                      <TextInput value={draft.startDate} onChange={(value) => setDraft({ ...draft, startDate: value })} placeholder="계약 시작일" />
                      <TextInput value={draft.endDate} onChange={(value) => setDraft({ ...draft, endDate: value })} placeholder="계약 종료일" disabled={draft.contractType === "OPEN"} />
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
                    <div style={{ color: notice ? "#a7f3d0" : "#64748b" }}>{notice || "직원 정보와 저장된 스케줄을 기준으로 계약서 초안을 자동 계산합니다."}</div>
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

function getDisplayedFinalHourly(member: StaffMember) {
  if (member.employmentType === "MONTHLY" && member.monthlySalary > 0 && member.expectedMonthlyHours > 0) {
    return Math.round(member.monthlySalary / member.expectedMonthlyHours);
  }
  return member.targetWage;
}

function getStaffSummary(member: StaffMember, hours: number) {
  const workingHours = hours > 0 ? hours : member.expectedMonthlyHours;
  const extraAllowance = member.mealAllowance + member.transportAllowance + member.otherAllowance;
  const basePay = member.employmentType === "MONTHLY" && member.monthlySalary > 0 ? member.monthlySalary : member.targetWage * workingHours;
  const salaryHourly = member.monthlySalary > 0 && member.expectedMonthlyHours > 0 ? Math.round(member.monthlySalary / member.expectedMonthlyHours) : member.targetWage;
  const subtotal = basePay + extraAllowance + member.performanceBonus;
  const employerMonthlyCost = Math.round(subtotal * (1 + member.insuranceRate / 100));
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
  const contractPeriod = draft.contractType === "OPEN"
    ? `${formatDateText(draft.startDate)}부터 기간의 정함 없음`
    : `${formatDateText(draft.startDate)} ~ ${formatDateText(draft.endDate)}`;

  return [
    "근로계약서",
    "",
    "1. 사업장 및 계약당사자",
    `- 사업장명: ${storeInfo.storeName}`,
    `- 대표자: ${storeInfo.ownerName}`,
    `- 업종: ${storeInfo.businessType || "일반 매장"}`,
    `- 사업장 주소: ${draft.employerAddress || "미입력"}`,
    `- 근로자 성명: ${member.name}`,
    `- 근로자 연락처: ${draft.employeePhone || "미입력"}`,
    `- 근로자 주소: ${draft.employeeAddress || "미입력"}`,
    "",
    "2. 계약기간 및 업무",
    `- 계약 형태: ${draft.contractType === "OPEN" ? "기간의 정함 없음" : "기간제"}`,
    `- 계약 기간: ${contractPeriod}`,
    `- 근무장소: ${draft.workPlace || storeInfo.storeName}`,
    `- 직무: ${draft.jobTitle || "매장 업무"}`,
    `- 업무내용: ${draft.workDescription || "매장 운영 보조"}`,
    `- 수습기간: ${draft.probationMonths || "0"}개월`,
    "",
    "3. 근로시간 및 휴게",
    `- 예상 월 근로시간: ${Math.round(summary.workingHours).toLocaleString()}시간`,
    `- 스케줄 배정 단위: ${timeUnit ? `${timeUnit}분` : "미설정"}`,
    weekly,
    `- 휴게 및 휴무 기준: ${draft.restRule}`,
    "",
    "4. 임금 및 부가비용",
    `- 최저시급 또는 기본시급: ${member.baseWage.toLocaleString()}원`,
    `- 주휴수당: ${member.holidayWage.toLocaleString()}원`,
    `- 상여: ${member.bonusWage.toLocaleString()}원`,
    `- 최종시급: ${member.targetWage.toLocaleString()}원`,
    `- 월급 환산 시급: ${summary.salaryHourly.toLocaleString()}원`,
    `- 추가수당 합계: ${summary.extraAllowance.toLocaleString()}원`,
    `  · 식비 ${member.mealAllowance.toLocaleString()}원 / 교통비 ${member.transportAllowance.toLocaleString()}원 / 기타 ${member.otherAllowance.toLocaleString()}원`,
    `- 성과급: ${member.performanceBonus.toLocaleString()}원`,
    `- 보험 방식: ${getInsuranceLabel(member.insuranceType)}`,
    `- 회사 부담률: ${member.insuranceRate.toFixed(1)}%`,
    `- 회사 기준 실질 시급: ${summary.realHourly.toLocaleString()}원`,
    `- 예상 월 총고용비: ${summary.employerMonthlyCost.toLocaleString()}원`,
    `- 임금지급일: ${draft.payday}`,
    `- 지급방법: ${draft.paymentMethod}`,
    "",
    "5. 기대매출 참고치",
    `- 시간당 기대매출: ${(member.expectedSales || member.capacity || 0).toLocaleString()}원`,
    `- 예상 월 기대매출: ${summary.monthlyExpectedSales.toLocaleString()}원`,
    `- 월 기대매출 대비 총고용비 차감 후 잔여: ${(summary.monthlyExpectedSales - summary.employerMonthlyCost).toLocaleString()}원`,
    "",
    "6. 기타 약정",
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

  for (let index = 0; index < firstDay; index += 1) {
    cells.push(<div key={`empty-${index}`} style={{ minHeight: 84 }} />);
  }

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
const layout = { display: "grid", gap: 16, gridTemplateColumns: "420px 1fr", alignItems: "start" } as const;
const metricGrid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" } as const;
const box = { padding: 20, borderRadius: 20, background: "#0f172a", border: "1px solid #1e293b" } as const;
const subtleBox = { padding: 14, borderRadius: 16, background: "#020617", border: "1px solid #1e293b" } as const;
const formGrid = { display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" } as const;
const cardGrid = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", marginBottom: 14 } as const;
const input = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px" } as const;
const miniInput = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 10, padding: "8px 10px" } as const;
const textArea = { ...input, resize: "vertical", minHeight: 92, width: "100%" } as const;
const chipRow = { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 } as const;
const chip = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 999, background: "#020617", color: "#e2e8f0" } as const;
const primaryButton = { background: "#10b981", color: "#052e16", border: "none", borderRadius: 12, padding: "12px 14px", fontWeight: 700, cursor: "pointer" } as const;
const secondaryButton = { background: "#020617", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 12, padding: "12px 14px", fontWeight: 600, cursor: "pointer" } as const;
const sectionTitle = { margin: "0 0 14px" } as const;
const splitHeader = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" } as const;
const weekGrid = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", marginBottom: 16 } as const;
const calendarGrid = { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 } as const;
const dayHead = { textAlign: "center", fontSize: 12, color: "#64748b", paddingBottom: 6 } as const;
const calendarCell = { minHeight: 84, padding: 10, borderRadius: 14, border: "1px solid #1e293b", background: "#020617", display: "flex", flexDirection: "column", justifyContent: "space-between" } as const;
const contractLayout = { display: "grid", gap: 16, gridTemplateColumns: "minmax(320px, 460px) 1fr" } as const;
const previewBox = { padding: 16, borderRadius: 18, border: "1px solid #1e293b", background: "#020617" } as const;
const previewText = { whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 13, color: "#e2e8f0", fontFamily: "\"Malgun Gothic\", \"Apple SD Gothic Neo\", sans-serif" } as const;
const errorText = { color: "#fca5a5", margin: "10px 0 0" } as const;
