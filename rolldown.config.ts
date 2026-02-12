import type { RolldownOptions } from 'rolldown'
import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { defineConfig } from 'rolldown'
import { packages } from './internal/common'

const option: RolldownOptions[] = []

const commonConfig = {}

function hasVueSource(packageDir: string): boolean {
  return fg.sync('**/*.vue', {
    cwd: packageDir,
    onlyFiles: true,
    ignore: ['dist/**', 'node_modules/**'],
  }).length > 0
}

interface WorkspacePackageInfo {
  dir: string
  name: string
  hasBuildScript: boolean
  hasVueSfc: boolean
}

const workspacePackageInfos: WorkspacePackageInfo[] = packages.flatMap((p) => {
  const packageJsonPath = path.resolve(p, 'package.json')
  if (!fs.existsSync(packageJsonPath))
    return []

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())
  const name = packageJson.name as string | undefined
  if (!name)
    return []

  return [{
    dir: p,
    name,
    hasBuildScript: Object.keys(packageJson.scripts ?? {}).includes('build'),
    hasVueSfc: hasVueSource(p),
  }]
})

const vuePackageNames = workspacePackageInfos
  .filter(info => info.hasVueSfc)
  .map(info => info.name)

workspacePackageInfos.forEach((info) => {
  if (info.hasBuildScript)
    return // 不使用通用打包

  if (info.hasVueSfc)
    return // 需要 Vue SFC 打包链路

  option.push({
    input: info.dir,
    external: vuePackageNames,
    output: {
      dir: `${info.dir}/dist`,
      minify: true,
    },
    ...commonConfig,
  })
})

export default defineConfig(option)
