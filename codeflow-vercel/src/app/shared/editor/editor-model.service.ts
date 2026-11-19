import { Injectable } from '@angular/core';
import {
  ASTNode,
  Condition,
  ForData,
  Function,
  ReadData,
  ShowData,
  Variable,
  isContainerType
} from '../../core/models/ast.model';

export type EditorLineKind = 'node' | 'else' | 'end' | 'function' | 'function-end' | 'root-empty' | 'section';

export interface EditorLine {
  key: string;
  kind: EditorLineKind;
  depth: number;
  label: string;
  badge: string;
  tone: string;
  nodeId: string | null;
  parentTargetId: string;
  insertAfterId: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canDrag: boolean;
  canAdd: boolean;
  container: boolean;
  empty: boolean;
  emptyText: string;
  isElse: boolean;
  lineNo?: number;
}

@Injectable({ providedIn: 'root' })
export class EditorModelService {
  build(rootChildren: ASTNode[], functions: Function[], variables: Variable[]): EditorLine[] {
    const names = new Map(variables.map(variable => [variable.id, variable.name]));
    const lines: EditorLine[] = [];

    if (!rootChildren.length) {
      lines.push({
        key: 'root-empty',
        kind: 'root-empty',
        depth: 0,
        label: 'Tu programa está vacío',
        badge: '',
        tone: 'empty',
        nodeId: null,
        parentTargetId: 'root',
        insertAfterId: null,
        canEdit: false,
        canDelete: false,
        canDrag: false,
        canAdd: true,
        container: false,
        empty: true,
        emptyText: 'Agrega tu primera instrucción para empezar',
        isElse: false
      });
    } else {
      this.walk(rootChildren, 0, 'root', lines, names);
      lines.push(this.trailingAdd(0, 'root'));
    }

    if (functions.length) {
      lines.push({
        ...this.structural('functions-title', 0, 'Funciones'),
        kind: 'section',
        tone: 'section',
        canAdd: false
      });

      for (const func of functions) {
        lines.push(this.functionHeader(func, 0, names));
        const targetId = 'func:' + func.id;
        if (func.children.length) {
          this.walk(func.children, 1, targetId, lines, names);
        } else {
          lines.push(this.emptyLine(1, 'func-empty-' + func.id, targetId, 'La función no tiene instrucciones'));
        }
        lines.push({
          ...this.structural('func-end-' + func.id, 0, ''),
          kind: 'function-end',
          tone: 'function-end'
        });
      }
    }

    let lineNo = 0;
    for (const line of lines) {
      if (line.kind !== 'section' && line.kind !== 'function-end' && line.kind !== 'end' && line.kind !== 'root-empty') {
        line.lineNo = ++lineNo;
      }
    }

    return lines;
  }

  private walk(nodes: ASTNode[], depth: number, containerId: string, lines: EditorLine[], names: Map<string, string>): void {
    for (const node of nodes) {
      const described = this.describe(node, names);
      const parentId = this.containerIdFor(node, containerId);
      const container = isContainerType(node.type);
      lines.push({
        key: 'node-' + node.id,
        kind: 'node',
        depth,
        label: described.label,
        badge: described.badge,
        tone: described.tone,
        nodeId: node.id,
        parentTargetId: parentId,
        insertAfterId: node.id,
        canEdit: described.canEdit,
        canDelete: true,
        canDrag: true,
        canAdd: true,
        container,
        empty: false,
        emptyText: '',
        isElse: false
      });

      if (container) {
        if (node.children && node.children.length) {
          this.walk(node.children, depth + 1, node.id, lines, names);
        } else {
          lines.push(this.emptyLine(depth + 1, 'empty-' + node.id, node.id, 'Sin instrucciones'));
        }
      }

      if (container && node.elseChildren !== null && node.elseChildren !== undefined) {
        lines.push({
          key: 'else-' + node.id,
          kind: 'else',
          depth: depth + 1,
          label: 'sino:',
          badge: '',
          tone: 'else',
          nodeId: null,
          parentTargetId: node.id + ':else',
          insertAfterId: null,
          canEdit: false,
          canDelete: false,
          canDrag: false,
          canAdd: true,
          container: true,
          empty: false,
          emptyText: '',
          isElse: true
        });

        if (node.elseChildren.length) {
          this.walk(node.elseChildren, depth + 2, node.id + ':else', lines, names);
        } else {
          lines.push(this.emptyLine(depth + 2, 'else-empty-' + node.id, node.id + ':else', 'Sin instrucciones en el sino'));
        }
      }

      if (container) {
        lines.push({
          ...this.structural('end-' + node.id, depth, ''),
          kind: 'end',
          tone: 'end',
          nodeId: node.id
        });
      }
    }
  }

  private describe(node: ASTNode, names: Map<string, string>): { label: string; badge: string; tone: string; canEdit: boolean } {
    const data = (node.data || {}) as Record<string, any>;
    const varName = (id: unknown): string => names.get(String(id || '')) || '?';

    switch (node.type) {
      case 'assign': {
        const expression = data['expression'] || {};
        const value = expression.type === 'variable'
          ? varName(expression.varId)
          : this.literal(expression.valueType, expression.value);
        return {
          label: `${varName(data['targetVarId'])} ${data['operator'] || '='} ${value}`,
          badge: 'asignar',
          tone: 'assign',
          canEdit: true
        };
      }

      case 'read': {
        const read = data as ReadData;
        return {
          label: `leer ${varName(read.targetVarId)}`,
          badge: read.prompt ? `"${read.prompt}"` : '',
          tone: 'io',
          canEdit: true
        };
      }

      case 'show': {
        const show = data as ShowData;
        const parts = (show.parts || []).map(part => part.type === 'variable'
          ? varName(part.varId)
          : `"${part.value ?? ''}"`);
        return {
          label: `imprimir ${parts.length ? parts.join(' + ') : '""'}`,
          badge: 'print',
          tone: 'io',
          canEdit: true
        };
      }

      case 'if': {
        return {
          label: `si ${this.condition(data['condition'] as Condition | null, names)}:`,
          badge: 'condición',
          tone: 'control',
          canEdit: true
        };
      }

      case 'while': {
        const infinite = !!data['isInfinite'];
        return {
          label: `mientras ${infinite ? 'True' : this.condition(data['condition'] as Condition | null, names)}:`,
          badge: 'bucle',
          tone: 'loop',
          canEdit: true
        };
      }

      case 'loop':
        return {
          label: 'mientras True:',
          badge: 'bucle',
          tone: 'loop',
          canEdit: true
        };

      case 'for': {
        const forData = data as ForData;
        const iterator = forData.iterName || 'i';
        const source = forData.subType === 'iterable'
          ? varName(forData.iterableVarId)
          : `range(0, ${forData.end ?? 0})`;
        return {
          label: `para ${iterator} en ${source}:`,
          badge: 'bucle',
          tone: 'loop',
          canEdit: true
        };
      }

      case 'break':
        return {
          label: 'romper',
          badge: 'break',
          tone: 'break',
          canEdit: false
        };

      case 'function_call': {
        const name = String(data['funcName'] || '?');
        const argument = data['argVarId'] ? varName(data['argVarId']) : '';
        const call = `${name}(${argument})`;
        return {
          label: data['targetVarId'] ? `${varName(data['targetVarId'])} = ${call}` : call,
          badge: 'llamada',
          tone: 'function',
          canEdit: true
        };
      }

      case 'empty':
        return { label: '', badge: '', tone: 'empty', canEdit: false };

      default:
        return {
          label: node.type,
          badge: '',
          tone: 'assign',
          canEdit: false
        };
    }
  }

  private functionHeader(func: Function, depth: number, names: Map<string, string>): EditorLine {
    const argument = func.argVarId ? names.get(func.argVarId) || '?' : '';
    const ret = func.returnVarId ? ` → ${names.get(func.returnVarId) || '?'}` : '';
    return {
      key: 'func-' + func.id,
      kind: 'function',
      depth,
      label: `def ${func.name}(${argument}):${ret}`,
      badge: 'función',
      tone: 'function',
      nodeId: null,
      parentTargetId: 'func:' + func.id,
      insertAfterId: null,
      canEdit: false,
      canDelete: false,
      canDrag: false,
      canAdd: true,
      container: true,
      empty: false,
      emptyText: '',
      isElse: false
    };
  }

  private emptyLine(depth: number, key: string, targetId: string, text: string): EditorLine {
    return {
      key,
      kind: 'node',
      depth,
      label: '',
      badge: '',
      tone: 'empty',
      nodeId: null,
      parentTargetId: targetId,
      insertAfterId: null,
      canEdit: false,
      canDelete: false,
      canDrag: false,
      canAdd: true,
      container: false,
      empty: true,
      emptyText: text,
      isElse: targetId.endsWith(':else')
    };
  }

  private trailingAdd(depth: number, targetId: string): EditorLine {
    return {
      key: 'trailing-add-' + targetId,
      kind: 'node',
      depth,
      label: '',
      badge: '',
      tone: 'add',
      nodeId: null,
      parentTargetId: targetId,
      insertAfterId: null,
      canEdit: false,
      canDelete: false,
      canDrag: false,
      canAdd: true,
      container: false,
      empty: true,
      emptyText: 'Agregar instrucción',
      isElse: false
    };
  }

  private structural(key: string, depth: number, label: string): EditorLine {
    return {
      key,
      kind: 'end',
      depth,
      label,
      badge: '',
      tone: 'end',
      nodeId: null,
      parentTargetId: 'root',
      insertAfterId: null,
      canEdit: false,
      canDelete: false,
      canDrag: false,
      canAdd: false,
      container: false,
      empty: false,
      emptyText: '',
      isElse: false
    };
  }

  private containerIdFor(node: ASTNode, fallback: string): string {
    if (node.parentId) return node.parentId;
    node.parentId = fallback;
    return fallback;
  }

  private condition(condition: Condition | null | undefined, names: Map<string, string>): string {
    if (!condition) return 'True';
    const left = names.get(condition.leftVarId) || '?';
    const right = condition.rightType === 'variable'
      ? names.get(String(condition.rightVarId || '')) || '?'
      : this.literal(condition.leftType, condition.rightValue);
    return `${left} ${condition.operator} ${right}`;
  }

  private literal(type: unknown, value: unknown): string {
    if (value === null || value === undefined) return '?';
    if (type === 'string') return `"${String(value)}"`;
    if (type === 'boolean') return value === true || value === 'true' ? 'True' : 'False';
    if (type === 'list') return '[]';
    return String(value);
  }
}
