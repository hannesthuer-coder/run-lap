import { TurnType } from './routeNavigation.service';

interface VoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
}

interface QueuedAnnouncement {
  message: string;
  priority: 'normal' | 'high';
  timestamp: number;
}

class VoiceNavigationService {
  private enabled: boolean = true;
  private speaking: boolean = false;
  private queue: QueuedAnnouncement[] = [];
  private lastAnnouncements: Map<string, number> = new Map();
  private cooldownMs: number = 8000; // Increased from 5000 for less frequent announcements
  private settings: VoiceSettings = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  };

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancelAll();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private cancelAll(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    this.queue = [];
    this.speaking = false;
  }

  private canAnnounce(key: string): boolean {
    const lastTime = this.lastAnnouncements.get(key);
    if (!lastTime) return true;
    return Date.now() - lastTime > this.cooldownMs;
  }

  private markAnnounced(key: string): void {
    this.lastAnnouncements.set(key, Date.now());
  }

  speak(message: string, priority: 'normal' | 'high' = 'normal'): void {
    if (!this.enabled || !this.isSupported()) return;

    const announcement: QueuedAnnouncement = {
      message,
      priority,
      timestamp: Date.now(),
    };

    if (priority === 'high') {
      // High priority: cancel current speech and speak immediately
      window.speechSynthesis.cancel();
      this.queue = [announcement, ...this.queue.filter(a => a.priority === 'high')];
    } else {
      this.queue.push(announcement);
    }

    this.processQueue();
  }

  private processQueue(): void {
    if (this.speaking || this.queue.length === 0) return;

    const announcement = this.queue.shift();
    if (!announcement) return;

    this.speaking = true;

    const utterance = new SpeechSynthesisUtterance(announcement.message);
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    utterance.volume = this.settings.volume;

    utterance.onend = () => {
      this.speaking = false;
      this.processQueue();
    };

    utterance.onerror = () => {
      this.speaking = false;
      this.processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }

  private getTurnName(turnType: TurnType): string {
    switch (turnType) {
      case 'sharp-left':
        return 'sharp left';
      case 'left':
        return 'left';
      case 'slight-left':
        return 'slight left';
      case 'straight':
        return 'straight';
      case 'slight-right':
        return 'slight right';
      case 'right':
        return 'right';
      case 'sharp-right':
        return 'sharp right';
      case 'u-turn':
        return 'U-turn';
      case 'finish':
        return 'finish';
      default:
        return '';
    }
  }

  private formatDistance(meters: number): string {
    if (meters < 100) {
      return `${Math.round(meters / 10) * 10} meters`;
    }
    return `${Math.round(meters / 100) * 100} meters`;
  }

  announceUpcomingTurn(turnType: TurnType, distanceToTurn: number): void {
    // Skip "continue straight" announcements entirely - they're just noise
    if (turnType === 'straight') {
      return;
    }

    // Reduced thresholds: only announce at 50m and 15m
    // This gives 2 announcements per turn instead of 3
    const thresholds = [50, 15];
    
    for (const threshold of thresholds) {
      // Wider window for detection (threshold - 20 instead of threshold - 15)
      if (distanceToTurn <= threshold && distanceToTurn > threshold - 20) {
        const key = `turn-${threshold}`;
        if (this.canAnnounce(key)) {
          this.markAnnounced(key);
          
          const turnName = this.getTurnName(turnType);
          if (turnType === 'finish') {
            this.speak(`Finish line in ${this.formatDistance(distanceToTurn)}`);
          } else {
            this.speak(`Turn ${turnName} in ${this.formatDistance(distanceToTurn)}`);
          }
        }
        break;
      }
    }
  }

  announceOffRoute(): void {
    const key = 'off-route';
    if (this.canAnnounce(key)) {
      this.markAnnounced(key);
      this.speak('You are off route. Please return to the path.', 'high');
    }
  }

  announceBackOnRoute(): void {
    const key = 'back-on-route';
    if (this.canAnnounce(key)) {
      this.markAnnounced(key);
      this.speak('Back on route.');
    }
  }

  announceCompletion(): void {
    const key = 'completion';
    if (this.canAnnounce(key)) {
      this.markAnnounced(key);
      this.speak('Run complete! Great job!', 'high');
    }
  }

  announceStart(): void {
    this.speak('Starting navigation. Have a great run!');
  }

  resetCooldowns(): void {
    this.lastAnnouncements.clear();
  }
}

// Export singleton instance
export const voiceNavigationService = new VoiceNavigationService();
