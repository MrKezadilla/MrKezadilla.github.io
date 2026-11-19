import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeEditorComponent } from './shared/editor/code-editor.component';
import { SidebarComponent } from './shared/components/sidebar.component';
import { FlowDiagramComponent } from './shared/components/flow-diagram.component';
import { QuickMenuComponent } from './shared/components/quick-menu.component';
import { FlowStateService } from './core/services/flow-state.service';
import { HistoryService } from './core/services/history.service';
import { SelectionService } from './core/services/selection.service';
import { StorageService, STORAGE_KEY } from './core/services/storage.service';
import { VariableService } from './core/services/variable.service';
import { FunctionService } from './core/services/function.service';
import { AstService } from './core/services/ast.service';
import { UiService } from './core/services/ui.service';
import { DialogService } from './shared/services/dialog.service';

type ViewMode = 'editor' | 'diagrama' | 'split';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CodeEditorComponent, SidebarComponent, FlowDiagramComponent, QuickMenuComponent],
  template: `
    <div class="cf-app">
      <header class="cf-topbar">
        <div class="cf-brand">
          <span class="cf-logo">CF</span>
          <div class="cf-brand-text">
            <strong>CodeFlow</strong>
            <small>Programación visual</small>
          </div>
        </div>

        <nav class="cf-views">
          <button type="button" [class.active]="view() === 'editor'" (click)="view.set('editor')">Editor</button>
          <button type="button" [class.active]="view() === 'diagrama'" (click)="view.set('diagrama')">Diagrama</button>
          <button type="button" [class.active]="view() === 'split'" (click)="view.set('split')">Ambos</button>
        </nav>

        <div class="cf-tools">
          <button type="button" class="cf-icon" title="Deshacer (Ctrl+Z)" [disabled]="!canUndo()" (click)="undo()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>
            </svg>
          </button>
          <button type="button" class="cf-icon" title="Rehacer (Ctrl+Y)" [disabled]="!canRedo()" (click)="redo()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>
            </svg>
          </button>
          <span class="cf-sep"></span>
          <button type="button" [class.active]="selectionActive()" (click)="toggleSelection()">Seleccionar</button>
          @if (selectionActive()) {
            <button type="button" class="danger" [disabled]="!hasSelection()" (click)="deleteSelected()">
              Borrar ({{ selectionCount() }})
            </button>
          }
          <span class="cf-sep"></span>
          <button type="button" class="primary" (click)="dialog.openPythonPreview()">Ver Python</button>
          <button type="button" (click)="fileInput.click()">Importar</button>
          <button type="button" (click)="exportJson()">Exportar</button>
          <button type="button" class="danger" (click)="resetAll()">Limpiar</button>
        </div>
      </header>

      <main class="cf-main">
        <app-sidebar></app-sidebar>
        <section class="cf-content">
          @if (view() === 'editor') {
            <app-code-editor></app-code-editor>
          } @else if (view() === 'diagrama') {
            <app-flow-diagram></app-flow-diagram>
          } @else {
            <div class="cf-split">
              <app-code-editor></app-code-editor>
              <app-flow-diagram></app-flow-diagram>
            </div>
          }
        </section>
      </main>

      <input #fileInput type="file" accept="application/json,.json" hidden (change)="onImport($event)">
      <app-quick-menu></app-quick-menu>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .cf-app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #f8fafc; }
    .cf-topbar {
      display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
      padding: 10px 18px; background: #0f172a; color: #e2e8f0;
    }
    .cf-brand { display: flex; align-items: center; gap: 10px; }
    .cf-logo {
      width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
      border-radius: 10px; background: linear-gradient(135deg, #2563eb, #7c3aed);
      font-weight: 800; font-size: 13px; color: #fff;
    }
    .cf-brand-text { display: flex; flex-direction: column; line-height: 1.1; }
    .cf-brand-text strong { font-size: 15px; color: #fff; }
    .cf-brand-text small { font-size: 10.5px; color: #94a3b8; }
    .cf-views { display: flex; gap: 4px; background: rgba(255,255,255,0.08); padding: 3px; border-radius: 9px; }
    .cf-views button {
      border: 0; background: transparent; color: #cbd5e1; font-family: inherit;
      font-size: 12.5px; font-weight: 600; padding: 6px 14px; border-radius: 7px; cursor: pointer;
    }
    .cf-views button.active { background: #2563eb; color: #fff; }
    .cf-tools { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
    .cf-tools button {
      border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06);
      color: #e2e8f0; font-family: inherit; font-size: 12px; font-weight: 600;
      padding: 6px 11px; border-radius: 7px; cursor: pointer;
    }
    .cf-tools button:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
    .cf-tools button:disabled { opacity: 0.4; cursor: not-allowed; }
    .cf-tools button.cf-icon { display: inline-flex; align-items: center; justify-content: center; padding: 6px 8px; }
    .cf-tools button.cf-icon svg { width: 15px; height: 15px; display: block; }
    .cf-tools button.active { background: #2563eb; border-color: #2563eb; color: #fff; }
    .cf-tools button.primary { background: #10b981; border-color: #10b981; color: #052e1b; }
    .cf-tools button.danger { color: #fca5a5; border-color: rgba(248,113,113,0.4); }
    .cf-tools button.danger:hover:not(:disabled) { background: rgba(248,113,113,0.2); }
    .cf-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.16); }
    .cf-main { flex: 1; min-height: 0; display: flex; overflow: hidden; }
    .cf-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .cf-split {
      flex: 1; min-height: 0; display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 42%);
      overflow: hidden;
    }
    .cf-split > app-code-editor { min-width: 0; border-right: 1px solid #e2e8f0; }
    .cf-split > app-flow-diagram { min-width: 0; }
    @media (max-width: 860px) {
      .cf-main { flex-direction: column; overflow: auto; }
      .cf-content { min-height: 60vh; }
      .cf-split { grid-template-columns: 1fr; }
      .cf-split > app-code-editor { border-right: 0; border-bottom: 1px solid #e2e8f0; }
    }
  `]
})
export class App {
  private readonly state = inject(FlowStateService);
  private readonly history = inject(HistoryService);
  private readonly selection = inject(SelectionService);
  private readonly storage = inject(StorageService);
  private readonly variableService = inject(VariableService);
  private readonly functionService = inject(FunctionService);
  private readonly ast = inject(AstService);
  private readonly ui = inject(UiService);
  readonly dialog = inject(DialogService);

  readonly view = signal<ViewMode>('editor');
  readonly canUndo = this.history.canUndo;
  readonly canRedo = this.history.canRedo;
  readonly selectionActive = this.selection.active;
  readonly selectionCount = computed(() => this.selection.count());
  readonly hasSelection = this.selection.hasSelection;

  constructor() {
    this.storage.loadLocal();

    effect(() => {
      this.state.root();
      this.state.variables();
      this.state.functions();
      this.storage.saveLocal();
    });

    window.addEventListener('storage', this.onStorage);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.ui.hideQuickMenu();
      return;
    }

    const target = event.target as HTMLElement | null;
    const editing = !!target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    );
    if (editing) return;
    if (document.querySelector('.mat-mdc-dialog-container')) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.history.redo();
      else this.history.undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.history.redo();
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selection.active() && this.selection.count() > 0) {
      event.preventDefault();
      this.selection.deleteSelected();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.ui.hideQuickMenu();
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  toggleSelection(): void {
    this.selection.toggleMode();
  }

  deleteSelected(): void {
    this.selection.deleteSelected();
  }

  exportJson(): void {
    const document = {
      formato: 2,
      app: 'CodeFlow',
      exportado: new Date().toISOString(),
      ast: this.state.root().children,
      variables: this.variableService.getAll(),
      functions: this.functionService.getAll()
    };
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = 'programa.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  onImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const payload = Array.isArray(parsed?.ast)
          ? parsed
          : parsed?.root && Array.isArray(parsed.root.children)
            ? { ast: parsed.root.children, variables: parsed.variables, functions: parsed.functions }
            : null;

        if (!payload) {
          alert('El archivo no tiene un formato válido de CodeFlow.');
          return;
        }

        this.ast.importDocument(payload, true);
      } catch (error) {
        console.error('CodeFlow: error al importar', error);
        alert('No se pudo leer el archivo JSON.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  resetAll(): void {
    if (!confirm('¿Limpiar todo el programa, variables y funciones?')) return;
    this.history.saveHistory();
    this.state.root.set({ id: 'root', type: 'program', children: [] });
    this.state.variables.set(new Map());
    this.state.functions.set(new Map());
    this.state.selectedIds.set(new Set());
    this.state.activeNodeId.set(null);
    this.state.hoveredNodeId.set(null);
    this.state.touchAst();
  }

  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    this.storage.syncFromStorage(event.newValue);
  };
}
