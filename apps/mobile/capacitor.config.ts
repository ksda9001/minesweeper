import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.casper.realmines', appName: '草地扫雷', webDir: '../../dist',
  android: { allowMixedContent: false },
  plugins: { SystemBars: { style: 'DARK', insetsHandling: 'native' } },
};
export default config;
