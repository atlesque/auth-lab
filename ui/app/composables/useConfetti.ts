const colors = ['#ff4f9a', '#ff8a3d', '#ffd84d', '#22b573', '#2f9bff', '#8b5cf6'];

// A burst of confetti for the happy moments (signed in, joined a team, new note). Styled by .confetti in main.css.
// Does nothing when the person asked their device for less motion.
export function useConfetti() {
  return (pieces = 70) => {
    if (!import.meta.client || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < pieces; index++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--x', `${Math.random() * 100}vw`);
      piece.style.setProperty('--size', `${8 + Math.random() * 8}px`);
      piece.style.setProperty('--color', colors[index % colors.length]!);
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 30}vw`);
      piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
      piece.style.setProperty('--time', `${1.6 + Math.random() * 1.4}s`);
      piece.style.setProperty('--delay', `${Math.random() * 0.35}s`);
      layer.append(piece);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 3600);
  };
}
