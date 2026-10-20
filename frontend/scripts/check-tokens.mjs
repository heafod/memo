// token 权威源校验：src/styles/tokens.css 须与 prototype/src/styles/tokens.css 逐字节一致。
// 权威源不改（001-plan「不动」）；生产端只在 src/index.css 做映射。
// 镜像构建上下文为 frontend/，取不到 prototype/，故以副本进仓 + 本脚本防漂移（随 npm run lint 执行）。
import { readFileSync } from 'node:fs';

const source = new URL('../../prototype/src/styles/tokens.css', import.meta.url);
const copy = new URL('../src/styles/tokens.css', import.meta.url);
if (!readFileSync(source).equals(readFileSync(copy))) {
  console.error(
    'src/styles/tokens.css 与 prototype/src/styles/tokens.css 不一致：请重新复制权威源（cp ../prototype/src/styles/tokens.css src/styles/tokens.css）',
  );
  process.exit(1);
}
console.log('tokens.css 与权威源逐字节一致');
