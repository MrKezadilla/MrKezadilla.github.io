import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AstService } from '../../core/services/ast.service';
import { UiService } from '../../core/services/ui.service';
import { DialogService } from '../services/dialog.service';
import { NodeFormMode } from './dialogs/node-form-dialog.component';

type MenuActionMode = NodeFormMode | 'break' | 'manage-vars' | 'manage-funcs';

interface MenuAction {
  mode: MenuActionMode;
  label: string;
  icon: string;
  tone: string;
}

@Component({
  selector: 'app-quick-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (menu().visible) {
      <div class="cf-quick-menu" [style.left.px]="menu().x" [style.top.px]="menu().y" (click)="stop($event)">
        <div class="cf-quick-title">{{ title() }}</div>
        @for (action of actions; track action.mode) {
          @if (isAvailable(action)) {
            <button type="button" class="cf-quick-item" (click)="run(action.mode)">
              <span class="cf-quick-icon" [ngClass]="'tone-' + action.tone">{{ action.icon }}</span>
              <span>{{ action.label }}</span>
            </button>
          }
        }
      </div>
    }
  `,
  styles: [`
    .cf-quick-menu {
      position: fixed;
      z-index: 1200;
      width: 250px;
      padding: 6px;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 18px 44px rgba(15, 23, 42, 0.22);
      border: 1px solid #e2e8f0;
      max-height: calc(100vh - 16px);
      overflow-y: auto;
    }
    .cf-quick-title {
      padding: 7px 10px 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    .cf-quick-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      font-family: inherit;
      font-size: 13px;
      color: #0f172a;
      text-align: left;
      cursor: pointer;
    }
    .cf-quick-item:hover { background: #f1f5f9; }
    .cf-quick-icon {
      flex: 0 0 24px;
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 7px;
      background: #f1f5f9;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
    }
    .tone-assign { color: #2563eb; }
    .tone-io { color: #7c3aed; }
    .tone-control { color: #d97706; }
    .tone-loop { color: #0d9488; }
    .tone-function { color: #0891b2; }
    .tone-break { color: #dc2626; }
    .tone-section { color: #334155; }
  `]
})
export class QuickMenuComponent {
  private readonly ui = inject(UiService);
  private readonly ast = inject(AstService);
  private readonly dialog = inject(DialogService);

  readonly menu = this.ui.quickMenu;

  readonly actions: MenuAction[] = [
    { mode: 'manage-vars', label: 'Gestionar variables…', icon: 'V', tone: 'section' },
    { mode: 'manage-funcs', label: 'Definir / gestionar funciones…', icon: 'ƒ', tone: 'section' },
    { mode: 'assign', label: 'Asignar valor', icon: '=', tone: 'assign' },
    { mode: 'read', label: 'Leer entrada', icon: '←', tone: 'io' },
    { mode: 'show', label: 'Imprimir mensaje', icon: '¶', tone: 'io' },
    { mode: 'if', label: 'Condición (si)', icon: '?', tone: 'control' },
    { mode: 'while', label: 'Bucle mientras', icon: '↻', tone: 'loop' },
    { mode: 'for', label: 'Bucle para', icon: '↦', tone: 'loop' },
    { mode: 'call', label: 'Llamar función', icon: 'ƒ', tone: 'function' },
    { mode: 'break', label: 'Romper bucle', icon: '⏹', tone: 'break' }
  ];

  title(): string {
    return this.menu().replaceNodeId ? 'Reemplazar instrucción' : 'Agregar instrucción';
  }

  isAvailable(action: MenuAction): boolean {
    if (this.menu().replaceNodeId && (action.mode === 'manage-vars' || action.mode === 'manage-funcs')) {
      return false;
    }
    if (action.mode === 'break') {
      return this.ast.isInsideLoop(this.menu().targetId);
    }
    return true;
  }

  run(mode: MenuActionMode): void {
    const current = this.menu();
    const options = {
      targetId: current.targetId,
      insertAfterId: current.insertAfterId,
      replaceNodeId: current.replaceNodeId
    };
    this.ui.hideQuickMenu();

    if (mode === 'manage-vars') {
      this.dialog.openVariables();
      return;
    }
    if (mode === 'manage-funcs') {
      this.dialog.openFunctions();
      return;
    }
    if (mode === 'break') {
      this.ast.addNode('break', {}, options.targetId, options.insertAfterId, options.replaceNodeId);
      return;
    }

    this.dialog.openNodeForm(mode, options);
  }

  stop(event: MouseEvent): void {
    event.stopPropagation();
  }
}
