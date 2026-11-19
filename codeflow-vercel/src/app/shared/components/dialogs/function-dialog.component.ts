import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FunctionService } from '../../../core/services/function.service';
import { VariableService } from '../../../core/services/variable.service';
import { Function } from '../../../core/models/ast.model';
import { NodeFormDialogComponent, NodeFormData } from './node-form-dialog.component';

@Component({
  selector: 'app-function-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Funciones</h2>
    <mat-dialog-content>
      <div class="cf-manager">
        <form (ngSubmit)="create()" class="cf-create-row">
          <input class="cf-input" type="text" name="newName" [(ngModel)]="newName" placeholder="Nombre de la función" autocomplete="off">
          <button mat-flat-button color="primary" type="submit">Crear</button>
        </form>

        @if (error) {
          <p class="cf-error">{{ error }}</p>
        }

        <div class="cf-list">
          @if (!functions().length) {
            <p class="cf-empty">Todavía no hay funciones.</p>
          } @else {
            @for (func of functions(); track func.id) {
              <div class="cf-list-item">
                <div class="cf-item-main">
                  <span class="cf-item-name">{{ func.name }}()</span>
                  @if (func.argVarId) {
                    <span class="cf-badge">arg: {{ varName(func.argVarId) }}</span>
                  }
                  @if (func.returnVarId) {
                    <span class="cf-badge cf-badge-alt">return: {{ varName(func.returnVarId) }}</span>
                  }
                  <span class="cf-item-meta">{{ func.children.length }} instrucción(es)</span>
                </div>
                <div class="cf-item-actions">
                  <button mat-button type="button" (click)="edit(func)">Editar</button>
                  <button mat-button color="warn" type="button" (click)="remove(func)">Eliminar</button>
                </div>
              </div>
            }
          }
        </div>

        <p class="cf-hint">El cuerpo de cada función aparece en la sección “Funciones” del editor, donde puedes agregar instrucciones.</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cf-manager { min-width: 480px; display: flex; flex-direction: column; gap: 12px; }
    @media (max-width: 620px) { .cf-manager { min-width: 0; } }
  `]
})
export class FunctionDialogComponent {
  private readonly functionService = inject(FunctionService);
  private readonly variableService = inject(VariableService);
  private readonly dialog = inject(MatDialog);

  readonly functions = this.functionService.functions;

  newName = '';
  error = '';

  create(): void {
    this.error = '';
    const result = this.functionService.create(this.newName);
    if (!result.success) {
      this.error = result.error || 'No se pudo crear la función';
      return;
    }
    this.newName = '';
  }

  edit(func: Function): void {
    const data: NodeFormData = {
      mode: 'def',
      targetId: 'root',
      insertAfterId: null,
      replaceNodeId: null,
      editNodeId: null,
      editFuncId: func.id
    };
    this.dialog.open(NodeFormDialogComponent, {
      data,
      width: '540px',
      maxWidth: '94vw',
      autoFocus: false,
      panelClass: 'cf-dialog'
    });
  }

  remove(func: Function): void {
    this.functionService.delete(func.id);
  }

  varName(id: string): string {
    return this.variableService.get(id)?.name || '?';
  }
}
