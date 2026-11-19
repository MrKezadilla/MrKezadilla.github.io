import { Injectable, signal } from '@angular/core';
import { ASTRoot, ASTNode, Function, Variable, clone } from '../models/ast.model';

export interface HistorySnapshot {
  root: ASTRoot;
  variables: [string, Variable][];
  functions: [string, Function][];
}

export interface DeclarationPanels {
  vars: boolean;
  funcs: boolean;
}

export interface FormTarget {
  targetId: string;
  insertAfterId: string | null;
  replaceNodeId: string | null;
  editNodeId: string | null;
  editFuncId: string | null;
}

export interface DragState {
  draggingIds: string[];
  dropTargetId: string | null;
  dropPosition: 'before' | 'after' | 'inside' | null;
}

export interface QuickMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetId: string;
  insertAfterId: string | null;
  replaceNodeId: string | null;
}

function emptyRoot(): ASTRoot {
  return { id: 'root', type: 'program', children: [] };
}

/**
 * Única fuente de verdad de la aplicación. No inyecta ningún otro servicio,
 * de modo que rompe las dependencias circulares del diseño anterior.
 */
@Injectable({ providedIn: 'root' })
export class FlowStateService {
  readonly root = signal<ASTRoot>(emptyRoot());
  readonly variables = signal<Map<string, Variable>>(new Map());
  readonly functions = signal<Map<string, Function>>(new Map());

  readonly selectionActive = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());

  readonly activeNodeId = signal<string | null>(null);
  readonly hoveredNodeId = signal<string | null>(null);

  readonly declarationPanels = signal<DeclarationPanels>({ vars: true, funcs: true });

  readonly historyStack = signal<HistorySnapshot[]>([]);
  readonly historyPointer = signal(-1);

  readonly dragState = signal<DragState>({
    draggingIds: [],
    dropTargetId: null,
    dropPosition: null
  });

  readonly quickMenu = signal<QuickMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetId: 'root',
    insertAfterId: null,
    replaceNodeId: null
  });

  readonly formTarget = signal<FormTarget>({
    targetId: 'root',
    insertAfterId: null,
    replaceNodeId: null,
    editNodeId: null,
    editFuncId: null
  });

  touchAst(): void {
    this.root.update(root => ({ ...root }));
  }

  snapshot(): HistorySnapshot {
    return {
      root: clone(this.root()),
      variables: clone(Array.from(this.variables().entries())),
      functions: clone(Array.from(this.functions().entries()))
    };
  }

  restore(snapshot: HistorySnapshot): void {
    this.root.set(clone(snapshot.root));
    this.variables.set(new Map(clone(snapshot.variables)));
    this.functions.set(new Map(clone(snapshot.functions)));
    this.selectedIds.set(new Set());
    this.touchAst();
  }

  resetHistory(snapshot: HistorySnapshot): void {
    this.historyStack.set([snapshot]);
    this.historyPointer.set(0);
  }

  setFormTarget(partial: Partial<FormTarget>): void {
    this.formTarget.update(current => ({ ...current, ...partial }));
  }

  resetFormTarget(): void {
    this.formTarget.set({
      targetId: 'root',
      insertAfterId: null,
      replaceNodeId: null,
      editNodeId: null,
      editFuncId: null
    });
  }

  showQuickMenu(
    x: number,
    y: number,
    targetId: string,
    insertAfterId: string | null = null,
    replaceNodeId: string | null = null
  ): void {
    this.quickMenu.set({ visible: true, x, y, targetId, insertAfterId, replaceNodeId });
  }

  hideQuickMenu(): void {
    this.quickMenu.update(menu => ({ ...menu, visible: false }));
  }

  toggleDeclaration(kind: 'vars' | 'funcs'): void {
    this.declarationPanels.update(panels => ({ ...panels, [kind]: !panels[kind] }));
  }
}
