// Marker classes on Nuxt UI components; assets/css/main.css gives them the sticker look (thick outline, hard shadow).
// Bigger default sizes: everything should be easy to hit.
export default defineAppConfig({
  ui: {
    button: {
      slots: { base: 'kid-btn' },
      // Pills need more room at the ends than Nuxt UI's boxes. Icon-only buttons keep their own (square) padding.
      variants: {
        variant: { solid: 'kid-pop', outline: 'kid-pop', soft: 'kid-pop', subtle: 'kid-pop' },
        size: { xs: { base: 'px-3' }, sm: { base: 'px-3.5' }, md: { base: 'px-4' }, lg: { base: 'px-4.5' }, xl: { base: 'px-6' } },
      },
      defaultVariants: { size: 'lg' },
    },
    card: { slots: { root: 'kid-card', header: 'pb-0 sm:pb-0', footer: 'pt-0' } },
    input: { slots: { base: 'kid-field' }, variants: { size: { md: { base: 'px-3' }, lg: { base: 'px-3.5' } } }, defaultVariants: { size: 'lg' } },
    textarea: { slots: { base: 'kid-field' }, variants: { size: { lg: { base: 'px-3.5 py-2.5' } } }, defaultVariants: { size: 'lg' } },
    select: { slots: { base: 'kid-field', content: 'kid-menu' }, variants: { size: { md: { base: 'ps-3' }, lg: { base: 'ps-3.5' } } }, defaultVariants: { size: 'lg' } },
    pinInput: { slots: { base: 'kid-field kid-pin' } },
    checkbox: { slots: { base: 'kid-check', label: 'font-semibold' }, defaultVariants: { size: 'lg' } },
    formField: { slots: { label: 'font-display font-semibold text-highlighted' } },
    alert: { slots: { root: 'kid-alert', title: 'font-display text-base font-semibold', description: 'text-sm opacity-100' } },
    badge: { slots: { base: 'kid-badge' } },
    modal: { slots: { content: 'kid-sheet', title: 'font-display text-xl font-semibold', header: 'pb-0 sm:pb-0', footer: 'pt-0' } },
    dropdownMenu: { slots: { content: 'kid-menu', label: 'font-display' } },
    toast: { slots: { root: 'kid-toast', title: 'font-display text-base font-semibold' } },
    tooltip: { slots: { content: 'kid-tip' } },
    skeleton: { base: 'rounded-xl' },
  },
});
