import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ASTNode } from '../../core/models/ast.model';
import { UiService } from '../../core/services/ui.service';
import {
  NodeFormData,
  NodeFormDialogComponent,
  NodeFormMode
} from '../components/dialogs/node-form-dialog.component';
import { VariableDialogComponent } from '../components/dialogs/variable-dialog.component';
import { FunctionDialogComponent } from '../components/dialogs/function-dialog.component';
import { PythonPreviewDialogComponent } from '../components/dialogs/python-preview-dialog.component';

export interface OpenFormOptions {
  targetId?: string;
  insertAfterId?: string | null;
  replaceNodeId?: string | null;
  editNodeId?: string | null;
  editFuncId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(MatDialog);
  private readonly ui = inject(UiService);

  openNodeForm(mode: NodeFormMode, options: OpenFormOptions = {}): void {
    const current = this.ui.formTarget();
    const data: NodeFormData = {
      mode,
      targetId: options.targetId ?? current.targetId,
      insertAfterId: options.insertAfterId !== undefined ? options.insertAfterId : current.insertAfterId,
      replaceNodeId: options.replaceNodeId !== undefined ? options.replaceNodeId : current.replaceNodeId,
      editNodeId: options.editNodeId ?? null,
      editFuncId: options.editFuncId ?? null
    };

    this.dialog.open(NodeFormDialogComponent, {
      data,
      width: '560px',
      maxWidth: '94vw',
      maxHeight: '92vh',
      autoFocus: false,
      panelClass: 'cf-dialog'
    }).afterClosed().subscribe(() => {
      this.ui.resetFormTarget();
    });
  }

  editNode(node: ASTNode): void {
    const mode = this.modeForNode(node);
    if (!mode) return;
    this.openNodeForm(mode, { editNodeId: node.id });
  }

  editFunction(funcId: string): void {
    this.openNodeForm('def', { editFuncId: funcId });
  }

  openVariables(): void {
    this.dialog.open(VariableDialogComponent, {
      width: '560px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      panelClass: 'cf-dialog'
    });
  }

  openFunctions(): void {
    this.dialog.open(FunctionDialogComponent, {
      width: '580px',
      maxWidth: '94vw',
      maxHeight: '90vh',
      autoFocus: false,
      panelClass: 'cf-dialog'
    });
  }

  openPythonPreview(): void {
    this.dialog.open(PythonPreviewDialogComponent, {
      maxWidth: '94vw',
      maxHeight: '92vh',
      autoFocus: false,
      panelClass: 'cf-dialog'
    });
  }

  private modeForNode(node: ASTNode): NodeFormMode | null {
    switch (node.type) {
      case 'assign': return 'assign';
      case 'read': return 'read';
      case 'show': return 'show';
      case 'if': return 'if';
      case 'while':
      case 'loop': return 'while';
      case 'for': return 'for';
      case 'function_call': return 'call';
      default: return null;
    }
  }
}
