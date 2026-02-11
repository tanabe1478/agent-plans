import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SavedView } from '@ccplans/shared';
import { config } from '../config.js';

const VIEWS_FILE = '.views.json';

/**
 * Get default preset views
 */
export function getDefaultViews(): SavedView[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'preset-in-progress',
      name: 'In Progress',
      filters: { status: 'in_progress' },
      createdAt: now,
      isPreset: true,
    },
    {
      id: 'preset-high-priority',
      name: 'High Priority',
      filters: { priority: 'high' },
      createdAt: now,
      isPreset: true,
    },
    {
      id: 'preset-critical',
      name: 'Critical',
      filters: { priority: 'critical' },
      createdAt: now,
      isPreset: true,
    },
    {
      id: 'preset-todo',
      name: 'Todo',
      filters: { status: 'todo' },
      createdAt: now,
      isPreset: true,
    },
  ];
}

export class ViewService {
  private plansDir: string;

  constructor(plansDir = config.plansDir) {
    this.plansDir = plansDir;
  }

  private get viewsFilePath(): string {
    return join(this.plansDir, VIEWS_FILE);
  }

  /**
   * Read custom views from disk
   */
  private async readCustomViews(): Promise<SavedView[]> {
    try {
      const data = await readFile(this.viewsFilePath, 'utf-8');
      return JSON.parse(data) as SavedView[];
    } catch {
      return [];
    }
  }

  /**
   * Write custom views to disk
   */
  private async writeCustomViews(views: SavedView[]): Promise<void> {
    await writeFile(this.viewsFilePath, JSON.stringify(views, null, 2), 'utf-8');
  }

  /**
   * List all views (presets + custom)
   */
  async listViews(): Promise<SavedView[]> {
    const presets = getDefaultViews();
    const custom = await this.readCustomViews();
    return [...presets, ...custom];
  }

  /**
   * Get a single view by ID
   */
  async getView(id: string): Promise<SavedView | null> {
    const all = await this.listViews();
    return all.find((v) => v.id === id) ?? null;
  }

  /**
   * Create a new custom view
   */
  async createView(view: Omit<SavedView, 'id' | 'createdAt'>): Promise<SavedView> {
    const custom = await this.readCustomViews();
    const newView: SavedView = {
      ...view,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    custom.push(newView);
    await this.writeCustomViews(custom);
    return newView;
  }

  /**
   * Update an existing custom view
   */
  async updateView(id: string, update: Partial<SavedView>): Promise<SavedView> {
    const custom = await this.readCustomViews();
    const index = custom.findIndex((v) => v.id === id);
    if (index === -1) {
      throw new Error(`View not found: ${id}`);
    }

    const updated = { ...custom[index], ...update, id };
    custom[index] = updated;
    await this.writeCustomViews(custom);
    return updated;
  }

  /**
   * Delete a custom view
   */
  async deleteView(id: string): Promise<void> {
    const custom = await this.readCustomViews();
    const index = custom.findIndex((v) => v.id === id);
    if (index === -1) {
      throw new Error(`View not found: ${id}`);
    }
    custom.splice(index, 1);
    await this.writeCustomViews(custom);
  }
}

export const viewService = new ViewService();
