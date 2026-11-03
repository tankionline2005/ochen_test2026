export const TELEGRAM = 'https://t.me/tankionline2005'
export const REPO = 'https://github.com/tankionline2005/ochen_test2026'

/** Whose work this is — on every screen: in the top bar on a computer, under the content on a phone. */
export function Credits({ inline }: { inline?: boolean }) {
  return (
    <div className={inline ? 'credits inline' : 'credits'}>
      Тестовое задание для ООО «Студия Очень» · Junior AI Developer · Nikolai Kondakov ·{' '}
      <a href={TELEGRAM} target="_blank" rel="noreferrer">
        @tankionline2005
      </a>
    </div>
  )
}
