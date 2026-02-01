import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.voxlo',
  appName: 'Voxlo',
  webDir: 'out',
  ios: {
    contentInset: 'always',
    backgroundColor: '#09090b',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
  },
  server: {
    // Live reload during development - use Mac's IP for physical devices
    // Comment out url for production builds (TestFlight/App Store)
    url: 'http://192.168.50.4:3000',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
