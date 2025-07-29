import fs from 'node:fs'
import path from 'node:path'
import fg from 'fast-glob'
import { parse } from 'yaml'
import { workspaceYaml } from '../internal/path'

const definePackages = parse(fs.readFileSync(workspaceYaml).toString()).packages as string[]

const packages = definePackages.map(p => fg.sync(p, { onlyDirectories: true })).flat(1)

packages.forEach((p) => {
  fs.rmSync(path.resolve(p, 'dist'), { recursive: true, force: true })
})
