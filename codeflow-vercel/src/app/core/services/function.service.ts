import { Injectable, computed, inject } from '@angular/core';
import { Function, generateId, validateNameWithReason } from '../models/ast.model';
import { FlowStateService } from './flow-state.service';
import { AstService } from './ast.service';
import { HistoryService } from './history.service';

export interface FunctionResult {
  success: boolean;
  id?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class FunctionService {
  private readonly state = inject(FlowStateService);
  private readonly ast = inject(AstService);
  private readonly history = inject(HistoryService);

  readonly functions = computed(() => Array.from(this.state.functions().values()));

  private nameConflict(name: string, exceptId?: string): string | null {
    for (const func of this.state.functions().values()) {
      if (func.name === name && func.id !== exceptId) return 'Ya existe una función con ese nombre';
    }
    for (const variable of this.state.variables().values()) {
      if (variable.name === name) return 'Ya existe una variable con ese nombre';
    }
    return null;
  }

  create(name: string): FunctionResult {
    return this.createFull(name, null, null);
  }

  createFull(name: string, argVarId: string | null, returnVarId: string | null): FunctionResult {
    const reason = validateNameWithReason(name);
    if (reason) return { success: false, error: reason };

    const trimmed = name.trim();
    const conflict = this.nameConflict(trimmed);
    if (conflict) return { success: false, error: conflict };

    this.history.saveHistory();

    const id = generateId();
    const func: Function = {
      id,
      name: trimmed,
      argVarId,
      returnVarId,
      children: []
    };

    this.state.functions.update(map => {
      const next = new Map(map);
      next.set(id, func);
      return next;
    });

    this.state.touchAst();
    return { success: true, id };
  }

  update(id: string, partial: Partial<Function>): FunctionResult {
    const func = this.state.functions().get(id);
    if (!func) return { success: false, error: 'Función no encontrada' };

    let newName: string | null = null;
    if (partial.name !== undefined) {
      const reason = validateNameWithReason(partial.name);
      if (reason) return { success: false, error: reason };
      const trimmed = partial.name.trim();
      const conflict = this.nameConflict(trimmed, id);
      if (conflict) return { success: false, error: conflict };
      newName = trimmed;
    }

    this.history.saveHistory();

    const oldName = func.name;
    const updated: Function = {
      ...func,
      argVarId: partial.argVarId !== undefined ? partial.argVarId : func.argVarId,
      returnVarId: partial.returnVarId !== undefined ? partial.returnVarId : func.returnVarId,
      children: partial.children !== undefined ? partial.children : func.children,
      name: newName ?? func.name
    };

    this.state.functions.update(map => {
      const next = new Map(map);
      next.set(id, updated);
      return next;
    });

    if (newName !== null && newName !== oldName) {
      this.ast.renameFuncReferences(oldName, newName);
    }

    this.state.touchAst();
    return { success: true };
  }

  delete(id: string): void {
    const func = this.state.functions().get(id);
    if (!func) return;
    if (!confirm('¿Eliminar función? Se quitarán también las llamadas en el código.')) return;

    this.history.saveHistory();

    this.state.functions.update(map => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });

    this.ast.purgeFuncReferences(func.name);
    this.ast.pruneSelection();
    this.state.touchAst();
  }

  get(id: string): Function | undefined {
    return this.state.functions().get(id);
  }

  getByName(name: string): Function | undefined {
    for (const func of this.state.functions().values()) {
      if (func.name === name) return func;
    }
    return undefined;
  }

  getAll(): Function[] {
    return Array.from(this.state.functions().values());
  }
}
