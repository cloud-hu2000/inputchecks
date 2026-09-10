import { siteConfig } from '../config';
export function track(name: string, params: Record<string, string | number | boolean> = {}) { if (siteConfig.gaId && typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, params); }
declare global { interface Window { gtag?: (command: string, name: string, params?: Record<string, unknown>) => void; } }
