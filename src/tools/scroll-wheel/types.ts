export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';
export interface WheelSample { timestamp: number; deltaX: number; deltaY: number; deltaMode: number; direction: Direction; expected: boolean; inputType?: 'mouse' | 'trackpad' | 'unknown'; }
export interface WheelTestSession { expectedDirection: 'up' | 'down'; startedAt: number; samples: WheelSample[]; totalEvents: number; expectedEvents: number; reverseEvents: number; reverseRate: number; longestGap: number; }
