import FingerprintJS from '@fingerprintjs/fingerprintjs';

export class FingerprintService {
  private static visitorId: string | null = null;
  
  static async getFingerprint(): Promise<string> {
    if (this.visitorId) return this.visitorId;
    
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      this.visitorId = result.visitorId;
      return this.visitorId;
    } catch (error) {
      return this.generateSimpleFingerprint();
    }
  }
  
  private static generateSimpleFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return this.generateUUID();
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    
    const dataURL = canvas.toDataURL();
    const hash = this.hashString(dataURL);
    
    const components = [
      hash,
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.colorDepth,
      screen.width + 'x' + screen.height,
    ].join('|');
    
    return this.hashString(components);
  }
  
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
