import { Injectable, inject } from '@angular/core';
import { ASTNode, ASTRoot } from '../models/ast.model';
import { FlowStateService } from './flow-state.service';
import { AstService } from './ast.service';
import { HistoryService } from './history.service';

export const STORAGE_KEY = 'cf_angular_v2';
const BACKUP_KEY = 'cf_angular_v2_backup';
const LEGACY_KEYS = ['cf_angular_v1', 'cf_app', 'cf_v05', 'cf_v04'];

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly state = inject(FlowStateService);
  private readonly ast = inject(AstService);
  private readonly history = inject(HistoryService);

  saveLocal(): void {
    try {
      const payload = JSON.stringify({
        version: 2,
        root: this.state.root(),
        variables: Array.from(this.state.variables().entries()),
        functions: Array.from(this.state.functions().entries())
      });
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.error('CodeFlow: no se pudo guardar en localStorage', error);
    }
  }

  loadLocal(): void {
    const raw = this.readRaw();
    if (!raw) {
      this.state.root.set({ id: 'root', type: 'program', children: [] });
      this.history.initialize();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, any>;
      const root = this.extractRoot(parsed);
      const variables = parsed['variables'];
      const functions = parsed['functions'];

      const ok = this.ast.importDocument({
        ast: root?.children || [],
        variables,
        functions
      }, false);

      if (!ok) throw new Error('Documento inválido');
      this.history.initialize();
    } catch (error) {
      console.error('CodeFlow: datos locales corruptos, se guardó una copia de seguridad', error);
      try {
        localStorage.setItem(BACKUP_KEY, raw);
      } catch {
        // Ignorar fallos de almacenamiento.
      }
      this.state.root.set({ id: 'root', type: 'program', children: [] });
      this.state.variables.set(new Map());
      this.state.functions.set(new Map());
      this.history.initialize();
    }
  }

  /**
   * Recarga el estado cuando otra pestaña escribe en localStorage.
   * No vuelve a guardar para evitar bucles de sincronización.
   */
  syncFromStorage(raw: string): void {
    try {
      const parsed = JSON.parse(raw) as Record<string, any>;
      const root = this.extractRoot(parsed);
      if (!root) return;

      const incoming = JSON.stringify({
        root,
        variables: parsed['variables'] ?? [],
        functions: parsed['functions'] ?? []
      });
      const current = JSON.stringify({
        root: this.state.root(),
        variables: Array.from(this.state.variables().entries()),
        functions: Array.from(this.state.functions().entries())
      });

      if (incoming === current) return;

      const ok = this.ast.importDocument({
        ast: root.children,
        variables: parsed['variables'],
        functions: parsed['functions']
      }, false);

      if (ok) this.history.initialize();
    } catch (error) {
      console.error('CodeFlow: no se pudo sincronizar el estado desde otra pestaña', error);
    }
  }

  private readRaw(): string | null {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return current;

      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(key);
          return legacy;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  private extractRoot(parsed: Record<string, any>): ASTRoot | null {
    const candidate = parsed['root'] ?? null;
    if (candidate && typeof candidate === 'object' && Array.isArray(candidate.children)) {
      return this.sanitizeRoot(candidate);
    }

    if (Array.isArray(parsed['ast'])) {
      return { id: 'root', type: 'program', children: this.sanitizeNodes(parsed['ast']) };
    }

    return null;
  }

  private sanitizeRoot(root: any): ASTRoot {
    return {
      id: typeof root.id === 'string' ? root.id : 'root',
      type: 'program',
      children: this.sanitizeNodes(root.children)
    };
  }

  private sanitizeNodes(nodes: unknown): ASTNode[] {
    if (!Array.isArray(nodes)) return [];
    return nodes
      .filter((node): node is Record<string, any> =>
        !!node && typeof node === 'object' && typeof (node as Record<string, any>)['type'] === 'string'
      )
      .map(node => this.sanitizeNode(node));
  }

  private sanitizeNode(node: Record<string, any>): ASTNode {
    const sanitized: ASTNode = {
      id: typeof node['id'] === 'string' ? node['id'] : 'node_' + Math.random().toString(36).slice(2),
      type: node['type'],
      parentId: typeof node['parentId'] === 'string' ? node['parentId'] : null,
      data: node['data'] && typeof node['data'] === 'object' ? node['data'] : {}
    };

    if (Array.isArray(node['children'])) {
      sanitized.children = this.sanitizeNodes(node['children']);
    }
    if (Array.isArray(node['elseChildren'])) {
      sanitized.elseChildren = this.sanitizeNodes(node['elseChildren']);
    } else if (node['elseChildren'] === null) {
      sanitized.elseChildren = null;
    }

    return sanitized;
  }
}
