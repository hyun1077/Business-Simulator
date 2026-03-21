# Biz Manager App

여러 사람이 함께 로그인해서 사용하는 자영업자 운영 관리 프로그램의 시작점입니다.
현재는 `Next.js` 기반 MVP이며, 로컬 저장은 JSON 파일로 동작하게 해 두었습니다.

- GitHub에 올려 협업 가능한 구조
- 로그인/회원가입과 세션 쿠키 처리
- 로그인 아이디 규칙에 따라 기본 권한 자동 부여
- 매장별 직원, 매출/지출 저장
- 시간대별 효율 분석과 월 손익 분석

## 왜 이 구조로 잡았는가

기존 코드는 단일 React 컴포넌트라서 브라우저 메모리 안에서만 데이터가 움직입니다.
여러 명이 함께 쓰려면 다음 4가지가 반드시 필요합니다.

1. 서버
2. 서버 저장소
3. 인증과 권한
4. 저장 가능한 도메인 모델

이 프로젝트는 그 4가지를 바로 얹을 수 있게 최소한의 기반을 먼저 만들었습니다.

## 권한 자동 부여 방식

현재 MVP에서는 `loginId` 규칙으로 기본 역할을 자동 부여합니다.

- `admin`, `master`, `owner` 로 시작하면 `OWNER`
- `manager`, `mgr` 로 시작하면 `MANAGER`
- 그 외는 `STAFF`

예시:

- `owner_kevin`
- `manager_hall1`
- `staff_mina`

실서비스에서는 이 규칙을 유지하되, 아래 중 하나로 고도화하는 것을 권장합니다.

- 매장 초대 코드
- 승인 워크플로우
- 카카오/구글 로그인 + DB 역할 매핑

## 저장 방식

현재 로컬에서는 [data/app-data.json](/C:/Users/user/OneDrive/문서/New%20project/biz-manager-app/data/app-data.json)에 저장됩니다.
이 방식으로 당장 회원가입, 로그인, 직원 저장, 매출/지출 저장을 테스트할 수 있습니다.

정식 배포 단계에서는 Prisma + PostgreSQL 또는 Supabase로 바꾸는 것을 권장합니다.

## 데이터 모델

핵심 테이블은 아래와 같습니다.

- `User`: 로그인 계정
- `Store`: 매장
- `UserStoreRole`: 매장별 권한
- `StaffProfile`: 직원 급여/생산성 정보
- `WeeklySchedule`: 주간 스케줄
- `WorkLog`: 일별 출퇴근 로그와 급여 계산 결과
- `FinanceEntry`: 매출/지출 데이터

## 실행 방법

```bash
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run dev
```

브라우저에서 아래를 확인합니다.

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/dashboard/staff`
- `/dashboard/finance`

## GitHub 업로드

```bash
git init
git add .
git commit -m "feat: bootstrap biz manager app"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 다음 단계 추천

1. 기존에 보내주신 큰 스케줄 컴포넌트를 `components/wage-scheduler.tsx`에 완전히 이식
2. 스케줄 저장 API와 월 마감 API 연결
3. 직원 수정/삭제와 권한별 UI 제한 강화
4. 실제 차트 라이브러리 적용
5. 배포 환경을 `Vercel + Prisma Postgres` 또는 `Railway + Supabase`로 전환
