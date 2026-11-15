/**
 * A small check that the two languages stay in step. Run with `npm test`.
 *
 * - en.js and id.js have the same keys, the same kinds of values and lists of
 *   the same length
 * - every { en, id } text in src/data has both languages filled in
 * - no em dashes in any text (house rule for the copy)
 */
import en from '../src/i18n/en.js'
import id from '../src/i18n/id.js'
import { projects, projectCategories } from '../src/data/projects.js'
import { experience } from '../src/data/experience.js'

const problems = []
const kind = (v) => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v)

function sameShape(a, b, path) {
  if (kind(a) !== kind(b)) {
    problems.push(`${path}: en is a ${kind(a)}, id is a ${kind(b)}`)
    return
  }
  if (kind(a) === 'list') {
    if (a.length !== b.length) problems.push(`${path}: en has ${a.length} items, id has ${b.length}`)
    a.forEach((item, i) => i < b.length && sameShape(item, b[i], `${path}[${i}]`))
  } else if (kind(a) === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(key in a)) problems.push(`${path}.${key}: missing in en.js`)
      else if (!(key in b)) problems.push(`${path}.${key}: missing in id.js`)
      else sameShape(a[key], b[key], `${path}.${key}`)
    }
  } else if (kind(a) === 'string' && (!a.trim() || !b.trim())) {
    problems.push(`${path}: empty text`)
  }
}

/** Every object that looks like { en, id } must have both, as non-empty text. */
function bothLanguages(value, path) {
  if (kind(value) === 'list') value.forEach((v, i) => bothLanguages(v, `${path}[${i}]`))
  else if (kind(value) === 'object') {
    // `id` on its own is usually an item's slug, so only a lone `id` counts as a text missing its English
    if ('en' in value || (Object.keys(value).length === 1 && 'id' in value)) {
      for (const lang of ['en', 'id']) {
        if (typeof value[lang] !== 'string' || !value[lang].trim()) problems.push(`${path}: no ${lang} text`)
      }
    } else {
      for (const [key, v] of Object.entries(value)) bothLanguages(v, `${path}.${key}`)
    }
  }
}

function noEmDash(value, path) {
  if (typeof value === 'string') {
    if (value.includes(String.fromCharCode(0x2014))) problems.push(`${path}: has an em dash`)
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) noEmDash(v, `${path}.${key}`)
  }
}

sameShape(en, id, 'i18n')
const data = { projects, projectCategories, experience }
bothLanguages(data, 'data')
noEmDash({ en, id, ...data }, 'text')

if (problems.length) {
  console.error(`Content check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
console.log('Content check passed: en.js and id.js match, and every text has both languages.')
