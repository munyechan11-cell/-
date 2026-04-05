const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'owner', 'Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    { from: /Active Session/g, to: '이용 중' },
    { from: /Standby Mode/g, to: '입장 대기' },
    { from: /Visits: /g, to: '방문 횟수: ' },
    { from: /Send Signal/g, to: '문자/알림 전송' },
    { from: /Issue Loyalty/g, to: '쿠폰/서비스 증정' },
    { from: /Terminate Active Session/g, to: '이용 완료 (결제 처리)' },
    { from: /Architecture Params/g, to: '상세 배치 속성 설정' },
    { from: /Grid Width/g, to: '가로 길이' },
    { from: /Grid Height/g, to: '세로 길이' },
    { from: /Seats Density/g, to: '최대 좌석' },
    { from: /Confirm Specification/g, to: '설정 적용 완료' },
    { from: /Digital Entrance Signal/g, to: '디지털 입장 QR 코드' },
    { from: /italic/g, to: '' }, // Remove italic classes
    { from: /Command Hub Governance/g, to: '시스템 통합 관리 모드' },
    { from: /Verified Owner/g, to: '인증된 사장님 계정' },
    { from: /Marketing Opportunity Triggered/g, to: '단골 유치를 위한 마케팅 기회 포착' },
    { from: /Occupied/g, to: '이용 중' },
    { from: /Vacant/g, to: '사용 가능' },
    { from: /Current Tenant/g, to: '현재 이용 고객' },
    { from: /None/g, to: '없음' }
];

replacements.forEach(r => {
    content = content.replace(r.from, r.to);
});

fs.writeFileSync(filePath, content);
console.log('Localization applied successfully.');
