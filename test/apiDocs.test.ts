import fs from 'node:fs'

import ts from 'typescript'
import { expect, test } from 'vitest'

const api = fs.readFileSync('docs/api.md', 'utf8')

const undocumented: Record<string, Record<string, string>> = {}

function source(file: string) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
}

function publicNames(members: ts.NodeArray<ts.ClassElement | ts.TypeElement>) {
  const names: string[] = []
  for (const member of members) {
    const hidden = (
      ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : []
    ).some(
      m =>
        m.kind === ts.SyntaxKind.PrivateKeyword ||
        m.kind === ts.SyntaxKind.ProtectedKeyword,
    )
    const name = member.name?.getText()
    if (
      name &&
      !hidden &&
      !name.startsWith('_') &&
      !ts.isConstructorDeclaration(member)
    ) {
      names.push(name)
    }
  }
  return names
}

// a class's members, plus the keys of its constructor's inline options type
function publicMembers(file: string, name: string) {
  const decl = source(file).statements.find(
    (s): s is ts.ClassDeclaration | ts.InterfaceDeclaration =>
      (ts.isClassDeclaration(s) || ts.isInterfaceDeclaration(s)) &&
      s.name?.text === name,
  )
  if (!decl) {
    throw new Error(`no ${name} in ${file}`)
  }
  const names = publicNames(decl.members)
  if (ts.isClassDeclaration(decl)) {
    const options = decl.members.find(ts.isConstructorDeclaration)
      ?.parameters[0]?.type
    if (options && ts.isTypeLiteralNode(options)) {
      names.push(...publicNames(options.members))
    }
  }
  return [...new Set(names)]
}

function inDocs(name: string) {
  return new RegExp(`\`([\\w.]*\\.)?${name}\\b`).test(api)
}

test.each([
  ['src/parse.ts', 'VCFParser'],
  ['src/Variant.ts', 'Variant'],
  ['src/parseBreakend.ts', 'Breakend'],
  ['src/localAlleles.ts', 'LocalAlleleGenotypeMaps'],
])('docs/api.md covers every public member of %s %s', (file, name) => {
  const skip = undocumented[name] ?? {}
  const members = publicMembers(file, name)
  expect(
    members.filter(m => !(m in skip) && !inDocs(m)),
    'document these in docs/api.md, or list them as undocumented with a reason',
  ).toEqual([])
  expect(
    Object.keys(skip).filter(m => !members.includes(m)),
    'these undocumented entries no longer exist',
  ).toEqual([])
})

// the names an `export * from` re-exports: the file's own exported declarations
function starExports(file: string) {
  return source(file).statements.flatMap(s =>
    (ts.isInterfaceDeclaration(s) ||
      ts.isTypeAliasDeclaration(s) ||
      ts.isClassDeclaration(s) ||
      ts.isFunctionDeclaration(s)) &&
    s.name &&
    ts.getModifiers(s)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
      ? [s.name.text]
      : [],
  )
}

test('docs/api.md covers every export', () => {
  const exported: string[] = []
  for (const statement of source('src/index.ts').statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        exported.push(element.name.text)
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.exportClause &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      exported.push(...starExports(`src/${statement.moduleSpecifier.text}`))
    }
  }
  expect(exported.length).toBeGreaterThan(0)
  expect(exported.filter(name => !inDocs(name))).toEqual([])
})
