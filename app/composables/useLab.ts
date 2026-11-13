// What this deployment offers (GET /api/config): GitHub sign-in, the dev mailbox, and whether sign-up is open.
interface LabConfig { github: boolean; dev: boolean; signupOpen: boolean }

export function useLab() {
  const config = useState<LabConfig>('lab-config', () => ({ github: false, dev: false, signupOpen: true }));
  const loaded = useState('lab-config-loaded', () => false);
  if (!loaded.value) {
    loaded.value = true;
    api<LabConfig>('/config').then((value) => { config.value = value; }).catch(() => { loaded.value = false; });
  }
  return config;
}
