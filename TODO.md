# 할일 목록 (가게 방문 피드백 반영)

> 작성일: 2026-06-04 — 오늘 가게 방문 후 추가된 항목
> 한 번에 다 할 필요 없음. 우선순위 적당히 잡고 순차 진행.

## 1. 예약 고객 손님맞이 듀얼 화면 (큰 화면 송출용) ✅ 1차 완료
- 사장님/직원이 **예약 탭**에서 설정해둔 예약 고객 정보를, 손님 입장 시 **별도 창(듀얼 모니터/큰 화면)** 으로 띄울 수 있도록 한다.
- "환영합니다, OOO 고객님" 같은 큰 화면용 뷰가 필요 (이름·인원·예약시간 등).
- 새 창(window.open) 또는 별도 라우트(`/welcome-display` 등)로 열어 외부 모니터에 전체화면 송출 가능해야 함.

## 2. 메뉴 리뷰 → 리뷰 저장소 개편 ✅ 완료
- **결제 요청** 버튼 누를 때 손님에게:
  - 사진 첨부
  - 별점
  - 간단한 글 리뷰
  를 함께 받을 수 있도록 한다.
- 기존 **"사진 저장소" → "리뷰 저장소"** 로 명칭/구조 변경.
- 리뷰 저장소 내부 탭:
  - **리뷰 보기**: 글 + 점수 (또는 글 + 점수 + 사진)
  - **사진 보기**: 사진만 모아보기
- 향후 활용: 모은 리뷰/사진을 **블로그·구글 리뷰로 자동 업로드**할 수 있는 구조로 데이터 설계.

## 3. 메뉴 추가 시 사진 업로드 기능 ✅ 완료
- 메뉴 등록/수정 화면에 **메뉴 사진 첨부 기능** 추가.
- Firebase Storage 업로드 + 메뉴 상세에 썸네일/대표 이미지 노출.

## 4. 온라인 QR 메뉴 주문 결제 + 세금 표시 ✅ 완료
- QR 메뉴로 손님이 직접 주문 후 **결제 진행 가능**하도록 한다.
- 결제 화면에서 **각 항목별/합계 세금이 얼마인지** 명확히 표시 (부가세 등 항목별 breakdown).

## 5. 다국어(언어 변경) 기능 ✅ 1차 스캐폴딩 완료
- 사이트에 **언어 변경 기능** 추가 (원하는 사용자만 사용).
- 진입 위치: **설정 → 언어 탭** 안에서 변경.
- 메인 화면이 아닌 설정 깊은 곳에 배치 (요청사항).

## 6. AI 전화 대응 → 예약 자동 연결 (2026-06-13 등록, 천천히 단계 진행)
> 부재중·통화중일 때 AI가 전화를 대신 받아 예약까지 잡아주는 기능.
> 접근 = "예약 두뇌부터" (외부 전화 계정 없이 server 로직부터). 전화 연동은 두뇌 검증 후.

- [x] **6-1. 예약 두뇌 webhook** ✅ (server.ts)
    - `POST /api/reservation/availability` — businessHours·tables·기존예약으로 빈자리 판단 + 만석 시 대안 시간.
    - `POST /api/reservation/create` — 재검증 후 reservations 생성 + 테이블 reserved + 사장님 푸시(`ai-reservation`).
    - `POST /api/reservation/slots` — 예약 가능 시간대 목록(AI가 대안 제시용). 당일 데이터 1회 조회.
    - `POST /api/reservation/resolve-store` — **전화번호 → storeId 매핑**(가게별 번호로 매장 식별).
    - 중복 예약자 체크(같은 번호·같은 날 확정예약 → 409 duplicate), 매장별 점유시간(durationMin).
    - 공유키(AI_RESERVATION_KEY) 보호 / 매장별 활성화 게이트(storeConfig.aiReservation.enabled).
- [x] **6-1b. 가게별 AI 전화 설정** ✅ — BrandSettings 에 "AI 전화 예약" 섹션(활성화·전화번호·인사말), storeConfig.aiReservation 저장. 4개국어.
- [ ] **6-2. 음성 채널 방향 결정** — 턴키(Vapi/Retell) vs 직접(Twilio+OpenAI Realtime). 한국어 STT/TTS(네이버 CLOVA 등) 품질 검토. (위 webhook 을 함수호출로 연결)
- [ ] **6-3. 한국 전화번호 + 조건부 착신전환(무응답/통화중) 설정.** (가게마다 자기 번호를 BrandSettings 에 등록 → resolve-store 로 매핑)
- [x] **6-4. AI 대화 두뇌 (벤더 중립)** ✅ — `POST /api/reservation/agent`: messages[] 받아 LLM이 발화 이해→예약정보 수집→다음 질문 생성. **예약 확정은 LLM이 아니라 서버(tryBookReservation)가 결정**(거짓 확정 방지). 인사(매장 greeting)·만석→대안시간·영업외·중복→재확인 모두 처리. 다중 제공자(Gemini→Anthropic→OpenAI) 폴백. 텍스트로 먼저 테스트 가능 → 이후 6-2 음성벤더에 그대로 연결.
  - 남은 것: 실제 LLM 키 + 테스트 매장으로 대화 end-to-end 검증(6-6), 음성 연결(6-2/6-3).
- [ ] **6-5. 규제/개인정보** — 통화녹음·AI 응대 고지, 예약자 연락처 PIPA 동의 문구.
- [x] **6-6. 실제 검증(결정론 부분)** ✅ 2026-06-15 — 임시 테스트 매장(자정넘김 영업 18:00~02:00, 2·4석)을 씨딩해 실제 서버+Firestore e2e 10/10 통과: resolve-store / 자정넘김 20:00·01:00 가능 / 마감 02:00 닫힘 / slots / 예약생성 / 동일번호 겹침=중복·다른시간=허용 / 10명=too_large. 끝나고 전량 삭제(잔여 0).
  - [ ] **남은 검증**: `/agent`(LLM) — 로컬 GEMINI_API_KEY 가 무효 더미라 미검증(폴백 로직은 Gemini 400 을 502 로 정상 처리 확인). **프로덕션 Render 의 유효 키로 대화→예약 한 번 확인** 필요. (로컬에서 보려면 .env GEMINI_API_KEY 를 유효키로 교체.)
- [x] **6-7. 신규 코드 적대적 리뷰 반영(2026-06-15)** ✅ — 24건 검증 후 수정: 자정 넘는 영업시간·휴게·마감경계·open24h 순서를 클라 로직과 일치 / callLLMText 제공자 폴백(try-catch) / 같은날 2번째 예약 허용(중복=시간겹침) + 막다른 대화 종료 / 인원초과(too_large) 분리 안내 / 대화 턴 상한(handoff) / /agent rate-limit / 빈 LLM 응답 502 / 대안 N+1 읽기 제거 / 마케팅 rate-limit storeId 분리 + 파싱폴백 정화 + 금지어 원시해시태그 검사 / audit arrayUnion atomic / 발행 try-catch·mutex·성공토스트 / 주간 매출(paid)·예약(completed 포함) / 리뷰버튼 비활성·금지어배지 게이팅·429안내·별점 aria.
  - [x] **① 동시 예약 더블북 방지** ✅ 2026-06-15 — tryBookReservation 을 fs.runTransaction 으로 감쌈(읽기→판정→쓰기 원자화, 충돌 시 Firestore 자동 재시도→재판정). 푸시는 트랜잭션 밖. **동시성 e2e 실증**: 1석 테이블에 2건 동시 발사 → 정확히 1 ok / 1 full, DB 확정 1건(더블북 0). 중복·too_large 회귀 정상.
  - [ ] **② 전화번호 매장 유일성** — 저장 시 중복 거부 + resolve-store 모호성 409(설정 실수 대비, low).

## 7. 소상공인 마케팅 자율 에이전트 ("사장님 비서") (2026-06-13 등록)
> 한 줄: 1인 사장 대신 인스타·네이버플레이스 마케팅을 스스로 운영하는 AI 에이전트(보조 도구가 아니라 자율 실행).
> 흐름: 가게 정보 1회 입력 → 게시물 기획·생성·예약 발행, 리뷰/DM 응대 초안, 주간 성과 요약. **사람은 승인만.**
> 첫 사용자: 결 인접 SMB(식당·미용실·공방) — 발로 영업 + 결 고객 업셀.
> 해자: 업종별 '먹히는 콘텐츠' 성과 루프 + 워크플로우 락인(매일 돌면 끊기 어려움).
> ⚠️ 자동 발행 = 책임 큼 → **승인 게이트·전체 로깅 필수**(자동 발행 절대 무승인 금지).

- [x] **7-1. 매장 마케팅 프로필** ✅ — storeConfig.marketingAgent(enabled·tone·target·keywords·bannedWords·autoPublish=false). 마케팅 비서 페이지 상단에서 입력. 4개국어.
- [x] **7-2. 콘텐츠 생성 엔진** ✅ — `POST /api/marketing/generate`(callLLMText 재사용): 매장 프로필(톤·타깃·키워드·금지어)+업종+채널 반영해 게시물/응대 초안+해시태그 생성. 마케팅 비서 페이지 "AI로 초안 생성"(주제 입력) → addMarketingDraft(source:'agent')로 승인 큐 추가. 금지어 포함 시 bannedHit 경고(7-7 가드 일부). 서버는 텍스트만 생성, 저장은 항상 'draft'(승인 게이트 유지). rate-limit(분당 10회).
  - 남은 것: 실제 LLM 키로 생성 품질 검증, 업종별 템플릿 다양화.
- [x] **7-3. 승인 큐 + 로깅 골격** ✅ — MarketingDraft 타입·marketingDrafts 컬렉션·store CRUD(addMarketingDraft/reviewMarketingDraft/updateMarketingDraftContent/deleteMarketingDraft). 모든 초안은 'draft'로만 생성→승인/거절/수정/발행, 전 상태전이 audit 로깅. 마케팅 비서 페이지(/biz/owner/marketing-agent, 사장 전용)에 승인 대기 큐+활동 로그. 자동 발행 차단(autoPublish 항상 false).
- [ ] **7-4. 채널 연동** — 인스타그램 Graph API, 네이버플레이스(가능 범위 확인). 예약 발행 스케줄러.
- [x] **7-5. 리뷰 응대 초안** ✅ — 마케팅 비서 페이지 "리뷰 응대 초안": 아직 답글 없는 리뷰(photos/review) 목록 → "AI 답글 초안" → generate(kind:reply, reviewText·rating) → 승인 큐(kind:reply, targetId=리뷰). 승인·발행 시 그 리뷰의 ownerReply 로 자동 기록(updatePhoto). 큐에서 원본 리뷰 컨텍스트 표시.
  - 남은 것: DM 응대(외부 채널 연동 7-4 필요), 실제 LLM 키로 품질 검증.
- [x] **7-6. 주간 성과 요약** ✅ — 마케팅 비서 페이지 "이번 주 성과": 주간 매출·예약·새 리뷰(평균별점)·발행 콘텐츠 수를 기존 컬렉션에서 집계 + "AI 주간 요약 받기"(기존 askInsight/buildContext·/api/ai/insight 재사용) → 성과 요약 + 다음 주 콘텐츠 아이디어 2개 제안(생성기로 이어지는 루프). 새 env·규칙 불필요(LLM 키만).
  - 남은 것: 실제 채널 지표(노출·반응)는 7-4 연동 후 추가.
- [x] **7-7. 가드레일 강화** ✅ — ① 금지어 포함 초안은 승인·발행 전 빨간 경고 배지 + window.confirm 명시적 확인. ② 하루 발행 한도(dailyPublishLimit, 최근 24h 기준, 0=무제한) — 초과 시 발행 차단. ③ 사람 최종 승인은 구조적으로 강제(autoPublish 항상 false, 전 초안 draft→승인→발행). 프로필에 한도 입력 추가, 4개국어.

---

## 메모
- 한 번에 다 할 필요 없음, 순차 진행.
- 진행 시작/완료할 때 항목 상태 체크박스로 관리 권장.
