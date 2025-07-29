import fs from 'node:fs'
import fg from 'fast-glob'
import { parse } from 'yaml'
import { workspaceYaml } from '../path'

const definePackages = parse(fs.readFileSync(workspaceYaml).toString()).packages as string[]

export const packages = definePackages.map(p => fg.sync(p, { onlyDirectories: true })).flat(1)
