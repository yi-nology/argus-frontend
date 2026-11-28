#!/usr/bin/env node
/**
 * 视觉 token 门禁的第二道闸：ESLint 用语法选择器封死裸色值，
 * 这里再封「裸 fontSize 数字」与「用 opacity 伪造文本层级」。
 *
 * 设计 token 单源是 src/theme/tokens.ts；字号走 .t-* / .meta* 类或 t.font.*，
 * 次要文本走 .meta / .meta-sm，不用透明度压字。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

/** 这些文件是 token 事实源本身，允许出现标尺数值。 */
const ALLOW = new Set(['src/theme/tokens.ts', 'src/theme/global.css'])

const RULES = [
  {
    name: '裸 fontSize 数字',
    re: /fontSize:\s*(?!t\.font\.)\d+/,
    hint: '字号走 .t-xs/.t-sm/.t-md/.t-lg/.t-xl/.t-xxl 或 .meta/.meta-sm 类，或 t.font.*。',
  },
  {
    name: 'opacity 伪造文本层级',
    re: /opacity:\s*0\.\d/,
    hint: '次要文本用 .meta / .meta-sm / Typography.Text type="secondary"，不用透明度压字。',
  },
]

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    // 跳过 Umi 生成物目录（框架代码不受视觉 token 纪律约束）。
    if (st.isDirectory()) {
      if (name === '.umi') continue
      yield* walk(p)
    } else if (/\.(tsx?|css)$/.test(name)) yield p
  }
}

const violations = []
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file)
  if (ALLOW.has(rel)) continue
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        violations.push({ rel, line: i + 1, rule: rule.name, hint: rule.hint, code: line.trim() })
      }
    }
  })
}

if (violations.length > 0) {
  console.error(`✗ 视觉 token 门禁未通过（${violations.length} 处）：\n`)
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  [${v.rule}]`)
    console.error(`    ${v.code}`)
    console.error(`    → ${v.hint}\n`)
  }
  process.exit(1)
}
console.log('✓ 视觉 token 门禁通过（无裸 fontSize / 无 opacity 层级）')
