import { Injectable, computed, inject } from '@angular/core';
import { FlowStateService, HistorySnapshot } from './flow-state.service';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly state = inject(FlowStateService);
  private readonly limit = 60;

  readonly canUndo = computed(() => this.state.historyPointer() > 0);
  readonly canRedo = computed(() => {
    const pointer = this.state.historyPointer();
    return pointer >= 0 && pointer < this.state.historyStack().length - 1;
  });

  initialize(): void {
    this.state.resetHistory(this.state.snapshot());
  }

  saveHistory(): void {
    const stack = this.state.historyStack();
    const pointer = this.state.historyPointer();
    const snapshot = this.state.snapshot();

    if (stack.length === 0 || pointer < 0) {
      this.state.historyStack.set([snapshot]);
      this.state.historyPointer.set(0);
      return;
    }

    const next = stack.slice(0, pointer + 1);
    next.push(snapshot);

    while (next.length > this.limit) next.shift();

    this.state.historyStack.set(next);
    this.state.historyPointer.set(next.length - 1);
  }

  undo(): void {
    const pointer = this.state.historyPointer();
    if (pointer <= 0) return;

    const stack = this.state.historyStack().slice();
    stack[pointer] = this.state.snapshot();
    const target = stack[pointer - 1];

    this.state.historyStack.set(stack);
    this.state.historyPointer.set(pointer - 1);
    this.state.restore(target);
  }

  redo(): void {
    const pointer = this.state.historyPointer();
    const stack = this.state.historyStack();
    if (pointer < 0 || pointer >= stack.length - 1) return;

    const target = stack[pointer + 1];
    this.state.historyPointer.set(pointer + 1);
    this.state.restore(target);
  }

  replaceCurrent(snapshot: HistorySnapshot): void {
    const stack = this.state.historyStack().slice();
    const pointer = this.state.historyPointer();
    if (pointer >= 0) {
      stack[pointer] = snapshot;
      this.state.historyStack.set(stack);
    } else {
      this.state.resetHistory(snapshot);
    }
  }
}
