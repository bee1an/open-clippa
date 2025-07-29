import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'rolldown'
import { packages } from './internal/common'

const option: any[] = []

const commonConfig = {}

packages.forEach((p) => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(p, 'package.json')).toString())

  if (Object.keys(packageJson.scripts ?? {}).includes('build'))
    return // 不使用通用打包

  option.push({
    input: p,
    output: {
      dir: `${p}/dist`,
      minify: true,
    },
    ...commonConfig,
  })
})

export default defineConfig(option)
