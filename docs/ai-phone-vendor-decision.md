# AI 전화 예약 — 음성 채널 벤더 결정 (TODO 6-2)

> 작성: 2026-06-13 · 우리 자산: server.ts `/api/reservation/*` (availability·slots·create·resolve-store·**agent**) 예약 두뇌 완성. 이 문서는 "그 두뇌에 음성을 어떻게 붙일까" 결정용.

## 핵심 기준 (결 전략 관점)
결의 해자는 **예약이 결 안으로 흘러들어와** 테이블·대시보드·고객 데이터와 연결되는 것. 따라서:
1. **결 연동 가능성(가장 중요)** — 음성 플랫폼이 우리 `/agent`(또는 함수호출 webhook)를 호출해 Firestore 예약을 만들 수 있어야 한다. *데이터가 결로 들어오지 않으면 의미 없음.*
2. 한국어 STT/TTS 품질 (손님이 자연스럽게 느껴야 함)
3. 한국 전화번호/착신전환 현실성
4. 비용 (1인 매장이 감당 가능한가)
5. 구축 속도

## 후보 비교

| 옵션 | 결 연동 | 한국어 | 번호/착신 | 비용(통화당, 4분 가정) | 구축 |
|---|---|---|---|---|---|
| **KT AI 통화비서** (국내 텔코) | ❌ **사일로** — 자체 예약관리, 결로 데이터 안 들어옴 | ✅ 최상(네이티브) | ✅ KT 회선 그대로 | 월정액(소액) | 가입만(즉시) |
| **Retell** + 우리 /agent | ✅ custom LLM/webhook | ✅ ElevenLabs/Azure 한국어 | △ 번호 프로비저닝 or 착신전환 | ~$0.13–0.31/분 → 통화당 약 0.7~1.7천원 | 설정+webhook(빠름) |
| **Vapi** + 우리 /agent | ✅ custom LLM/TTS/telephony | ✅ ElevenLabs/Azure/OpenAI | △ 동일 | ~$0.20–0.33/분 (구성요소 합산 시↑) | 설정+webhook(빠름) |
| **Twilio + OpenAI Realtime** (직접) | ✅ 완전 제어 | ✅ Realtime 한국어 ($0.06 in/$0.24 out·분) | △ Twilio 한국번호=규제 번들 필요 | ~$0.30/분+텔레포니 | 직접 구축(느림) |

비용 주: 부재중 통화는 하루 몇 건 수준 → 월 비용은 대개 **수천~수만원**대로 작음. 비용보다 연동·한국어가 결정 변수.

## 결론 / 권장

- **KT AI 통화비서는 결 전략과 상충** — 한국어·번호는 완벽하지만 예약이 KT 안에 갇혀 결 대시보드·테이블·고객 루프로 안 들어온다. 결의 해자(워크플로우 락인)를 못 만든다. *경쟁/벤치마크 대상으로만 참고.*
- **MVP 권장: Retell (1순위) 또는 Vapi (2순위) + 우리 `/api/reservation/agent`.**
  - 음성 플랫폼은 통화/STT/TTS/barge-in만 담당, **대화·예약 두뇌는 우리 서버**(이미 구현·텍스트 테스트 가능). 거짓 확정 방지(서버가 booking 결정)도 그대로 유지.
  - 한국어 음성: **ElevenLabs 한국어** 또는 **Azure 한국어**로 시작, 품질 부족 시 **네이버 CLOVA Voice**로 업그레이드(프리미엄 한국어).
  - 연결: 플랫폼의 custom-LLM/function-call webhook → 통화 시작 시 `resolve-store`(전번→storeId) → 대화는 `/agent`(또는 availability/slots/create 직접 함수호출).
- **전화번호: 처음엔 "조건부 착신전환"으로 시작** — 매장 기존 번호에서 무응답·통화중 시 에이전트 번호로 착신전환(통신사 설정). Twilio 한국 로컬번호는 규제 번들(사업자등록 등)이 필요하니, 파일럿은 착신전환으로 우회. 볼륨 커지면 한국번호 정식 프로비저닝.

## 단계
1. **파일럿(지금 가능):** Retell 계정 + ElevenLabs 한국어 보이스 + 우리 `/agent` 연결. 테스트 매장 1곳으로 한국어 대화 품질·예약 정확도 검증.
2. 착신전환 설정(매장 BrandSettings에 자기 번호 등록 → resolve-store 매핑).
3. PIPA: 통화 시작 시 "AI 응대·예약 위해 통화 기록" 고지 + 동의. (TODO 6-5)
4. 볼륨↑ 시 비용 최적화로 Twilio+OpenAI Realtime 직접 구축 검토.

## 출처
- [Retell vs Vapi 가격 비교 (CloudTalk)](https://www.cloudtalk.io/retell-ai-vs-vapi-ai/) · [AI 음성 에이전트 분당 가격 2026 (Ringlyn)](https://www.ringlyn.com/blog/ai-voice-agent-pricing-per-minute-2026/)
- [OpenAI Realtime API 가격 2026 (HackerNoon)](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions)
- [KT AICC / AI 통화비서 (KT Enterprise)](https://enterprise.kt.com/bt/dxstory/1057.do)
- [Twilio 전화번호 규제 준수 가이드](https://www.twilio.com/en-us/guidelines/regulatory)
- [Vapi 한국어/TTS 제공자 (Retell 블로그)](https://www.retellai.com/blog/vapi-ai-review)
