import { Injectable, computed, inject } from '@angular/core';
import { FlowStateService } from './flow-state.service';
import { AstService } from './ast.service';

@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly state = inject(FlowStateService);
  private readonly ast = inject(AstService);

  readonly active = computed(() => this.state.selectionActive());
  readonly selectedIds = computed(() => this.state.selectedIds());
  readonly count = computed(() => this.state.selectedIds().size);
  readonly hasSelection = computed(() => this.state.selectedIds().size > 0);

  toggleMode(): void {
    const next = !this.state.selectionActive();
    this.state.selectionActive.set(next);
    if (!next) this.clear();
  }

  toggleSelect(nodeId: string): void {
    if (!this.state.selectionActive() || !nodeId) return;
    const next = new Set(this.state.selectedIds());
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    this.state.selectedIds.set(next);
  }

  isSelected(nodeId: string): boolean {
    return this.state.selectedIds().has(nodeId);
  }

  clear(): void {
    this.state.selectedIds.set(new Set());
  }

  deleteSelected(): void {
    const ids = Array.from(this.state.selectedIds());
    if (!ids.length) return;
    if (!confirm(`¿Borrar ${ids.length} instrucción(es) y todo su contenido?`)) return;

    this.ast.deleteNodes(ids);
    this.clear();
  }

  pruneDeadIds(): void {
    this.ast.pruneSelection();
  }
}
