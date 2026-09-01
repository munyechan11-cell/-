/**
 * Firestore 보안 규칙 테스트 러너.
 *
 * vitest 결과만 보면 놓치는 게 있다: 규칙이 **평가 오류로 죽어도** Firestore 는
 * 그 요청을 거부한다. 그래서 "막았다"를 기대한 테스트는 통과한다 — 실제로는
 * 막은 게 아니라 터진 것인데도. 그 상태는 다음 수정 한 번에 조용히 허용으로 뒤집힌다.
 *
 * 그래서 에뮬레이터가 뱉는 규칙 평가 로그를 함께 읽고, 그런 흔적이 보이면 실패시킨다.
 *
 * 무엇을 실패로 볼지는 실측으로 정했다(에뮬레이터에 최소 규칙을 던져 확인):
 *   · "Null value error"  → 그 메서드에 존재하지 않는 변수를 만졌다는 뜻.
 *     delete 규칙에서 request.resource 를, create 규칙에서 resource 를 읽는 경우.
 *     이건 진짜 실수이므로 실패로 처리한다.
 *   · "evaluation error"  → 실패 기준으로 쓸 수 없다. 멀쩡한
 *     `allow update: if resource.data...` 도 문서가 없는 setDoc 요청에서는 이 로그를
 *     남긴다(문서 존재 여부를 모른 채 update 규칙까지 평가하기 때문). 참고용으로만 센다.
 */
import { spawn } from 'node:child_process';

const EMULATOR_CMD = [
  'firebase', 'emulators:exec',
  '--only', 'firestore',
  '--project', 'gyeol-test',
  'vitest run --config vitest.rules.config.ts',
];

const child = spawn('npx', EMULATOR_CMD, { stdio: ['ignore', 'pipe', 'pipe'] });

let combined = '';
const relay = (chunk) => {
  const text = chunk.toString();
  combined += text;
  process.stdout.write(text);
};
child.stdout.on('data', relay);
child.stderr.on('data', relay);

const code = await new Promise((resolve) => child.on('close', resolve));

if (code !== 0) {
  console.error('\n규칙 테스트 실패 (exit ' + code + ')');
  process.exit(code || 1);
}

// 규칙이 결정을 내린 게 아니라 터진 흔적.
const BAD = [/Null value error/i, /Property .* is undefined on object/i];
const offenders = combined
  .split('\n')
  .filter((line) => BAD.some((re) => re.test(line)));

if (offenders.length) {
  console.error(
    '\n규칙이 없는 변수를 만져 죽은 흔적이 있다 — 거부가 "막았다"가 아니라 "터졌다"라는 뜻이다.\n' +
      'delete 규칙에서 request.resource 를, create 규칙에서 resource 를 읽고 있지 않은지 볼 것.\n'
  );
  for (const line of [...new Set(offenders)].slice(0, 20)) console.error('  ' + line.trim());
  process.exit(1);
}

console.log('\n없는 변수를 만진 규칙 없음 — 모든 거부가 의도된 규칙에 의한 것.');
