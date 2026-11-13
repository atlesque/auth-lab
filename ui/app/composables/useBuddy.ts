export type Mood = 'happy' | 'shy' | 'sad' | 'party';

// The mascot's mood. A page's own mood comes from its page meta (`buddy`); this is the short-lived change on top of it:
// shy while a password is typed, sad after an error. The layout clears it when the route changes.
export function useBuddy() {
  const override = useState<Mood | null>('buddy-mood', () => null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const set = (mood: Mood | null) => {
    clearTimeout(timer);
    override.value = mood;
  };
  /** Show a mood for a moment, then go back. */
  const flash = (mood: Mood, ms = 2400) => {
    set(mood);
    timer = setTimeout(() => { if (override.value === mood) override.value = null; }, ms);
  };
  return { override, set, flash };
}
