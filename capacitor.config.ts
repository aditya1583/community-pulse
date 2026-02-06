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
    // For local dev with hot reload, uncomment the line below and comment out the Vercel URL:
    // url: 'http://192.168.50.4:3000',
    // For TestFlight/production builds, use the Vercel deployment:
    url: 'https://voxlo-theta.vercel.app',
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
