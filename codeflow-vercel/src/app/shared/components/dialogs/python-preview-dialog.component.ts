import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranspilerService } from '../../../core/services/transpiler.service';
import { FlowStateService } from '../../../core/services/flow-state.service';
import { VariableService } from '../../../core/services/variable.service';
import { FunctionService } from '../../../core/services/function.service';

@Component({
  selector: 'app-python-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Python generado</h2>
    <mat-dialog-content>
      @if (copied) {
        <p class="cf-success">Código copiado al portapapeles.</p>
      }
      <pre class="cf-code">{{ code() }}</pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="cf-actions">
      <button mat-stroked-button type="button" (click)="copy()">Copiar</button>
      <button mat-stroked-button type="button" (click)="downloadJson()">Descargar JSON</button>
      <button mat-flat-button color="primary" type="button" (click)="downloadPython()">Descargar .py</button>
      <button mat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .cf-code { min-width: 640px; max-width: 100%; max-height: 58vh; overflow: auto; }
    @media (max-width: 760px) { .cf-code { min-width: 0; } }
  `]
})
export class PythonPreviewDialogComponent {
  private readonly transpiler = inject(TranspilerService);
  private readonly state = inject(FlowStateService);
  private readonly variableService = inject(VariableService);
  private readonly functionService = inject(FunctionService);

  copied = false;

  readonly code = computed(() => {
    try {
      return this.transpiler.transpile(
        this.state.root().children,
        this.variableService.getAll(),
        this.functionService.getAll()
      );
    } catch (error) {
      return `# Error al generar Python:\n# ${error instanceof Error ? error.message : 'Error desconocido'}`;
    }
  });

  copy(): void {
    const text = this.code();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 1800);
      }).catch(() => this.fallbackCopy(text));
    } else {
      this.fallbackCopy(text);
    }
  }

  downloadPython(): void {
    this.download('programa.py', this.code(), 'text/x-python');
  }

  downloadJson(): void {
    const document = {
      formato: 2,
      app: 'CodeFlow',
      exportado: new Date().toISOString(),
      variables: this.variableService.getAll(),
      functions: this.functionService.getAll(),
      ast: this.state.root().children
    };
    this.download('programa.json', JSON.stringify(document, null, 2), 'application/json');
  }

  private fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.copied = true;
    setTimeout(() => { this.copied = false; }, 1800);
  }

  private download(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
