import { useLayoutEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/contexts'
import { projects, projectCategories, categoriesOf } from '../data/projects'
import { profile } from '../data/profile'
import { jumpBy, scrollToTarget } from '../lib/smoothScroll'
import SectionHeading from '../components/SectionHeading'
import ProjectCard from '../components/ProjectCard'
import styles from './Projects.module.css'

const finished = projects.filter((p) => p.status !== 'in-progress')
const inProgress = projects.filter((p) => p.status === 'in-progress')
// "Last built" is the newest finished project; "Currently building" only shows while something is in progress
const lastBuild = finished[0]
const building = inProgress[0]
const github = profile.socials.find((s) => s.id === 'github')

// one grid: finished work first, then whatever is still being built. Projects
// with a `featured` number lead the grid in that order; the rest keep the
// array's order (newest first), which is also what "Last built" follows.
const rank = (p) => p.featured ?? 99
const ordered = [...[...finished].sort((a, b) => rank(a) - rank(b)), ...inProgress]
const inCategory = (id) => (id === 'all' ? ordered : ordered.filter((p) => categoriesOf(p).includes(id)))
// two rows of the 3-column grid; the rest wait behind "Show n more"
const FIRST = 6

export default function Projects() {
  const { t, pick } = useLanguage()
  const [active, setActive] = useState('all')
  const [open, setOpen] = useState(false)
  const toggleRef = useRef(null)
  // where the toggle was on screen before "Show fewer", to keep it there
  const toggleTop = useRef(null)

  const all = inCategory(active)
  const hidden = open ? 0 : Math.max(0, all.length - FIRST)
  const shown = hidden ? all.slice(0, FIRST) : all

  // jump to a card, clearing the filter or opening the rest first if they hide it
  const jumpTo = (id) => (e) => {
    e.preventDefault()
    if (shown.some((p) => p.id === id)) {
      scrollToTarget(`#project-${id}`)
      return
    }
    if (!all.some((p) => p.id === id)) setActive('all')
    setOpen(true)
    requestAnimationFrame(() => scrollToTarget(`#project-${id}`))
  }

  const toggle = () => {
    if (open) toggleTop.current = toggleRef.current?.getBoundingClientRect().top ?? null
    setOpen(!open)
  }

  // folding the grid away above the button would yank the page up under the
  // pointer, so move the page by as much as the button moved
  useLayoutEffect(() => {
    if (open || toggleTop.current == null || !toggleRef.current) return
    jumpBy(toggleRef.current.getBoundingClientRect().top - toggleTop.current)
    toggleTop.current = null
  }, [open])

  return (
    <section id="projects" className="section">
      <div className="container">
        <SectionHeading index={1} kicker={t('projects.kicker')} title={t('projects.title')}>
          <p>{t('projects.subtitle')}</p>
          <ul className={styles.now}>
            {lastBuild && (
              <li>
                <span className={styles.nowLabel}>
                  <span className={`${styles.nowDot} ${styles.done}`} aria-hidden="true" />
                  {t('projects.lastBuild')}
                </span>
                <a href={`#project-${lastBuild.id}`} onClick={jumpTo(lastBuild.id)}>
                  {lastBuild.title}
                </a>
              </li>
            )}
            {building && (
              <li>
                <span className={styles.nowLabel}>
                  <span className={`${styles.nowDot} ${styles.live}`} aria-hidden="true" />
                  {t('projects.building')}
                </span>
                <a href={`#project-${building.id}`} onClick={jumpTo(building.id)}>
                  {building.title}
                </a>
              </li>
            )}
          </ul>
        </SectionHeading>

        <div className={styles.filters} role="tablist" aria-label="Filter projects">
          {projectCategories.map((cat) => {
            const count = inCategory(cat.id).length
            return (
              <button
                key={cat.id}
                role="tab"
                id={`filter-${cat.id}`}
                aria-selected={active === cat.id}
                className={`${styles.filter} ${active === cat.id ? styles.filterOn : ''}`}
                onClick={() => setActive(cat.id)}
                disabled={count === 0}
              >
                {pick(cat.label)}
                <sup>{count}</sup>
              </button>
            )
          })}
        </div>

        <div className={styles.grid}>
          {shown.map((p, i) => (
            <ProjectCard key={`${active}-${p.id}`} project={p} delay={open ? Math.max(0, i - FIRST) * 0.07 : 0} />
          ))}
        </div>

        <div className={styles.foot}>
          {all.length > FIRST && (
            <button
              ref={toggleRef}
              type="button"
              className={`${styles.toggle} ${open ? styles.toggleOpen : ''}`}
              aria-expanded={open}
              onClick={toggle}
            >
              {open ? t('projects.showLess') : t('projects.showMore').replace('{n}', hidden)}
              <span aria-hidden="true">↓</span>
            </button>
          )}
          <a className={styles.more} href={github.url} target="_blank" rel="noopener noreferrer">
            {t('projects.more')} ↗
          </a>
        </div>
      </div>
    </section>
  )
}
