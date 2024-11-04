import Dexie, { Table } from 'dexie';

export interface ScheduledPage {
  id?: number;
  url: string;
  lastOpened: Date | null;
}

export interface Settings {
  id?: number;
  cronExpression: string;
  darkMode: boolean;
}

export class AppDatabase extends Dexie {
  pages!: Table<ScheduledPage>;
  settings!: Table<Settings>;

  constructor() {
    super('PageOpenerDB');
    this.version(1).stores({
      pages: '++id, url, lastOpened',
      settings: '++id, cronExpression, darkMode'
    });
  }
}

export const db = new AppDatabase();

// Initialize default settings if none exist
export async function initializeDefaults() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      cronExpression: '*/5 * * * *',
      darkMode: false
    });
  }
}
