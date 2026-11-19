import { Injectable } from '@angular/core';
import {
  ASTNode,
  Condition,
  ForData,
  Function,
  IfData,
  ReadData,
  ShowData,
  Variable,
  VariableType,
  WhileData
} from '../models/ast.model';
import {
  BucleItem,
  DecisionItem,
  FlowItem,
  FlowModel,
  PasoItem,
  FlowShape
} from './diagram.model';

interface WalkContext {
  vars: Map<string, Variable>;
  funcs: Map<string, Function>;
}

const MAX_LABEL = 72;

function label(text: string): { texto: string; textoCompleto: string } {
  const full = String(text ?? '');
  return {
    texto: full.length > MAX_LABEL ? full.slice(0, MAX_LABEL - 1) + '…' : full,
    textoCompleto: full
  };
}

@Injectable({ providedIn: 'root' })
export class AstWalkerService {
  build(nodes: ASTNode[], variables: Variable[], functions: Function[]): FlowModel {
    return this.buildModel(nodes, variables, functions, 'Inicio', 'Fin', '__inicio__', '__fin__');
  }

  buildFunction(func: Function, variables: Variable[], functions: Function[]): FlowModel {
    const names = new Map(variables.map(variable => [variable.id, variable.name]));
    const argument = func.argVarId ? names.get(func.argVarId) || '' : '';
    const returned = func.returnVarId ? names.get(func.returnVarId) || '' : '';
    const end = returned ? `Fin (retorna ${returned})` : `Fin ${func.name}`;

    return this.buildModel(
      func.children || [],
      variables,
      functions,
      `Función ${func.name}(${argument})`,
      end,
      'func_inicio_' + func.id,
      'func_fin_' + func.id
    );
  }

  private buildModel(
    nodes: ASTNode[],
    variables: Variable[],
    functions: Function[],
    startLabel: string,
    endLabel: string,
    startId: string,
    endId: string
  ): FlowModel {
    const context: WalkContext = {
      vars: new Map(variables.map(variable => [variable.id, variable])),
      funcs: new Map(functions.map(func => [func.id, func]))
    };

    return {
      inicio: this.paso(startId, 'terminal', startLabel),
      cuerpo: this.sequence(nodes, context),
      fin: this.paso(endId, 'terminal', endLabel)
    };
  }

  private paso(id: string, forma: FlowShape, text: string, sigue = true): PasoItem {
    return { clase: 'paso', id, forma, sigue, ...label(text) };
  }

  private name(id: string | null | undefined, context: WalkContext): string {
    if (!id) return '?';
    return context.vars.get(id)?.name || '?';
  }

  private literal(type: VariableType | undefined, value: unknown): string {
    if (value === undefined || value === null) return '?';
    switch (type) {
      case 'string': return '"' + String(value) + '"';
      case 'boolean': return value === true || value === 'true' ? 'verdadero' : 'falso';
      case 'list': return Array.isArray(value) ? '[' + value.join(', ') + ']' : '[]';
      default: return String(value);
    }
  }

  private parts(parts: ShowData['parts'] | undefined, context: WalkContext): string {
    if (!Array.isArray(parts) || !parts.length) return '""';
    return parts.map(part => part.type === 'variable'
      ? this.name(part.varId, context)
      : '"' + (part.value ?? '') + '"'
    ).join(' + ');
  }

  private assignText(data: Record<string, any>, context: WalkContext): string {
    const destination = this.name(data['targetVarId'], context);
    const operator = data['operator'] || '=';
    const expression = data['expression'] || {};
    const value = expression.type === 'variable'
      ? this.name(expression.varId, context)
      : this.literal(expression.valueType, expression.value);
    return `${destination} ${operator} ${value}`;
  }

  private conditionText(condition: Condition | null | undefined, context: WalkContext): string {
    if (!condition) return '?';
    const left = this.name(condition.leftVarId, context);
    const right = condition.rightType === 'variable'
      ? this.name(condition.rightVarId, context)
      : this.literal(condition.leftType, condition.rightValue);
    return `${left} ${condition.operator || '?'} ${right}`;
  }

  private forText(data: ForData, context: WalkContext): string {
    const iterator = data.iterName || 'i';
    if (data.subType === 'iterable') {
      return `${iterator} en ${this.name(data.iterableVarId, context)}`;
    }
    return `${iterator} = ${data.start ?? 0} … ${data.end ?? 0}`;
  }

  private callText(data: Record<string, any>, context: WalkContext): string {
    const name = data['funcName'] || '?';
    const argument = data['argVarId'] ? this.name(data['argVarId'], context) : '';
    const call = `${name}(${argument})`;
    return data['targetVarId'] ? `${this.name(data['targetVarId'], context)} = ${call}` : call;
  }

  private sequence(nodes: ASTNode[] | undefined, context: WalkContext): FlowItem[] {
    if (!Array.isArray(nodes)) return [];
    const output: FlowItem[] = [];
    for (const node of nodes) {
      const item = this.item(node, context);
      if (item) output.push(item);
    }
    return output;
  }

  private item(node: ASTNode, context: WalkContext): FlowItem | null {
    if (!node || !node.type) return null;
    const data = (node.data || {}) as Record<string, any>;

    switch (node.type) {
      case 'show':
        return this.paso(node.id, 'io', 'imprimir ' + this.parts((data as ShowData).parts, context));

      case 'read':
        return this.paso(node.id, 'io', 'leer ' + this.name((data as ReadData).targetVarId, context));

      case 'assign':
        return this.paso(node.id, 'proceso', this.assignText(data, context));

      case 'function_call':
        return this.paso(node.id, 'subrutina', this.callText(data, context));

      case 'break':
        return this.paso(node.id, 'proceso', 'romper bucle', false);

      case 'if': {
        const ifData = data as IfData;
        const decision: DecisionItem = {
          clase: 'decision',
          id: node.id,
          forma: 'decision',
          si: this.sequence(node.children, context),
          no: this.sequence(node.elseChildren || [], context),
          ...label(this.conditionText(ifData.condition, context))
        };
        return decision;
      }

      case 'while': {
        const whileData = data as WhileData;
        const loop: BucleItem = {
          clase: 'bucle',
          id: node.id,
          forma: 'decision',
          infinito: !!whileData.isInfinite,
          cuerpo: this.sequence(node.children, context),
          ...label(whileData.isInfinite ? 'siempre' : this.conditionText(whileData.condition, context))
        };
        return loop;
      }

      case 'for': {
        const forData = data as ForData;
        const loop: BucleItem = {
          clase: 'bucle',
          id: node.id,
          forma: 'preparacion',
          infinito: false,
          cuerpo: this.sequence(node.children, context),
          ...label(this.forText(forData, context))
        };
        return loop;
      }

      case 'loop': {
        const loop: BucleItem = {
          clase: 'bucle',
          id: node.id,
          forma: 'decision',
          infinito: true,
          cuerpo: this.sequence(node.children, context),
          ...label('siempre')
        };
        return loop;
      }

      case 'empty':
        return null;

      default:
        return this.paso(node.id, 'proceso', '? ' + node.type);
    }
  }
}
