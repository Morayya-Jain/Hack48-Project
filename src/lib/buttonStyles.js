const buttonBase =
  'inline-flex cursor-pointer items-center justify-center rounded-md border font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none'

const buttonPrimary =
  `${buttonBase} border-emerald-700 bg-emerald-600 text-white shadow-sm hover:border-emerald-600 hover:bg-emerald-500 active:translate-y-px`

const buttonSecondary =
  `${buttonBase} border-slate-300 bg-white text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:translate-y-px`

const buttonDanger =
  `${buttonBase} border-rose-700 bg-rose-600 text-white shadow-sm hover:border-rose-600 hover:bg-rose-500 active:translate-y-px`

const buttonTab =
  `${buttonBase} border-slate-300 bg-slate-100 text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-200 active:translate-y-px`

const sizeSm = 'px-3 py-1.5 text-sm'
const sizeMd = 'px-3 py-2'
const sizeLg = 'px-4 py-2.5'

export {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  buttonTab,
  sizeLg,
  sizeMd,
  sizeSm,
}
