/**
 * A phone's keyboard does not shrink the page: iOS slides the visible part of it over the keyboard
 * (visualViewport.offsetTop), and what is stuck to the page's top — the nav bar, a sheet's header — goes off screen
 * with the rest. While the keyboard is up, `keyboard-up` on <html> and three numbers let bars and sheets keep to the
 * visible part (styles.css): --vv-top and --vv-bottom, how far it is from the page's top and bottom edges, and
 * --vv-height, its height. Started once, in main.tsx.
 */
export function watchKeyboard() {
  const v = window.visualViewport
  if (!v) return
  const root = document.documentElement
  const update = () => {
    // pinch-zoom makes the visible part smaller too: then everything stays with the page
    const up = v.scale < 1.01 && innerHeight - v.height > 120
    root.classList.toggle('keyboard-up', up)
    if (!up) return
    root.style.setProperty('--vv-top', `${Math.max(0, Math.round(v.offsetTop))}px`)
    root.style.setProperty('--vv-bottom', `${Math.max(0, Math.round(innerHeight - v.height - v.offsetTop))}px`)
    root.style.setProperty('--vv-height', `${Math.round(v.height)}px`)
  }
  v.addEventListener('resize', update)
  v.addEventListener('scroll', update)
  update()
}
