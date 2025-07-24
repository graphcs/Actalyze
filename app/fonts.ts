import localFont from 'next/font/local'

export const brandFont = localFont({
    src: '../public/fonts/youngserif.regular.ttf',
    display: 'swap',
    variable: '--font-brand',
})