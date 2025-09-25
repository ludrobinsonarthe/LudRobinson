// A simple event emitter for handling global application errors,
// particularly for surfacing Firestore permission errors to the UI.

type EventMap = {
  'permission-error': (error: any) => void;
};

class ErrorEmitter {
  private listeners: { [K in keyof EventMap]?: EventMap[K][] } = {};

  on<K extends keyof EventMap>(event: K, listener: EventMap[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof EventMap>(event: K, listener: EventMap[K]): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event]!.filter(l => l !== listener);
  }

  emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event]!.forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        console.error(`Error in error event listener for '${event}':`, e);
      }
    });
  }
}

export const errorEmitter = new ErrorEmitter();
