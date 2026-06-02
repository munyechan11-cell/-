# 인스톨러 호스팅 — GitHub Releases (무료, 자동 업데이트 지원)

결 인쇄 브릿지의 `.exe` / `.dmg` 인스톨러를 GitHub Releases에 올려두면
사장님은 결 웹앱에서 다운로드 가능 + 에이전트가 자동 업데이트까지 잡아냅니다.

---

## 🚀 1회 셋업 — GitHub 토큰 발급 (3분)

1. https://github.com/settings/tokens/new 접속
2. **Token name**: `gyeol-print-agent-release`
3. **Expiration**: `90 days` 또는 `No expiration` (베타 길게)
4. **Scopes** 체크:
   - ✅ `repo` (전체)
   - ✅ `write:packages`
5. **Generate token** → 토큰 복사 (한 번만 표시됨)

PowerShell에서 환경변수 등록 (영구):
```powershell
[Environment]::SetEnvironmentVariable("GH_TOKEN", "ghp_여기에토큰", "User")
# PowerShell 재시작
```

확인:
```powershell
$env:GH_TOKEN
# ghp_... 가 나와야 함
```

---

## 📦 빌드 + 자동 업로드 (매 새 버전마다)

```powershell
cd "C:\Users\munye\OneDrive\Desktop\--main\apps\print-agent"

# 버전 올리기 (package.json version)
npm version patch       # 0.1.0 → 0.1.1

# Windows 인스톨러 빌드 + GitHub Release 자동 생성·업로드
npm run release:win
```

→ 약 3~5분 후:
- GitHub 리포에 새 Release 자동 생성 (Draft 상태)
- `결-인쇄-브릿지-Setup-0.1.1.exe` 업로드
- `latest.yml` 도 같이 (electron-updater 가 자동 업데이트에 사용)

→ GitHub 리포 → Releases → Draft 클릭 → **Publish release**

---

## 🎯 사장님이 받는 다운로드 흐름

1. 결 웹앱 → 브랜드 설정 → 영수증 자동 인쇄
2. **"📥 결 인쇄 브릿지 프로그램 다운로드"** 클릭
3. GitHub Releases 페이지로 이동 → `결-인쇄-브릿지-Setup-X.X.X.exe` 클릭
4. 다운로드 후 더블클릭 → 설치 (약 3분)
5. ⚠️ "Windows 보호" 경고가 한 번 뜨면 **추가 정보 → 실행** 클릭 (코드 사이닝 안 한 베타용)

---

## 🔄 자동 업데이트 — 사장님이 신경 안 써도 됨

새 버전을 GitHub Releases 에 올리면:
- 에이전트가 4시간마다 체크
- 새 버전 발견 시 백그라운드 다운로드
- 사장님이 다음에 PC를 끄거나 트레이 아이콘에서 "종료" 하면 자동 설치

> 💡 영업 시간 중에 강제 재시작 안 함. 끝나는 시점만 잡음.

---

## 🚨 트러블슈팅

### `npm run release:win` 실행 시 "GH_TOKEN not set"
→ 환경변수 등록 후 PowerShell **새로 열기** 필수.

### "code 403" 또는 "Bad credentials"
→ 토큰 권한 부족. `repo` 스코프 다시 확인.

### "icon.ico not found"
→ `npm run icons` 한 번 실행. 자동으로 `prebuild` 시 호출되지만, 권한 문제로
sharp 가 PNG 생성 실패할 수 있음. PowerShell 관리자 권한으로 한 번 시도.

### Windows SmartScreen "보호" 경고
→ 코드 사이닝 인증서가 없어서. 베타엔 정상. 사장님 안내문에
"추가 정보 → 실행" 가이드 포함.
