import * as fs from 'fs'
import * as prettier from 'prettier'
import { EOL } from 'os'
import { IDatabase } from 'pg-promise'
import { IClient } from 'pg-promise/typescript/pg-subset'

import pg from './db'

import { IEnumSchema, ITypesSchema } from './types'
import { parseTableNames, getEnums, parseEnumTypes, parseInterfaces, parseCustomType } from './parsers'

export function sanitizeName(name: string, prefix: string = '', splitters: string[] = ['_', '-']) {
  return name
    .split(new RegExp(splitters.join('|')))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
    .replace(/^/, `${prefix}`)
}

export function generateEnumMap(enums: IEnumSchema[]) {
  return enums.reduce((acc: Map<string, string[]>, curr) => {
    acc.set(curr.enum_name, curr.enum_value.split(','))
    return acc
  }, new Map())
}

export async function writeToFile(path: string, content: string[], name: string) {
  if (!fs.existsSync(path)) fs.mkdirSync(path)
  const _path = path + `/${name}.ts`

  fs.writeFileSync(
    _path,
    prettier.format(content.join(EOL), { ...(await prettier.resolveConfig(path)), filepath: _path }),
  )
}

export async function postez(db: IDatabase<unknown, IClient>, outputPath: string, schema: ITypesSchema) {
  const tables = await parseTableNames(db, pg.sql('select-table-names'))
  const enums = await getEnums(db, pg.sql('select-enum-names'))

  const _enums = await parseEnumTypes(enums)
  const _interfaces = await parseInterfaces(
    db,
    tables,
    pg.sql('select-table-information'),
    generateEnumMap(enums),
    schema,
  )
  const _customTypes = parseCustomType(schema)

  try {
    writeToFile(outputPath, _enums.concat(_customTypes, _interfaces), 'types')
    console.info('Succesfully generated files in:', outputPath)
  } catch (error) {
    console.error(error)
  }
}
