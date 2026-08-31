# 결(Gyeol) 아키텍처 — 현재 상태와 이행 계획

이 문서는 "코드를 신 버전으로 갈아엎는다"는 결정을 실행 가능한 순서로 옮긴 것이다.
방식은 **점진 이행**이다. 파일럿 매장이 실제로 영업 중이므로, 어느 단계에서 멈추더라도
서비스가 돌아가는 상태를 유지한다.

## 현재 상태 (2026-08 실측)

| 항목 | 값 |
|---|---|
| 코드 | 약 40,000줄 — `src/` 37,199 + `server/` 2,880 |
| 파일 | 160개 (Phase 1 분해 후) |
| 서버 | Express 라우트 39개 + cron 1개, Router 13개 모듈 |
| 스택 | React 19 · Vite 7 · Express 5 · Firebase(Firestore + Auth) · Tailwind 4 |
| 배포 | Render 2개 서비스 (정적 SPA + API) |
| 외부 연동 | 토스플레이스 POS · 토스페이먼츠 · 푸드테크 POS · Gemini · Zernio · 카카오 · 네이버 · Electron 영수증 브릿지 |

### 구조상 아픈 곳

1. ~~**모놀리식 3개**~~ — Phase 1 에서 해소했다.
2. **전역 구독 범위** — 뮤테이션은 도메인별로 나뉘었지만, Firestore 구독은 여전히
   로그인 시점에 컬렉션 전체를 건다. 화면이 필요한 만큼만 구독하도록 좁히는 건 Phase 2 과제다.
3. ~~**공개 매장 페이지가 SPA**~~ — Phase 2-1 에서 서버 렌더 버전(`apps/site`)을 만들었다.
   배포 전환은 아직 남아 있다.
4. **배포가 둘로 갈라짐** — 정적 사이트와 API 가 별개 서비스라 환경변수·CORS·도메인이 이중 관리된다.
5. **타입 안전망이 꺼져 있었음** — `strict` 미설정. Phase 0 에서 해소했다.

## 목표 아키텍처

**Next.js App Router 로 수렴한다. Firebase(Firestore + Auth)는 그대로 둔다.**

왜 Next.js 인가:

- **공개 매장 페이지 SSR** — `/site/:storeId` 가 서버 렌더되어 검색에 노출된다.
  지금 구조로는 해결할 수 없는 문제이고, 매장 유치와 직결된다.
- **배포 단일화** — 정적 사이트 + Express 2개 서비스가 하나로 합쳐진다.
  Route Handler 가 현재 Express 라우트 40개를 그대로 받는다.
- **서버 경계가 언어 차원에서 강제됨** — 토스 시크릿·Admin SDK 자격증명이
  클라이언트 번들로 새는 실수를 구조가 막아 준다.

왜 Firebase 는 유지하는가:

- 이 앱은 **실시간이 본질**이다. 주문·테이블·주방 화면이 전부 `onSnapshot` 기반이다.
  Firestore 의 실시간 구독을 직접 대체하려면 별도 실시간 계층을 새로 만들어야 하고,
  그건 이번 재작성의 목적이 아니다.
- 로그인 뒤 화면은 SSR 이득이 거의 없다. 그대로 클라이언트 컴포넌트로 남는다.

## 이행 로드맵

각 단계는 **독립적으로 배포 가능**하고, 다음 단계로 넘어가지 않아도 그 자체로 개선이다.

### Phase 0 — 안전망 (완료)

재작성의 전제 조건. 테스트가 0건인 상태에서 39,000줄을 건드리면
무엇이 언제 깨졌는지 아무도 모른다.

- [x] Vitest 도입 (`vitest.config.ts`, `npm test`)
- [x] 핵심 도메인 규칙 테스트 78건 — 등급·RFM(`tier`), 직원 권한(`staffAccess`),
      영업시간(`businessHours`), 테이블 상태(`tableFlow`), 전화번호 정규화(`ids`)
- [x] CI 에 타입체크·테스트 단계 추가 (기존 CI 는 빌드만 했고 타입조차 검사하지 않았다 —
      `vite build` 는 타입을 보지 않으므로 타입 오류가 그대로 배포될 수 있었다)
- [x] 변이 테스트로 그물 검증 — 권한 정규화를 제거하면 4건, 전화번호 정규화를 되돌리면 3건이 실패한다
- [x] **`strict: true` 활성화** — 이 저장소는 `strict` 설정 자체가 없어 `strictNullChecks` 가
      꺼진 상태였다. 그러면 판별 유니온 좁히기와 null 검사가 무력화돼 타입이 사실상 장식이 된다.
      위반이 7건뿐이라(server.ts 암묵적 any 3 + 신규 테스트 4) 재작성 착수 전에 정리하고 켰다.
      `runMarketingAutomation(db: any)` → `admin.firestore.Firestore` 로 정정.

### Phase 1 — 모놀리식 분해 (완료)

스택은 그대로 두고 구조만 정리한다. 이 단계를 건너뛰고 Next.js 로 옮기면
2,547줄짜리 스토어를 그대로 이사시키는 꼴이 된다.

- [x] **`server.ts` 2,962 → 47줄** — `server/app.ts`(앱·미들웨어), `server/lib/*`(firebase·http·
      lang·parsers·push·reservation·storeAuth), `server/routes/*`(Router 13개), `server/static.ts`.
      경로 문자열은 한 글자도 바꾸지 않았다. 분해 전후 번들을 동시에 띄워 42개 경로에
      같은 요청을 보내고 응답이 완전히 일치함을 확인했다.
- [x] **`store/store.tsx` 2,547 → 288줄** — `store/core.ts`(상태·ref), `store/subscriptions.ts`
      (Firestore 구독), `store/actions/*`(도메인 훅 11개), `store/types.ts`, `store/constants.ts`.
      Provider 가 노출하는 context 키 90개를 테스트로 고정한 뒤 분해했다.
- [x] **`lib/i18n.ts` 2,105 → 158줄** — 인라인 한국어 사전을 `i18n-dicts/ko.ts` 로 분리.
      엔진만 남았다.
- [x] **1,000줄 넘던 화면 5개 분해** — Tables · customer/Dashboard · BrandSettings ·
      Reservations · MarketingAgent 를 페이지 본체와 부품 컴포넌트로 나눴다.
- [x] 분해할 때마다 해당 모듈의 테스트를 함께 남겼다 (경로 표 · 스토어 계약 · 사전 정합성).

**완료 기준 달성:** 코드 파일 중 1,000줄 초과 0개.
`i18n-dicts/*.ts` 네 개만 1,890줄 안팎으로 남았는데, 이건 키 한 줄짜리 데이터라 대상이 아니다.

분해하며 드러난 실제 결함 두 가지도 함께 고쳤다.

- 한국어에만 있고 en/vi/zh 에 없던 번역 키 3건. `t()` 는 키가 없으면 조용히 한국어로
  폴백하므로 이런 누락은 에러로 드러나지 않는다. 이제 사전 정합성 테스트가 막는다.
- `Reservations.tsx` 가 `lib/date.ts` 의 `localTodayStr` 과 동일한 함수를 따로 갖고 있던 중복.

**Phase 1 에서 하지 않은 것:** Firestore 구독 범위 좁히기.
현재는 여전히 로그인 시점에 컬렉션 전체를 구독한다. 화면 단위로 좁히려면 구독 주체를
Provider 에서 화면으로 옮겨야 하는데, 그건 Next.js 이전 때 서버 컴포넌트 경계와 함께
정하는 편이 낫다. Phase 2 로 넘긴다.

### Phase 2 — Next.js 이전 (진행 중)

라우트 단위로 옮긴다. 이전이 끝난 라우트부터 새 배포로 보내고,
나머지는 기존 SPA 가 계속 서빙한다.

- [x] **1. 공개 라우트(`/site/:storeId`) 이전** — `apps/site` (Next.js App Router).
      서버 렌더로 매장명·메뉴·리뷰가 HTML 에 박혀 나가고, canonical·hreflang 4종·
      OG·JSON-LD(Restaurant)가 붙는다. `apps/site/scripts/verify-ssr.mjs` 가
      가짜 API 를 띄워 24개 항목을 실제로 검사한다.
      **아직 운영 트래픽을 받지 않는다** — 배포·도메인 전환은 별도 결정.
- [ ] 2. Express 라우트 39개를 Route Handler 로 이관 (Electron 브릿지가 쓰는 엔드포인트는 경로 유지)
- [ ] 3. 인증·손님 화면 이전
- [ ] 4. 사장님·직원 화면 이전
- [ ] 5. 구 SPA 제거, Render 2개 서비스를 하나로 축소

**완료 기준:** `/site/:storeId` 가 검색에 노출된다. 배포 대상이 하나다.

#### 정해진 것: 다국어는 URL 세그먼트로

`/{ko,en,vi,zh}/site/:storeId`. 서버는 localStorage 를 볼 수 없고, 무엇보다
검색엔진이 언어별 페이지를 각각 색인하려면 URL 이 갈라져 있어야 한다
(베트남·중국 손님 유입까지 노리는 게 SSR 로 옮기는 이유의 절반이다).
기존 `/site/:id` 링크와 매장이 이미 배포한 QR 은 Accept-Language 를 보고 308 로 넘긴다.

#### 남은 위험: 화면이 두 벌

전환 전까지 매장 사이트가 SPA(`src/pages/StoreSite.tsx`)와 Next(`apps/site`) 두 곳에 있다.
오래 방치하면 반드시 어긋난다. 전환하거나, 전환하지 않기로 했다면 `apps/site` 를 지우는 게 낫다.
절차는 `apps/site/README.md`.

### Phase 3 — 정리

- Firestore 보안 규칙을 Custom Token 기반으로 재설계
  (현재는 익명 토큰 + 앱 자체 ID 라 규칙이 매장 간 격리를 강제하지 못한다 —
  `firestore.rules` 주석에 전환 절차가 이미 설계되어 있다)
- 접근성·성능 예산 도입

## 이번 재작성에서 하지 않는 것

- **Firebase 교체** — 위에 쓴 이유로 유지한다.
- **기능 추가** — 재작성 중에 기능을 얹으면 회귀의 원인을 구분할 수 없게 된다.
- **UI 전면 재디자인** — 구조 이행과 시각 개편을 동시에 하면 둘 다 검증이 안 된다.
  필요하면 Phase 2 완료 후 별도로 다룬다.
