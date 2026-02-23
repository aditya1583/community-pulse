import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.voxlo',
  appName: 'Voxlo',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
    scrollEnabled: true,
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
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#020a06",
    },
  },
};

export default config;
