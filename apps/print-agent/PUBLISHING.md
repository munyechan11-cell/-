# 인스톨러 빌드·배포 — GitHub Actions 자동화 (권장)

결 인쇄 브릿지의 `.exe` 인스톨러를 사장님 PC가 아닌 **GitHub Actions 클라우드 빌드**로 만듭니다.
한 번 셋업하면 `git tag` 한 줄로 새 인스톨러가 자동 배포돼요.

---

## 🚀 사용법 — 3가지 트리거

### ① 새 버전 릴리스 (가장 흔함)

PowerShell 또는 터미널에서:

```powershell
cd "C:\Users\munye\OneDrive\Desktop\--main\apps\print-agent"

# 1. 버전 올리기 (package.json 의 version 자동 증가)
npm version patch        # 0.1.0 → 0.1.1
# npm version minor      # 0.1.x → 0.2.0
# npm version major      # 0.x.x → 1.0.0

# 2. 코드와 태그를 GitHub 에 푸시
git push --follow-tags
```

→ GitHub Actions 가 자동으로:
1. Windows 환경에서 npm install
2. 아이콘 생성
3. TypeScript 빌드
4. NSIS 인스톨러 패키징
5. **GitHub Releases 에 자동 업로드** (Draft 상태)

5~10분 후 https://github.com/munyechan11-cell/-/releases 에서 Draft 확인 → **Publish release** 클릭 → 끝.

### ② 수동 실행 (Actions 탭에서)

1. GitHub 리포 → **Actions** 탭
2. 좌측 **"Release Print Agent"** 클릭
3. 우측 **"Run workflow"** 버튼
4. (선택) 버전 올리기 옵션 선택
5. **Run workflow** 클릭

### ③ 코드 푸시할 때마다 자동 빌드 (선택)

`v0.1.0` 같은 태그 없이도 매 푸시마다 빌드하고 싶으면, 워크플로우 파일의
`on:` 섹션에 `push: branches: [main]` 추가. 단, releases 가 자주 생기므로
실험 단계에만 추천.

---

## 🎯 사장님이 받는 다운로드 흐름

1. 결 웹앱 → 브랜드 설정 → 영수증 자동 인쇄
2. **"📥 결 인쇄 브릿지 프로그램 다운로드"** 클릭
3. GitHub Releases → 최신 `결-인쇄-브릿지-Setup-X.X.X.exe` 다운로드
4. 더블클릭 → 설치 (3분)
5. ⚠️ "Windows 보호" 경고 → **추가 정보 → 실행** (코드 사이닝 안 한 베타용)

---

## 🔄 자동 업데이트 — 사장님 신경 X

새 버전을 GitHub Releases 에 올리면:
- 에이전트가 4시간마다 폴링
- 새 버전 발견 시 백그라운드 다운로드
- 사장님이 PC를 끄거나 트레이에서 "종료" 누르면 자동 설치

---

## 🛟 트러블슈팅

### Actions 빌드 실패
1. GitHub 리포 → Actions → 실패한 워크플로우 클릭
2. 빨간 X 표시된 step 펼치기
3. 로그 확인

흔한 원인:
- `npm ci` 실패 → `package-lock.json` 누락. 로컬에서 `npm install` 한 번 한 뒤 lock 파일 커밋
- `electron-builder` 실패 → 환경변수 누락. 워크플로우의 `env:` 확인

### "Resource not accessible by integration"
→ 워크플로우의 `permissions: contents: write` 가 있는지 확인. 또는 리포 Settings → Actions → General → Workflow permissions 에서 **Read and write permissions** 선택.

### 매번 빌드 시간 5분 → 1분으로 줄이기
워크플로우의 `cache: "npm"` 설정 덕분에 두 번째부터 자동 캐시. 추가 작업 불필요.

---

## 💸 비용

- **퍼블릭 리포**: 완전 무료, 무제한
- **프라이빗 리포**: 월 2,000분 무료 (인스톨러 1회 빌드 ≈ 8분 → 250회/월)
- 베타 단계엔 신경 쓸 비용 없음

---

## 📦 로컬 빌드도 가능 (선택)

GitHub Actions 안 쓰고 PC에서 직접 빌드하려면:

```powershell
cd apps/print-agent
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
$env:GH_TOKEN = "ghp_..."   # GitHub PAT
npm install
npm run release:win
```

⚠️ Windows에서 `winCodeSign` 압축 풀기 실패 사고가 잦음. GitHub Actions 가 훨씬 안정적.
