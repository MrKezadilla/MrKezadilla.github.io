import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VariableService } from '../../core/services/variable.service';
import { FunctionService } from '../../core/services/function.service';
import { FlowStateService } from '../../core/services/flow-state.service';
import { DialogService } from '../services/dialog.service';
import { VARIABLE_TYPE_LABELS, Variable, VariableType, Function } from '../../core/models/ast.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="cf-sidebar">
      <section class="cf-panel">
        <header class="cf-panel-head">
          <h3>Variables</h3>
          <button type="button" class="cf-mini" (click)="dialog.openVariables()">Administrar</button>
        </header>

        <form class="cf-quick-form" (ngSubmit)="createVariable()">
          <input class="cf-input" type="text" name="varName" [(ngModel)]="varName" placeholder="nombre" autocomplete="off">
          <select class="cf-input cf-select" name="varType" [(ngModel)]="varType">
            @for (type of types; track type.value) {
              <option [value]="type.value">{{ type.label }}</option>
            }
          </select>
          <button type="submit" class="cf-add-button" title="Crear variable">+</button>
        </form>

        @if (varError) {
          <p class="cf-error">{{ varError }}</p>
        }

        <ul class="cf-items">
          @if (!variables().length) {
            <li class="cf-items-empty">Sin variables todavía.</li>
          } @else {
            @for (variable of variables(); track variable.id) {
              <li class="cf-item">
                <span class="cf-chip" [ngClass]="'cf-type-' + variable.type">{{ typeLabel(variable.type) }}</span>
                <span class="cf-item-name">{{ variable.name }}</span>
                <button type="button" class="cf-item-x" title="Eliminar" (click)="removeVariable(variable)">×</button>
              </li>
            }
          }
        </ul>
      </section>

      <section class="cf-panel">
        <header class="cf-panel-head">
          <h3>Funciones</h3>
          <button type="button" class="cf-mini" (click)="dialog.openFunctions()">Administrar</button>
        </header>

        <form class="cf-quick-form" (ngSubmit)="createFunction()">
          <input class="cf-input" type="text" name="funcName" [(ngModel)]="funcName" placeholder="nombre_función" autocomplete="off">
          <button type="submit" class="cf-add-button" title="Crear función">+</button>
        </form>

        @if (funcError) {
          <p class="cf-error">{{ funcError }}</p>
        }

        <ul class="cf-items">
          @if (!functions().length) {
            <li class="cf-items-empty">Sin funciones todavía.</li>
          } @else {
            @for (func of functions(); track func.id) {
              <li class="cf-item">
                <span class="cf-chip cf-type-func">ƒ</span>
                <span class="cf-item-name">{{ functionLabel(func) }}</span>
                <button type="button" class="cf-item-x cf-item-edit" title="Editar" (click)="editFunction(func)">✎</button>
                <button type="button" class="cf-item-x" title="Eliminar" (click)="removeFunction(func)">×</button>
              </li>
            }
          }
        </ul>
      </section>

      <section class="cf-panel cf-panel-help">
        <h3>Atajos</h3>
        <ul class="cf-help">
          <li><kbd>Doble clic</kbd> edita una instrucción.</li>
          <li><kbd>+</kbd> agrega después; dentro de un bloque, agrega adentro.</li>
          <li><kbd>⠿</kbd> arrastra para reordenar.</li>
          <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> deshacer y rehacer.</li>
        </ul>
      </section>
    </aside>
  `,
  styles: [`
    .cf-sidebar {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px;
      width: 300px;
      min-width: 300px;
      overflow-y: auto;
      background: #ffffff;
      border-right: 1px solid #e2e8f0;
    }
    .cf-panel { display: flex; flex-direction: column; gap: 8px; }
    .cf-panel-head { display: flex; align-items: center; justify-content: space-between; }
    .cf-panel-head h3 {
      margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: #64748b;
    }
    .cf-mini {
      border: 0; background: transparent; color: #2563eb; font-size: 11px;
      font-weight: 600; cursor: pointer; padding: 2px 4px; border-radius: 4px;
    }
    .cf-mini:hover { background: #eff6ff; }
    .cf-quick-form { display: flex; gap: 6px; }
    .cf-quick-form .cf-input { flex: 1; min-width: 0; }
    .cf-select { flex: 0 0 86px; }
    .cf-add-button {
      flex: 0 0 34px; width: 34px; border: 0; border-radius: 8px;
      background: #2563eb; color: #fff; font-size: 18px; line-height: 1; cursor: pointer;
    }
    .cf-add-button:hover { background: #1d4ed8; }
    .cf-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .cf-items-empty { font-size: 12px; color: #94a3b8; font-style: italic; padding: 4px 2px; }
    .cf-item {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 8px; border-radius: 8px; background: #f8fafc; font-size: 13px;
    }
    .cf-item:hover { background: #f1f5f9; }
    .cf-item-name {
      flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: "Cascadia Mono", Consolas, monospace; color: #0f172a;
    }
    .cf-chip {
      flex: 0 0 auto; padding: 1px 6px; border-radius: 5px; font-size: 10px;
      font-weight: 700; background: #e2e8f0; color: #475569;
    }
    .cf-type-number { background: #dbeafe; color: #1d4ed8; }
    .cf-type-string { background: #ede9fe; color: #6d28d9; }
    .cf-type-boolean { background: #fef3c7; color: #b45309; }
    .cf-type-list { background: #ccfbf1; color: #0f766e; }
    .cf-type-func { background: #cffafe; color: #0e7490; }
    .cf-item-x {
      flex: 0 0 auto; border: 0; background: transparent; color: #94a3b8;
      font-size: 14px; cursor: pointer; border-radius: 4px; width: 20px; height: 20px;
    }
    .cf-item-edit { color: #2563eb; }
    .cf-item-x:hover { background: #e2e8f0; color: #dc2626; }
    .cf-item-edit:hover { color: #2563eb; background: #dbeafe; }
    .cf-error { margin: 0; font-size: 11px; color: #dc2626; }
    .cf-panel-help { border-top: 1px solid #e2e8f0; padding-top: 12px; }
    .cf-help { margin: 0; padding-left: 16px; font-size: 11.5px; color: #64748b; line-height: 1.7; }
    .cf-help kbd {
      padding: 0 4px; border: 1px solid #cbd5e1; border-radius: 4px;
      background: #f1f5f9; font-size: 10px; font-family: inherit;
    }
    @media (max-width: 860px) {
      .cf-sidebar { width: 100%; min-width: 0; border-right: 0; border-bottom: 1px solid #e2e8f0; }
    }
  `]
})
export class SidebarComponent {
  private readonly variableService = inject(VariableService);
  private readonly functionService = inject(FunctionService);
  private readonly state = inject(FlowStateService);
  readonly dialog = inject(DialogService);

  readonly variables = computed(() => Array.from(this.state.variables().values()));
  readonly functions = computed(() => Array.from(this.state.functions().values()));
  readonly types = Object.entries(VARIABLE_TYPE_LABELS)
    .map(([value, label]) => ({ value: value as VariableType, label }));

  varName = '';
  varType: VariableType = 'number';
  varError = '';

  funcName = '';
  funcError = '';

  createVariable(): void {
    this.varError = '';
    const result = this.variableService.create(this.varName, this.varType);
    if (!result.success) {
      this.varError = result.error || 'No se pudo crear la variable';
      return;
    }
    this.varName = '';
  }

  removeVariable(variable: Variable): void {
    this.variableService.delete(variable.id);
  }

  createFunction(): void {
    this.funcError = '';
    const result = this.functionService.create(this.funcName);
    if (!result.success) {
      this.funcError = result.error || 'No se pudo crear la función';
      return;
    }
    this.funcName = '';
  }

  editFunction(func: Function): void {
    this.dialog.editFunction(func.id);
  }

  removeFunction(func: Function): void {
    this.functionService.delete(func.id);
  }

  typeLabel(type: VariableType): string {
    return VARIABLE_TYPE_LABELS[type];
  }

  functionLabel(func: Function): string {
    const names = new Map(this.variables().map(variable => [variable.id, variable.name]));
    const argument = func.argVarId ? names.get(func.argVarId) || '?' : '';
    const returned = func.returnVarId ? ` → ${names.get(func.returnVarId) || '?'}` : '';
    return `${func.name}(${argument})${returned}`;
  }
}
