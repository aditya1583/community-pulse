import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.voxlo',
  appName: 'Voxlo',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#09090b',
  },
  server: {
    // Injected into window.Capacitor.config at runtime
    // Used by CapacitorProvider to route API calls
    url: undefined, // Set to a URL for live reload during development
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
