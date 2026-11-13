<script setup lang="ts">
// The mascot: a padlock with a face. Its eyes follow the pointer, and the mood changes what it does:
// shy covers its eyes (while a password is typed), sad frowns (after an error), party hops with the lock open.
import type { Mood } from '../composables/useBuddy';

withDefaults(defineProps<{ mood?: Mood; size?: number }>(), { mood: 'happy', size: 96 });
const root = useTemplateRef<SVGSVGElement>('root');
let frame = 0;

function look(event: PointerEvent) {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const el = root.value;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height * 0.6);
    const far = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, far / 160) * 3.5;
    el.style.setProperty('--look-x', `${((dx / far) * reach).toFixed(2)}px`);
    el.style.setProperty('--look-y', `${((dy / far) * reach).toFixed(2)}px`);
  });
}
onMounted(() => window.addEventListener('pointermove', look, { passive: true }));
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', look);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <svg ref="root" viewBox="0 0 120 124" :width="size" :height="Math.round(size * 124 / 120)" class="buddy" :class="`is-${mood}`" aria-hidden="true">
    <g class="shackle">
      <path d="M38 56V38a22 22 0 0 1 44 0v18" fill="none" stroke="#241a47" stroke-width="15" stroke-linecap="round" />
      <path d="M38 56V38a22 22 0 0 1 44 0v18" fill="none" stroke="#c8b6ff" stroke-width="7.5" stroke-linecap="round" />
    </g>
    <rect x="16" y="48" width="88" height="68" rx="25" fill="#ffe066" stroke="#241a47" stroke-width="4" />
    <circle cx="30" cy="92" r="6" fill="#ffa3d1" />
    <circle cx="90" cy="92" r="6" fill="#ffa3d1" />
    <g class="eyes">
      <ellipse cx="44" cy="77" rx="10" ry="11" fill="#fff" stroke="#241a47" stroke-width="3.5" />
      <ellipse cx="76" cy="77" rx="10" ry="11" fill="#fff" stroke="#241a47" stroke-width="3.5" />
      <circle class="pupil" cx="44" cy="78" r="5" fill="#241a47" />
      <circle class="pupil" cx="76" cy="78" r="5" fill="#241a47" />
    </g>
    <g class="glad" fill="none" stroke="#241a47" stroke-width="4" stroke-linecap="round">
      <path d="M35 80q9-12 18 0" />
      <path d="M67 80q9-12 18 0" />
    </g>
    <path class="smile" d="M49 96q11 10 22 0" fill="none" stroke="#241a47" stroke-width="4" stroke-linecap="round" />
    <path class="frown" d="M50 102q10-9 20 0" fill="none" stroke="#241a47" stroke-width="4" stroke-linecap="round" />
    <ellipse class="cheer" cx="60" cy="99" rx="9" ry="7.5" fill="#ff4f9a" stroke="#241a47" stroke-width="3.5" />
    <g class="hands" fill="#ffd23d" stroke="#241a47" stroke-width="4">
      <ellipse cx="43" cy="78" rx="15" ry="14" />
      <ellipse cx="77" cy="78" rx="15" ry="14" />
    </g>
  </svg>
</template>

<style scoped>
.buddy { animation: bob 4s ease-in-out infinite; }
.eyes { transform-origin: 60px 77px; animation: blink 5s infinite; transition: opacity 0.15s; }
.pupil { transform: translate(var(--look-x, 0px), var(--look-y, 0px)); transition: transform 0.08s linear; }
.glad, .frown, .cheer { opacity: 0; transition: opacity 0.15s; }
.smile { transition: opacity 0.15s; }
.shackle { transform-origin: 82px 56px; transition: transform 0.3s cubic-bezier(0.3, 1.6, 0.5, 1); }
.hands { transform: translateY(70px); transition: transform 0.28s cubic-bezier(0.3, 1.4, 0.5, 1); }

.is-shy .hands { transform: translateY(0); }

.is-sad { animation: shake 0.45s ease-in-out; }
.is-sad .smile { opacity: 0; }
.is-sad .frown { opacity: 1; }
.is-sad .pupil { transform: translate(0, 3px); }

.is-party { animation: hop 0.55s ease-in-out 3; }
.is-party .eyes, .is-party .smile { opacity: 0; }
.is-party .glad, .is-party .cheer { opacity: 1; }
.is-party .shackle { transform: rotate(-22deg) translateY(-7px); }

@keyframes blink {
  0%, 93%, 100% { transform: scaleY(1); }
  96% { transform: scaleY(0.1); }
}
@keyframes hop {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  40% { transform: translateY(-14px) rotate(-5deg); }
  70% { transform: translateY(0) rotate(4deg); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
</style>
