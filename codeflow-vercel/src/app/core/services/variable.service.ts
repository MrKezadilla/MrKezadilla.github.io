import { Injectable, computed, inject } from '@angular/core';
import {
  Variable,
  VariableType,
  generateId,
  getDefaultVal,
  validateNameWithReason
} from '../models/ast.model';
import { FlowStateService } from './flow-state.service';
import { AstService } from './ast.service';
import { HistoryService } from './history.service';

export interface ServiceResult {
  success: boolean;
  id?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class VariableService {
  private readonly state = inject(FlowStateService);
  private readonly ast = inject(AstService);
  private readonly history = inject(HistoryService);

  readonly variables = computed(() => Array.from(this.state.variables().values()));
  readonly hasVars = computed(() => this.state.variables().size > 0);

  private nameConflict(name: string, exceptId?: string): string | null {
    for (const variable of this.state.variables().values()) {
      if (variable.name === name && variable.id !== exceptId) {
        return 'Ya existe una variable con ese nombre';
      }
    }
    for (const func of this.state.functions().values()) {
      if (func.name === name) return 'Ya existe una función con ese nombre';
    }
    return null;
  }

  create(name: string, type: VariableType): ServiceResult {
    const reason = validateNameWithReason(name);
    if (reason) return { success: false, error: reason };

    const trimmed = name.trim();
    const conflict = this.nameConflict(trimmed);
    if (conflict) return { success: false, error: conflict };

    this.history.saveHistory();

    const id = generateId();
    const variable: Variable = { id, name: trimmed, type, value: getDefaultVal(type) };

    this.state.variables.update(map => {
      const next = new Map(map);
      next.set(id, variable);
      return next;
    });

    this.state.touchAst();
    return { success: true, id };
  }

  rename(id: string, name: string): ServiceResult {
    const variable = this.state.variables().get(id);
    if (!variable) return { success: false, error: 'Variable no encontrada' };

    const reason = validateNameWithReason(name);
    if (reason) return { success: false, error: reason };

    const trimmed = name.trim();
    const conflict = this.nameConflict(trimmed, id);
    if (conflict) return { success: false, error: conflict };

    this.history.saveHistory();
    this.state.variables.update(map => {
      const next = new Map(map);
      next.set(id, { ...variable, name: trimmed });
      return next;
    });
    this.state.touchAst();
    return { success: true };
  }

  updateValue(id: string, value: unknown): void {
    const variable = this.state.variables().get(id);
    if (!variable) return;

    this.history.saveHistory();
    this.state.variables.update(map => {
      const next = new Map(map);
      next.set(id, { ...variable, value: value as Variable['value'] });
      return next;
    });
    this.state.touchAst();
  }

  delete(id: string): void {
    const variable = this.state.variables().get(id);
    if (!variable) return;
    if (!confirm('¿Eliminar variable? Se quitarán también las referencias en el código.')) return;

    this.history.saveHistory();

    this.state.variables.update(map => {
      const next = new Map(map);
      next.delete(id);
      return next;
    });

    this.ast.purgeVarReferences(id);
    this.ast.pruneSelection();
    this.state.touchAst();
  }

  get(id: string): Variable | undefined {
    return this.state.variables().get(id);
  }

  getAll(): Variable[] {
    return Array.from(this.state.variables().values());
  }

  hasVariables(): boolean {
    return this.state.variables().size > 0;
  }
}
