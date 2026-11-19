import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import {
  ASTNode,
  COMPARISON_OPERATORS,
  BOOLEAN_COMPARISON_OPERATORS,
  OPERATORS_BY_TYPE,
  ShowPart,
  Variable,
  VariableType,
  safeInt,
  safeNumber
} from '../../../core/models/ast.model';
import { AstService } from '../../../core/services/ast.service';
import { VariableService } from '../../../core/services/variable.service';
import { FunctionService } from '../../../core/services/function.service';
import { UiService } from '../../../core/services/ui.service';

export type NodeFormMode = 'assign' | 'read' | 'show' | 'if' | 'while' | 'for' | 'def' | 'call';

export interface NodeFormData {
  mode: NodeFormMode;
  targetId: string;
  insertAfterId: string | null;
  replaceNodeId: string | null;
  editNodeId: string | null;
  editFuncId: string | null;
}

@Component({
  selector: 'app-node-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ title }}</h2>
    <mat-dialog-content>
      <form id="nodeForm" (ngSubmit)="save()" class="cf-form">
        @if (error) {
          <p class="cf-error">{{ error }}</p>
        }

        @switch (mode) {
          @case ('assign') {
            <label class="cf-label">Variable destino</label>
            <select class="cf-input" name="targetVarId" [(ngModel)]="targetVarId" (ngModelChange)="onTargetChange()">
              <option value="">-- Elegir --</option>
              @for (variable of variables(); track variable.id) {
                <option [value]="variable.id">{{ variable.name }} ({{ typeLabel(variable.type) }})</option>
              }
            </select>
            @if (!variables().length) {
              <p class="cf-hint">No hay variables creadas. Crea una primero.</p>
            }

            <div class="cf-grid-2">
              <div>
                <label class="cf-label">Operador</label>
                <select class="cf-input" name="operator" [(ngModel)]="operator">
                  @for (item of operators(); track item.value) {
                    <option [value]="item.value">{{ item.label }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="cf-label">Origen del valor</label>
                <select class="cf-input" name="valueKind" [(ngModel)]="valueKind">
                  <option value="literal">Constante</option>
                  <option value="variable">Variable</option>
                </select>
              </div>
            </div>

            @if (valueKind === 'literal') {
              <label class="cf-label">Valor</label>
              @if (targetVariable()?.type === 'boolean') {
                <select class="cf-input" name="literalValue" [(ngModel)]="literalValue">
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              } @else if (targetVariable()?.type === 'number') {
                <input class="cf-input" type="number" step="any" name="literalValue" [(ngModel)]="literalValue" placeholder="0">
              } @else if (targetVariable()?.type === 'list') {
                <input class="cf-input" type="text" name="literalValue" [ngModel]="'[]'" readonly>
              } @else {
                <input class="cf-input" type="text" name="literalValue" [(ngModel)]="literalValue" placeholder="Texto...">
              }
            } @else {
              <label class="cf-label">Variable origen</label>
              <select class="cf-input" name="sourceVarId" [(ngModel)]="sourceVarId">
                <option value="">-- Elegir --</option>
                @for (variable of sourceVariables(); track variable.id) {
                  <option [value]="variable.id">{{ variable.name }}</option>
                }
              </select>
              @if (!sourceVariables().length) {
                <p class="cf-hint">No hay variables del mismo tipo.</p>
              }
            }
          }

          @case ('read') {
            <label class="cf-label">Guardar la entrada en</label>
            <select class="cf-input" name="targetVarId" [(ngModel)]="targetVarId">
              <option value="">-- Elegir --</option>
              @for (variable of variables(); track variable.id) {
                <option [value]="variable.id">{{ variable.name }} ({{ typeLabel(variable.type) }})</option>
              }
            </select>
            @if (!variables().length) {
              <p class="cf-hint">No hay variables creadas. Crea una primero.</p>
            }

            <label class="cf-label">Mensaje al usuario (opcional)</label>
            <input class="cf-input" type="text" name="prompt" [(ngModel)]="prompt" placeholder="Ej: Ingresa tu nombre:">
          }

          @case ('show') {
            <div class="cf-parts-box">
              @if (!showParts.length) {
                <p class="cf-empty">Aún no hay partes en el mensaje</p>
              } @else {
                <div class="cf-chips">
                  @for (part of showParts; track $index) {
                    <span class="cf-chip" [class.cf-chip-var]="part.type === 'variable'">
                      {{ partLabel(part) }}
                      <button type="button" class="cf-chip-remove" (click)="removePart($index)">×</button>
                    </span>
                  }
                </div>
              }
            </div>

            <div class="cf-inline">
              <input class="cf-input" type="text" name="textInput" [(ngModel)]="textInput" placeholder="Texto a agregar..."
                (keydown.enter)="addTextPart(); $event.preventDefault()">
              <button mat-stroked-button type="button" (click)="addTextPart()">Añadir texto</button>
            </div>

            <div class="cf-inline">
              <select class="cf-input" name="selectedVarId" [(ngModel)]="selectedVarId">
                <option value="">-- Variable --</option>
                @for (variable of variables(); track variable.id) {
                  <option [value]="variable.id">{{ variable.name }}</option>
                }
              </select>
              <button mat-stroked-button type="button" (click)="addVarPart()">Añadir variable</button>
            </div>

            <div class="cf-inline">
              <button mat-button type="button" (click)="showParts = []">Limpiar</button>
              <button mat-button type="button" (click)="removeLastPart()">Deshacer último</button>
            </div>
          }

          @case ('if') {
            <ng-container *ngTemplateOutlet="conditionForm"></ng-container>
            <label class="cf-check">
              <input type="checkbox" name="hasElse" [(ngModel)]="hasElse">
              <span>Incluir rama <strong>else</strong></span>
            </label>
          }

          @case ('while') {
            <label class="cf-check">
              <input type="checkbox" name="isInfinite" [(ngModel)]="isInfinite" (ngModelChange)="onInfiniteChange()">
              <span>Bucle infinito (<code>while True</code>)</span>
            </label>
            @if (!isInfinite) {
              <ng-container *ngTemplateOutlet="conditionForm"></ng-container>
            }
          }

          @case ('for') {
            <div class="cf-inline">
              <label class="cf-check">
                <input type="radio" name="forType" value="range" [(ngModel)]="forType">
                <span>Rango</span>
              </label>
              <label class="cf-check">
                <input type="radio" name="forType" value="iterable" [(ngModel)]="forType">
                <span>Lista / texto</span>
              </label>
            </div>

            <label class="cf-label">Nombre del iterador</label>
            <input class="cf-input" type="text" name="iterName" [(ngModel)]="iterName" placeholder="i">

            @if (forType === 'range') {
              <label class="cf-label">Fin del rango</label>
              <input class="cf-input" type="number" min="0" step="1" name="endValue" [(ngModel)]="endValue" placeholder="10">
            } @else {
              <label class="cf-label">Colección a recorrer</label>
              <select class="cf-input" name="iterableVarId" [(ngModel)]="iterableVarId">
                <option value="">-- Elegir --</option>
                @for (variable of listVariables(); track variable.id) {
                  <option [value]="variable.id">{{ variable.name }}</option>
                }
              </select>
              @if (!listVariables().length) {
                <p class="cf-hint">No hay variables de tipo Lista. Crea una primero.</p>
              }
            }
          }

          @case ('def') {
            <label class="cf-label">Nombre de la función</label>
            <input class="cf-input" type="text" name="funcName" [(ngModel)]="funcName" placeholder="Ej: calcular_total">

            <label class="cf-label">Argumento (opcional)</label>
            <select class="cf-input" name="argVarId" [(ngModel)]="argVarId">
              <option value="">-- Sin argumento --</option>
              @for (variable of variables(); track variable.id) {
                <option [value]="variable.id">{{ variable.name }}</option>
              }
            </select>

            <label class="cf-label">Retorno (opcional)</label>
            <select class="cf-input" name="returnVarId" [(ngModel)]="returnVarId">
              <option value="">-- Sin retorno --</option>
              @for (variable of variables(); track variable.id) {
                <option [value]="variable.id">{{ variable.name }}</option>
              }
            </select>
          }

          @case ('call') {
            <label class="cf-label">Función a ejecutar</label>
            <select class="cf-input" name="funcId" [(ngModel)]="funcId">
              <option value="">-- Elegir --</option>
              @for (func of functions(); track func.id) {
                <option [value]="func.id">{{ func.name }}()</option>
              }
            </select>
            @if (!functions().length) {
              <p class="cf-hint">No hay funciones creadas.</p>
            }

            <label class="cf-label">Argumento (opcional)</label>
            <select class="cf-input" name="callArgVarId" [(ngModel)]="argVarId">
              <option value="">-- Ninguno --</option>
              @for (variable of variables(); track variable.id) {
                <option [value]="variable.id">{{ variable.name }}</option>
              }
            </select>

            <label class="cf-label">Guardar retorno en (opcional)</label>
            <select class="cf-input" name="callTargetVarId" [(ngModel)]="targetVarId">
              <option value="">-- No guardar --</option>
              @for (variable of variables(); track variable.id) {
                <option [value]="variable.id">{{ variable.name }}</option>
              }
            </select>
          }
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Cancelar</button>
      <button mat-flat-button color="primary" type="submit" form="nodeForm">{{ editNodeId ? 'Guardar cambios' : 'Guardar' }}</button>
    </mat-dialog-actions>

    <ng-template #conditionForm>
      <div class="cf-grid-3">
        <div>
          <label class="cf-label">Variable</label>
          <select class="cf-input" name="leftVarId" [(ngModel)]="leftVarId" (ngModelChange)="onLeftChange()">
            <option value="">-- Elegir --</option>
            @for (variable of variables(); track variable.id) {
              <option [value]="variable.id">{{ variable.name }}</option>
            }
          </select>
          @if (!variables().length) {
            <p class="cf-hint">No hay variables creadas.</p>
          }
        </div>
        <div>
          <label class="cf-label">Operador</label>
          <select class="cf-input" name="comparison" [(ngModel)]="operator">
            @for (item of comparisonOperators(); track item.value) {
              <option [value]="item.value">{{ item.label }}</option>
            }
          </select>
        </div>
        <div>
          <label class="cf-label">Comparar con</label>
          <select class="cf-input" name="compareType" [(ngModel)]="compareType">
            <option value="value">Constante</option>
            <option value="variable">Variable</option>
          </select>
        </div>
      </div>

      @if (compareType === 'value') {
        <label class="cf-label">Valor</label>
        @if (leftVariable()?.type === 'boolean') {
          <select class="cf-input" name="rightValue" [(ngModel)]="rightValue">
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        } @else if (leftVariable()?.type === 'number') {
          <input class="cf-input" type="number" step="any" name="rightValue" [(ngModel)]="rightValue" placeholder="0">
        } @else if (leftVariable()?.type === 'list') {
          <input class="cf-input" type="text" name="rightValue" [ngModel]="'[]'" readonly>
        } @else {
          <input class="cf-input" type="text" name="rightValue" [(ngModel)]="rightValue" placeholder="Texto...">
        }
      } @else {
        <label class="cf-label">Variable de comparación</label>
        <select class="cf-input" name="rightVarId" [(ngModel)]="rightVarId">
          <option value="">-- Elegir --</option>
          @for (variable of rightVariables(); track variable.id) {
            <option [value]="variable.id">{{ variable.name }}</option>
          }
        </select>
        @if (!rightVariables().length) {
          <p class="cf-hint">No hay variables del mismo tipo.</p>
        }
      }
    </ng-template>
  `,
  styles: [`
    .cf-form { display: flex; flex-direction: column; gap: 10px; min-width: 420px; padding-top: 4px; }
    @media (max-width: 560px) { .cf-form { min-width: 0; } }
  `]
})
export class NodeFormDialogComponent implements OnInit {
  readonly data = inject<NodeFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<NodeFormDialogComponent>);
  private readonly ast = inject(AstService);
  private readonly variableService = inject(VariableService);
  private readonly functionService = inject(FunctionService);
  private readonly ui = inject(UiService);

  readonly variables = this.variableService.variables;
  readonly functions = this.functionService.functions;

  mode: NodeFormMode = this.data.mode;
  editNodeId = this.data.editNodeId;
  error = '';

  targetVarId = '';
  operator = '=';
  valueKind: 'literal' | 'variable' = 'literal';
  literalValue = '';
  sourceVarId = '';

  prompt = '';

  showParts: ShowPart[] = [];
  textInput = '';
  selectedVarId = '';

  leftVarId = '';
  compareType: 'value' | 'variable' = 'value';
  rightValue = '';
  rightVarId = '';
  hasElse = false;
  isInfinite = false;

  forType: 'range' | 'iterable' = 'range';
  iterName = 'i';
  endValue: string | number = '10';
  iterableVarId = '';

  funcName = '';
  argVarId = '';
  returnVarId = '';
  funcId = '';

  get title(): string {
    const titles: Record<NodeFormMode, string> = {
      assign: 'Asignar valor',
      read: 'Leer entrada (Read)',
      show: 'Construir Print',
      if: 'Condición (Si)',
      while: 'Mientras (While)',
      for: 'Bucle Para (For)',
      def: 'Definir función',
      call: 'Llamar función'
    };
    return this.editNodeId || this.data.editFuncId ? 'Editar: ' + titles[this.mode] : titles[this.mode];
  }

  ngOnInit(): void {
    if (this.editNodeId) {
      this.loadNode(this.editNodeId);
    } else if (this.data.editFuncId) {
      this.loadFunction(this.data.editFuncId);
    }
  }

  typeLabel(type: VariableType): string {
    const labels: Record<VariableType, string> = {
      number: 'Num',
      string: 'Texto',
      boolean: 'Bool',
      list: 'List'
    };
    return labels[type];
  }

  targetVariable(): Variable | undefined {
    return this.targetVarId ? this.variableService.get(this.targetVarId) : undefined;
  }

  leftVariable(): Variable | undefined {
    return this.leftVarId ? this.variableService.get(this.leftVarId) : undefined;
  }

  operators(): { value: string; label: string }[] {
    const type = this.targetVariable()?.type || 'number';
    return OPERATORS_BY_TYPE[type];
  }

  comparisonOperators(): { value: string; label: string }[] {
    const type = this.leftVariable()?.type;
    return type === 'boolean' || type === 'string' || type === 'list'
      ? BOOLEAN_COMPARISON_OPERATORS
      : COMPARISON_OPERATORS;
  }

  sourceVariables(): Variable[] {
    const target = this.targetVariable();
    if (!target) return [];
    return this.variables().filter(variable => variable.id !== target.id && variable.type === target.type);
  }

  rightVariables(): Variable[] {
    const left = this.leftVariable();
    if (!left) return [];
    return this.variables().filter(variable => variable.id !== left.id && variable.type === left.type);
  }

  listVariables(): Variable[] {
    return this.variables().filter(variable => variable.type === 'list');
  }

  partLabel(part: ShowPart): string {
    if (part.type === 'text') return `"${part.value || ''}"`;
    return this.variableService.get(part.varId || '')?.name || '?';
  }

  onTargetChange(): void {
    const allowed = this.operators().map(item => item.value);
    if (!allowed.includes(this.operator)) this.operator = allowed[0];
  }

  onLeftChange(): void {
    const allowed = this.comparisonOperators().map(item => item.value);
    if (!allowed.includes(this.operator)) this.operator = allowed[0];
    if (this.compareType === 'value') this.rightValue = '';
    else this.rightVarId = '';
  }

  onInfiniteChange(): void {
    this.error = '';
  }

  addTextPart(): void {
    const value = this.textInput.trim();
    if (!value) return;
    this.showParts = [...this.showParts, { type: 'text', value }];
    this.textInput = '';
  }

  addVarPart(): void {
    if (!this.selectedVarId) return;
    this.showParts = [...this.showParts, { type: 'variable', varId: this.selectedVarId }];
    this.selectedVarId = '';
  }

  removePart(index: number): void {
    this.showParts = this.showParts.filter((_, position) => position !== index);
  }

  removeLastPart(): void {
    this.showParts = this.showParts.slice(0, -1);
  }

  save(): void {
    this.error = '';

    switch (this.mode) {
      case 'assign': this.saveAssign(); break;
      case 'read': this.saveRead(); break;
      case 'show': this.saveShow(); break;
      case 'if':
      case 'while': this.saveCondition(); break;
      case 'for': this.saveFor(); break;
      case 'def': this.saveFunction(); break;
      case 'call': this.saveCall(); break;
    }
  }

  cancel(): void {
    this.finish(false);
  }

  private saveAssign(): void {
    if (!this.targetVarId) return this.fail('Selecciona una variable destino');
    const target = this.targetVariable();
    if (!target) return this.fail('Variable destino inválida');

    let expression: Record<string, unknown>;
    if (this.valueKind === 'variable') {
      if (!this.sourceVarId) return this.fail('Selecciona una variable origen');
      const source = this.variableService.get(this.sourceVarId);
      if (!source) return this.fail('Variable origen inválida');
      expression = { type: 'variable', varId: this.sourceVarId };
    } else {
      expression = {
        type: 'literal',
        valueType: target.type,
        value: this.literalFor(target.type, this.literalValue)
      };
    }

    const data = {
      targetVarId: this.targetVarId,
      operator: this.operator,
      expression
    };

    this.persist('assign', data, false);
  }

  private saveRead(): void {
    if (!this.targetVarId) return this.fail('Selecciona una variable');
    this.persist('read', { targetVarId: this.targetVarId, prompt: this.prompt }, false);
  }

  private saveShow(): void {
    if (!this.showParts.length) return this.fail('Agrega al menos una parte al mensaje');
    this.persist('show', { parts: this.showParts }, false);
  }

  private saveCondition(): void {
    if (this.mode === 'while' && this.isInfinite) {
      this.persist('while', { condition: null, isInfinite: true }, false);
      return;
    }

    if (!this.leftVarId) return this.fail('Selecciona una variable');
    const left = this.leftVariable();
    if (!left) return this.fail('Variable inválida');

    if (this.compareType === 'variable' && !this.rightVarId) {
      return this.fail('Selecciona una variable para comparar');
    }
    if (this.compareType === 'value' && !this.rightValue && left.type !== 'boolean' && left.type !== 'list') {
      return this.fail('Ingresa un valor para comparar');
    }

    const condition = this.compareType === 'variable'
      ? {
          leftVarId: this.leftVarId,
          leftType: left.type,
          operator: this.operator,
          rightType: 'variable' as const,
          rightVarId: this.rightVarId
        }
      : {
          leftVarId: this.leftVarId,
          leftType: left.type,
          operator: this.operator,
          rightType: 'literal' as const,
          rightValue: this.literalFor(left.type, this.rightValue) as string | number | boolean
        };

    const data = {
      condition,
      isInfinite: false,
      hasElse: this.mode === 'if' ? this.hasElse : false
    };

    this.persist(this.mode as 'if' | 'while', data, this.mode === 'if' && this.hasElse);
  }

  private saveFor(): void {
    if (!this.iterName.trim()) return this.fail('Indica el nombre del iterador');

    if (this.forType === 'iterable') {
      if (!this.iterableVarId) return this.fail('Selecciona una variable iterable');
      this.persist('for', {
        subType: 'iterable',
        iterName: this.iterName.trim(),
        iterableVarId: this.iterableVarId
      }, false);
      return;
    }

    const end = safeInt(this.endValue, -1);
    if (end < 0) return this.fail('El fin del rango debe ser mayor o igual a 0');
    this.persist('for', {
      subType: 'range',
      iterName: this.iterName.trim(),
      start: 0,
      end
    }, false);
  }

  private saveFunction(): void {
    const name = this.funcName.trim();
    if (!name) return this.fail('Indica un nombre para la función');

    const arg = this.argVarId || null;
    const ret = this.returnVarId || null;

    if (this.data.editFuncId) {
      const result = this.functionService.update(this.data.editFuncId, {
        name,
        argVarId: arg,
        returnVarId: ret
      });
      if (!result.success) return this.fail(result.error || 'No se pudo actualizar la función');
    } else {
      const result = this.functionService.createFull(name, arg, ret);
      if (!result.success) return this.fail(result.error || 'No se pudo crear la función');
    }

    this.finish(true);
  }

  private saveCall(): void {
    if (!this.funcId) return this.fail('Selecciona una función');
    const func = this.functionService.get(this.funcId);
    if (!func) return this.fail('Función no encontrada');

    this.persist('function_call', {
      funcName: func.name,
      argVarId: this.argVarId || null,
      targetVarId: this.targetVarId || null
    }, false);
  }

  private persist(type: 'assign' | 'read' | 'show' | 'if' | 'while' | 'for' | 'function_call', data: Record<string, unknown>, hasElse: boolean): void {
    if (this.editNodeId) {
      if (type === 'if' || type === 'while') {
        const existing = this.ast.findNode(this.editNodeId) as ASTNode | null;
        const elseChildren = existing && 'elseChildren' in existing ? existing.elseChildren ?? null : null;
        this.ast.updateNodeWithElse(this.editNodeId, data, hasElse, hasElse ? elseChildren : null);
      } else {
        this.ast.updateNode(this.editNodeId, data);
      }
    } else if (type === 'if' || type === 'while') {
      this.ast.addNodeWithElse(
        type,
        data,
        hasElse,
        this.data.targetId,
        this.data.insertAfterId,
        this.data.replaceNodeId
      );
    } else {
      this.ast.addNode(
        type,
        data,
        this.data.targetId,
        this.data.insertAfterId,
        this.data.replaceNodeId
      );
    }

    this.finish(true);
  }

  private loadNode(nodeId: string): void {
    const node = this.ast.findNode(nodeId) as ASTNode | null;
    if (!node || !node.data) return;
    const data = node.data as Record<string, any>;

    switch (this.mode) {
      case 'assign': {
        this.targetVarId = String(data['targetVarId'] || '');
        this.operator = String(data['operator'] || '=');
        const expression = data['expression'] || {};
        this.valueKind = expression.type === 'variable' ? 'variable' : 'literal';
        if (expression.type === 'variable') this.sourceVarId = String(expression.varId || '');
        else this.literalValue = String(expression.value ?? '');
        break;
      }
      case 'read':
        this.targetVarId = String(data['targetVarId'] || '');
        this.prompt = String(data['prompt'] || '');
        break;
      case 'show':
        this.showParts = Array.isArray(data['parts']) ? [...data['parts']] : [];
        break;
      case 'if':
      case 'while': {
        this.hasElse = node.elseChildren !== null && node.elseChildren !== undefined;
        this.isInfinite = !!data['isInfinite'] || node.type === 'loop';
        const condition = data['condition'];
        if (condition) {
          this.leftVarId = String(condition.leftVarId || '');
          this.operator = String(condition.operator || '==');
          this.compareType = condition.rightType === 'variable' ? 'variable' : 'value';
          this.rightValue = String(condition.rightValue ?? '');
          this.rightVarId = String(condition.rightVarId || '');
        }
        break;
      }
      case 'for': {
        this.forType = data['subType'] === 'iterable' ? 'iterable' : 'range';
        this.iterName = String(data['iterName'] || 'i');
        this.endValue = data['end'] ?? 10;
        this.iterableVarId = String(data['iterableVarId'] || '');
        break;
      }
      case 'call': {
        const func = this.functionService.getByName(String(data['funcName'] || ''));
        this.funcId = func?.id || '';
        this.argVarId = String(data['argVarId'] || '');
        this.targetVarId = String(data['targetVarId'] || '');
        break;
      }
      default:
        break;
    }
  }

  private loadFunction(funcId: string): void {
    const func = this.functionService.get(funcId);
    if (!func) return;
    this.funcName = func.name;
    this.argVarId = func.argVarId || '';
    this.returnVarId = func.returnVarId || '';
  }

  private literalFor(type: VariableType, raw: string): string | number | boolean | unknown[] {
    if (type === 'number') return safeNumber(raw, 0);
    if (type === 'boolean') return raw === 'true' || raw === 'verdadero';
    if (type === 'list') return [];
    return raw;
  }

  private fail(message: string): void {
    this.error = message;
  }

  private finish(saved: boolean): void {
    this.ui.resetFormTarget();
    this.dialogRef.close(saved);
  }
}
