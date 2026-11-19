import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { VariableService } from '../../../core/services/variable.service';
import { VARIABLE_TYPE_LABELS, Variable, VariableType } from '../../../core/models/ast.model';

@Component({
  selector: 'app-variable-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Variables</h2>
    <mat-dialog-content>
      <div class="cf-manager">
        <form (ngSubmit)="create()" class="cf-create-row">
          <input class="cf-input" type="text" name="newName" [(ngModel)]="newName" placeholder="Nombre de la variable" autocomplete="off">
          <select class="cf-input cf-type" name="newType" [(ngModel)]="newType">
            @for (type of types; track type.value) {
              <option [value]="type.value">{{ type.label }}</option>
            }
          </select>
          <button mat-flat-button color="primary" type="submit">Crear</button>
        </form>

        @if (error) {
          <p class="cf-error">{{ error }}</p>
        }

        <div class="cf-list">
          @if (!variables().length) {
            <p class="cf-empty">Todavía no hay variables.</p>
          } @else {
            @for (variable of variables(); track variable.id) {
              <div class="cf-list-item">
                @if (editingId === variable.id) {
                  <input class="cf-input" type="text" [(ngModel)]="editingName" [name]="'edit-' + variable.id" autocomplete="off">
                  <div class="cf-item-actions">
                    <button mat-button type="button" (click)="saveRename(variable)">Guardar</button>
                    <button mat-button type="button" (click)="cancelRename()">Cancelar</button>
                  </div>
                } @else {
                  <div class="cf-item-main">
                    <span class="cf-item-name">{{ variable.name }}</span>
                    <span class="cf-badge">{{ typeLabel(variable.type) }}</span>
                    <span class="cf-item-meta">valor inicial: {{ displayValue(variable) }}</span>
                  </div>
                  <div class="cf-item-actions">
                    <button mat-button type="button" (click)="startRename(variable)">Renombrar</button>
                    <button mat-button color="warn" type="button" (click)="remove(variable)">Eliminar</button>
                  </div>
                }
              </div>
            }
          }
        </div>

        <p class="cf-hint">Las variables se declaran al inicio del programa generado.</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cf-manager { min-width: 460px; display: flex; flex-direction: column; gap: 12px; }
    @media (max-width: 600px) { .cf-manager { min-width: 0; } }
  `]
})
export class VariableDialogComponent {
  private readonly variableService = inject(VariableService);
  private readonly dialogRef = inject(MatDialogRef<VariableDialogComponent>);

  readonly variables = this.variableService.variables;
  readonly types = Object.entries(VARIABLE_TYPE_LABELS)
    .map(([value, label]) => ({ value: value as VariableType, label }));

  newName = '';
  newType: VariableType = 'number';
  error = '';

  editingId: string | null = null;
  editingName = '';

  create(): void {
    this.error = '';
    const result = this.variableService.create(this.newName, this.newType);
    if (!result.success) {
      this.error = result.error || 'No se pudo crear la variable';
      return;
    }
    this.newName = '';
    this.dialogRef.updateSize('auto');
  }

  startRename(variable: Variable): void {
    this.editingId = variable.id;
    this.editingName = variable.name;
    this.error = '';
  }

  saveRename(variable: Variable): void {
    this.error = '';
    const result = this.variableService.rename(variable.id, this.editingName);
    if (!result.success) {
      this.error = result.error || 'No se pudo renombrar la variable';
      return;
    }
    this.cancelRename();
  }

  cancelRename(): void {
    this.editingId = null;
    this.editingName = '';
  }

  remove(variable: Variable): void {
    this.variableService.delete(variable.id);
  }

  typeLabel(type: VariableType): string {
    return VARIABLE_TYPE_LABELS[type];
  }

  displayValue(variable: Variable): string {
    if (variable.type === 'boolean') return variable.value ? 'True' : 'False';
    if (variable.type === 'list') return '[]';
    if (variable.type === 'string') return `"${variable.value}"`;
    return String(variable.value);
  }
}
