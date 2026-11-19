import { Injectable, inject } from '@angular/core';
import { FlowStateService, FormTarget } from './flow-state.service';

@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly state = inject(FlowStateService);

  readonly quickMenu = this.state.quickMenu;
  readonly formTarget = this.state.formTarget;
  readonly dragState = this.state.dragState;
  readonly declarationPanels = this.state.declarationPanels;
  readonly activeNodeId = this.state.activeNodeId;
  readonly hoveredNodeId = this.state.hoveredNodeId;

  activateNode(nodeId: string | null): void {
    const next = this.state.activeNodeId() === nodeId ? null : nodeId;
    this.state.activeNodeId.set(next);
  }

  hoverNode(nodeId: string | null): void {
    if (this.state.hoveredNodeId() === nodeId) return;
    this.state.hoveredNodeId.set(nodeId);
  }

  showQuickMenu(
    x: number,
    y: number,
    targetId: string,
    insertAfterId: string | null = null,
    replaceNodeId: string | null = null
  ): void {
    const margin = 12;
    const width = 258;
    const height = 430;
    const left = Math.max(margin, Math.min(x, window.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(y, window.innerHeight - height - margin));
    this.state.showQuickMenu(left, top, targetId, insertAfterId, replaceNodeId);
  }

  hideQuickMenu(): void {
    this.state.hideQuickMenu();
  }

  setFormTarget(partial: Partial<FormTarget>): void {
    this.state.setFormTarget(partial);
  }

  resetFormTarget(): void {
    this.state.resetFormTarget();
  }

  toggleDeclaration(kind: 'vars' | 'funcs'): void {
    this.state.toggleDeclaration(kind);
  }

  startDrag(nodeId: string, selectedIds: Set<string>, selectionActive: boolean): void {
    const draggingIds = selectionActive && selectedIds.has(nodeId)
      ? Array.from(selectedIds)
      : [nodeId];
    this.state.dragState.set({ draggingIds, dropTargetId: null, dropPosition: null });
  }

  setDropTarget(targetId: string | null, position: 'before' | 'after' | 'inside' | null): void {
    this.state.dragState.update(drag => ({ ...drag, dropTargetId: targetId, dropPosition: position }));
  }

  endDrag(): void {
    this.state.dragState.set({ draggingIds: [], dropTargetId: null, dropPosition: null });
  }
}
