import { Component, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FlowStateService } from '../../core/services/flow-state.service';
import { AstWalkerService } from '../../core/diagram/ast-walker.service';
import { DiagramRendererService } from '../../core/diagram/diagram-renderer.service';
import { SelectionService } from '../../core/services/selection.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-flow-diagram',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cf-diagram">
      <div class="cf-diagram-bar">
        <div>
          <span class="cf-eyebrow">Diagrama</span>
          <h2 class="cf-diagram-title">Flujo del programa</h2>
        </div>
        <div class="cf-zoom">
          <button type="button" (click)="zoomOut()" title="Alejar">−</button>
          <span>{{ zoomPercent() }}%</span>
          <button type="button" (click)="zoomIn()" title="Acercar">+</button>
          <button type="button" (click)="resetZoom()" title="Restablecer">Restablecer</button>
        </div>
      </div>

      <div
        class="cf-diagram-canvas"
        (wheel)="onWheel($event)"
        (mouseover)="onCanvasOver($event)"
        (mouseout)="onCanvasOut($event)"
        (click)="onCanvasClick($event)"
        (dblclick)="onCanvasDoubleClick($event)">
        @if (empty()) {
          <p class="cf-diagram-hint">Tu programa aún no tiene instrucciones. Agrega pasos en el editor para ver el diagrama.</p>
        } @else {
          <div class="cf-diagram-scroll">
            <div class="cf-diagram-zoom" [style.transform]="'scale(' + zoom() + ')'">
              @for (diagram of diagrams(); track diagram.id) {
                <section class="cf-diagram-block" [class.cf-diagram-block-sep]="$index > 0">
                  @if (diagrams().length > 1) {
                    <h3 class="cf-diagram-name">{{ diagram.title }}</h3>
                  }
                  <div [innerHTML]="diagram.svg"></div>
                </section>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .cf-diagram { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #f8fafc; }
    .cf-diagram-bar {
      display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
      padding: 14px 18px 12px; background: #fff; border-bottom: 1px solid #e2e8f0;
    }
    .cf-eyebrow {
      font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: #94a3b8;
    }
    .cf-diagram-title { margin: 2px 0 0; font-size: 17px; font-weight: 700; color: #0f172a; }
    .cf-zoom { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; }
    .cf-zoom button {
      border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 6px;
      padding: 4px 10px; font-family: inherit; font-size: 12px; cursor: pointer;
    }
    .cf-zoom button:hover { background: #f1f5f9; }
    .cf-diagram-canvas { flex: 1; min-height: 0; overflow: auto; position: relative; }
    .cf-diagram-scroll { display: inline-block; padding: 28px; }
    .cf-diagram-zoom { transform-origin: top left; }
    .cf-diagram-hint { margin: 24px; font-size: 13px; color: #94a3b8; }
    .cf-diagram-block-sep { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; }
    .cf-diagram-name { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #475569; }
    :host ::ng-deep .diagram-svg { display: block; }
    :host ::ng-deep .diagram-svg g[data-node-id] { cursor: pointer; }
    :host ::ng-deep .diagram-svg g[data-node-id]:hover { filter: brightness(0.96); }
    :host ::ng-deep .diagram-svg g.cf-svg-hover {
      filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.85));
    }
    :host ::ng-deep .diagram-svg g.cf-svg-active {
      filter: drop-shadow(0 0 5px rgba(67, 56, 202, 0.75));
      stroke-width: 3;
    }
  `]
})
export class FlowDiagramComponent {
  private readonly state = inject(FlowStateService);
  private readonly walker = inject(AstWalkerService);
  private readonly renderer = inject(DiagramRendererService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly selection = inject(SelectionService);
  private readonly ui = inject(UiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly zoom = signal(1);

  constructor() {
    effect(() => {
      const active = this.ui.activeNodeId();
      const hovered = this.ui.hoveredNodeId();
      this.diagrams();
      queueMicrotask(() => this.applyHighlight(active, hovered));
    });
  }

  readonly empty = computed(() => this.state.root().children.length === 0 && this.state.functions().size === 0);

  readonly diagrams = computed<{ id: string; title: string; svg: SafeHtml }[]>(() => {
    const variables = Array.from(this.state.variables().values());
    const functions = Array.from(this.state.functions().values());
    const main = this.walker.build(this.state.root().children, variables, functions);

    const diagrams = [{
      id: '__program__',
      title: 'Programa principal',
      svg: this.sanitizer.bypassSecurityTrustHtml(this.renderer.render(main))
    }];

    for (const func of functions) {
      const model = this.walker.buildFunction(func, variables, functions);
      diagrams.push({
        id: func.id,
        title: `Función ${func.name}`,
        svg: this.sanitizer.bypassSecurityTrustHtml(this.renderer.render(model))
      });
    }

    return diagrams;
  });

  zoomPercent(): number {
    return Math.round(this.zoom() * 100);
  }

  zoomIn(): void {
    this.zoom.update(value => Math.min(2.4, Math.round((value + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.zoom.update(value => Math.max(0.4, Math.round((value - 0.1) * 10) / 10));
  }

  resetZoom(): void {
    this.zoom.set(1);
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  onCanvasClick(event: MouseEvent): void {
    const nodeId = this.nodeIdFrom(event);
    if (!nodeId) {
      this.ui.hideQuickMenu();
      return;
    }

    if (this.selection.active()) {
      this.selection.toggleSelect(nodeId);
      return;
    }
    if (event.detail === 1) this.ui.activateNode(nodeId);
  }

  onCanvasDoubleClick(event: MouseEvent): void {
    const nodeId = this.nodeIdFrom(event);
    if (!nodeId) return;
    event.preventDefault();
    this.ui.showQuickMenu(event.clientX, event.clientY, nodeId, nodeId, null);
  }

  onCanvasOver(event: MouseEvent): void {
    const nodeId = this.nodeIdFrom(event);
    if (nodeId) this.ui.hoverNode(nodeId);
  }

  onCanvasOut(event: MouseEvent): void {
    if (this.nodeIdFrom(event)) this.ui.hoverNode(null);
  }

  private nodeIdFrom(event: MouseEvent): string | null {
    const target = event.target as Element | null;
    const id = target?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    if (!id || id.startsWith('__') || id.startsWith('func_inicio_') || id.startsWith('func_fin_')) return null;
    return id;
  }

  private applyHighlight(active: string | null, hovered: string | null): void {
    const groups = this.host.nativeElement.querySelectorAll<SVGElement>('.diagram-svg [data-node-id]');
    groups.forEach(group => {
      const id = group.getAttribute('data-node-id');
      group.classList.toggle('cf-svg-active', !!id && id === active);
      group.classList.toggle('cf-svg-hover', !!id && id === hovered);
    });
  }
}
