export const config = {
  /** Backend simulated in the browser. On unless the build says `VITE_DEMO_MODE=false`. */
  demoMode: import.meta.env.VITE_DEMO_MODE !== 'false',
};
