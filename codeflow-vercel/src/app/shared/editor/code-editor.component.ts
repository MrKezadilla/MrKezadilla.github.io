import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlowStateService } from '../../core/services/flow-state.service';
import { AstService } from '../../core/services/ast.service';
import { UiService } from '../../core/services/ui.service';
import { SelectionService } from '../../core/services/selection.service';
import { DialogService } from '../services/dialog.service';
import { EditorLine, EditorModelService } from './editor-model.service';
import { ASTNode } from '../../core/models/ast.model';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './code-editor.component.html',
  styleUrl: './code-editor.component.scss'
})
export class CodeEditorComponent {
  private readonly state = inject(FlowStateService);
  private readonly ast = inject(AstService);
  private readonly ui = inject(UiService);
  private readonly selection = inject(SelectionService);
  private readonly dialog = inject(DialogService);
  private readonly editorModel = inject(EditorModelService);

  readonly selectionActive = this.state.selectionActive;
  readonly selectedIds = this.state.selectedIds;
  readonly dragState = this.state.dragState;

  readonly lines = computed(() => this.editorModel.build(
    this.state.root().children,
    Array.from(this.state.functions().values()),
    Array.from(this.state.variables().values())
  ));

  constructor() {
    effect(() => {
      const nodeId = this.ui.activeNodeId();
      if (!nodeId) return;
      queueMicrotask(() => {
        const element = document.querySelector(`[data-editor-node="${nodeId}"]`);
        if (element instanceof HTMLElement) {
          element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    });
  }

  isSelected(line: EditorLine): boolean {
    return !!line.nodeId && this.selectedIds().has(line.nodeId);
  }

  isActive(line: EditorLine): boolean {
    return !!line.nodeId && this.ui.activeNodeId() === line.nodeId;
  }

  isHovered(line: EditorLine): boolean {
    return !!line.nodeId && this.ui.hoveredNodeId() === line.nodeId;
  }

  onRowEnter(line: EditorLine): void {
    if (line.nodeId) this.ui.hoverNode(line.nodeId);
  }

  onRowLeave(line: EditorLine): void {
    this.ui.hoverNode(null);
  }

  isDropEligible(line: EditorLine): boolean {
    return line.kind === 'node' || line.kind === 'else' || line.kind === 'function';
  }

  isDrop(line: EditorLine, position: 'before' | 'after' | 'inside'): boolean {
    const drag = this.dragState();
    if (!drag.dropTargetId || !this.isDropEligible(line)) return false;
    if (this.dropTargetId(line) !== drag.dropTargetId) return false;
    if (line.empty || line.kind === 'function' || line.kind === 'else') {
      return drag.dropPosition === 'inside' && position === 'inside';
    }
    return drag.dropPosition === position;
  }

  onRowClick(event: MouseEvent, line: EditorLine): void {
    if (!line.nodeId) return;

    if (this.selectionActive()) {
      this.selection.toggleSelect(line.nodeId);
      return;
    }

    if (event.detail === 1) this.ui.activateNode(line.nodeId);
  }

  onRowDoubleClick(event: MouseEvent, line: EditorLine): void {
    if (!line.canEdit || !line.nodeId || this.selectionActive()) return;
    event.stopPropagation();
    this.editNode(line.nodeId);
  }

  openPlus(event: MouseEvent, line: EditorLine): void {
    event.stopPropagation();
    event.preventDefault();
    const inside = line.container || line.kind === 'function' || line.kind === 'else' || line.empty;
    this.openAddMenuAt(event.clientX, event.clientY, line, inside);
  }

  openAddMenu(event: MouseEvent, line: EditorLine, inside: boolean): void {
    event.stopPropagation();
    event.preventDefault();
    this.openAddMenuAt(event.clientX, event.clientY, line, inside);
  }

  openAddMenuFromKeyboard(event: Event, line: EditorLine): void {
    event.stopPropagation();
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.openAddMenuAt(rect.left + rect.width / 2, rect.top + 32, line, true);
  }

  editLine(event: MouseEvent, line: EditorLine): void {
    event.stopPropagation();
    if (!line.nodeId) return;
    this.editNode(line.nodeId);
  }

  openReplaceMenu(event: MouseEvent, line: EditorLine): void {
    event.stopPropagation();
    event.preventDefault();
    if (!line.nodeId) return;
    this.ui.showQuickMenu(event.clientX, event.clientY, line.parentTargetId, null, line.nodeId);
  }

  removeLine(event: MouseEvent, line: EditorLine): void {
    event.stopPropagation();
    if (!line.nodeId) return;
    this.ast.deleteNode(line.nodeId);
  }

  dragStart(event: DragEvent, line: EditorLine): void {
    if (!line.nodeId || !line.canDrag) {
      event.preventDefault();
      return;
    }
    this.ui.startDrag(line.nodeId, this.selectedIds(), this.selectionActive());
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', line.nodeId);
    }
  }

  dragOver(event: DragEvent, line: EditorLine): void {
    const drag = this.dragState();
    if (!drag.draggingIds.length || !this.isDropEligible(line)) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    const ratio = this.ratioFor(event, line);
    const targetId = this.dropTargetId(line);
    const position = this.positionFor(line, ratio);

    if (drag.dropTargetId !== targetId || drag.dropPosition !== position) {
      this.ui.setDropTarget(targetId, position);
    }
  }

  dragLeave(event: DragEvent, line: EditorLine): void {
    const drag = this.dragState();
    if (drag.dropTargetId === this.dropTargetId(line)) {
      this.ui.setDropTarget(null, null);
    }
  }

  drop(event: DragEvent, line: EditorLine): void {
    if (!this.isDropEligible(line)) return;
    event.preventDefault();
    event.stopPropagation();

    const drag = this.dragState();
    if (!drag.draggingIds.length) return;

    const targetId = this.dropTargetId(line);
    const position = this.positionFor(line, this.ratioFor(event, line));
    this.ast.moveNodes(drag.draggingIds, targetId, position);
    this.ui.endDrag();
  }

  dragEnd(): void {
    this.ui.endDrag();
  }

  private editNode(nodeId: string): void {
    const node = this.ast.findNode(nodeId) as ASTNode | null;
    if (!node) return;
    this.dialog.editNode(node);
  }

  private openAddMenuAt(x: number, y: number, line: EditorLine, inside: boolean): void {
    let targetId: string;
    let insertAfter: string | null;

    if (line.empty) {
      targetId = line.parentTargetId;
      insertAfter = null;
    } else if (line.kind === 'else') {
      targetId = line.parentTargetId;
      insertAfter = null;
    } else if (inside) {
      targetId = line.nodeId || line.parentTargetId;
      insertAfter = null;
    } else {
      targetId = line.parentTargetId;
      insertAfter = line.insertAfterId;
    }

    this.ui.showQuickMenu(x, y, targetId, insertAfter, null);
  }

  private dropTargetId(line: EditorLine): string {
    if (line.empty || line.kind === 'function' || line.kind === 'else') {
      return line.parentTargetId;
    }
    return line.nodeId || line.parentTargetId;
  }

  private ratioFor(event: DragEvent, line: EditorLine): number {
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    if (!rect.height) return 0.5;
    return Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  }

  private positionFor(line: EditorLine, ratio: number): 'before' | 'after' | 'inside' {
    if (line.empty || line.kind === 'function' || line.kind === 'else') return 'inside';
    if (line.container) {
      if (ratio < 0.3) return 'before';
      if (ratio > 0.7) return 'after';
      return 'inside';
    }
    return ratio < 0.5 ? 'before' : 'after';
  }
}
