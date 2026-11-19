import { Injectable, inject } from '@angular/core';
import {
  ASTNode,
  ASTNodeData,
  ASTNodeType,
  ASTRoot,
  CONTAINER_TYPES,
  Condition,
  Function,
  Variable,
  VariableType,
  clone,
  generateId,
  getDefaultVal,
  isContainerType
} from '../models/ast.model';
import { FlowStateService } from './flow-state.service';
import { HistoryService } from './history.service';

type AnyNode = any;

@Injectable({ providedIn: 'root' })
export class AstService {
  private readonly state = inject(FlowStateService);
  private readonly history = inject(HistoryService);

  get root(): ASTRoot {
    return this.state.root();
  }

  allContainers(): Array<{ id: string; children: ASTNode[] }> {
    const containers: Array<{ id: string; children: ASTNode[] }> = [
      { id: 'root', children: this.state.root().children }
    ];
    this.state.functions().forEach(func => {
      containers.push({ id: 'func:' + func.id, children: func.children });
    });
    return containers;
  }

  private searchNodes(nodes: ASTNode[], id: string): AnyNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;

      if (id.endsWith(':else') && node.id === id.slice(0, -5)) {
        return {
          id,
          type: '_else_container',
          parentId: node.id,
          data: {},
          children: node.elseChildren || [],
          elseChildren: null,
          nodeRef: node
        };
      }

      if (Array.isArray(node.children)) {
        const found = this.searchNodes(node.children, id);
        if (found) return found;
      }
      if (Array.isArray(node.elseChildren)) {
        const found = this.searchNodes(node.elseChildren, id);
        if (found) return found;
      }
    }
    return null;
  }

  findNode(id: string): AnyNode | null {
    if (!id) return null;
    if (id === 'root') return this.state.root();

    for (const func of this.state.functions().values()) {
      if (id === 'func:' + func.id) {
        return {
          id,
          type: 'function_def_body',
          parentId: null,
          data: {},
          children: func.children,
          elseChildren: null,
          funcRef: func
        };
      }
    }

    const foundRoot = this.searchNodes(this.state.root().children, id);
    if (foundRoot) return foundRoot;

    for (const func of this.state.functions().values()) {
      const found = this.searchNodes(func.children, id);
      if (found) return found;
    }
    return null;
  }

  findFunction(funcId: string): Function | undefined {
    return this.state.functions().get(funcId);
  }

  findFunctionByName(name: string): Function | undefined {
    for (const func of this.state.functions().values()) {
      if (func.name === name) return func;
    }
    return undefined;
  }

  private searchParent(nodes: ASTNode[], parentId: string): { id: string; children: ASTNode[] } | null {
    for (const node of nodes) {
      if (node.id === parentId) {
        return { id: parentId, children: nodes };
      }
      if (Array.isArray(node.elseChildren) && node.elseChildren.some(child => child.id === parentId)) {
        return { id: node.id + ':else', children: node.elseChildren };
      }
      if (Array.isArray(node.children)) {
        const found = this.searchParent(node.children, parentId);
        if (found) return found;
      }
      if (Array.isArray(node.elseChildren)) {
        const found = this.searchParent(node.elseChildren, parentId);
        if (found) return found;
      }
    }
    return null;
  }

  findParent(targetId: string): { id: string; children: ASTNode[] } | null {
    const rootParent = this.searchParent(this.state.root().children, targetId);
    if (rootParent) return rootParent;

    for (const func of this.state.functions().values()) {
      const parent = this.searchParent(func.children, targetId);
      if (parent) return parent;
    }
    return null;
  }

  private descendantsOf(node: AnyNode): ASTNode[] {
    const result: ASTNode[] = [];
    const visit = (nodes: ASTNode[] | undefined) => {
      if (!Array.isArray(nodes)) return;
      for (const child of nodes) {
        result.push(child);
        visit(child.children);
        visit(child.elseChildren || []);
      }
    };
    visit(node.children);
    visit(node.elseChildren || []);
    return result;
  }

  isAncestor(ancestorId: string, nodeId: string): boolean {
    if (ancestorId === nodeId) return false;
    const node = this.findNode(ancestorId);
    if (!node) return false;
    return this.descendantsOf(node).some(child => child.id === nodeId);
  }

  childrenOf(node: AnyNode | null): ASTNode[] {
    if (!node) return [];
    const children = Array.isArray(node.children) ? node.children : [];
    const elseChildren = Array.isArray(node.elseChildren) ? node.elseChildren : [];
    return elseChildren.length ? children.concat(elseChildren) : children;
  }

  containsBreak(node: ASTNode | null): boolean {
    if (!node) return false;
    if (node.type === 'break') return true;
    return this.childrenOf(node).some(child => this.containsBreak(child));
  }

  isInsideLoop(parentId: string | null | undefined): boolean {
    if (!parentId || parentId === 'root') return false;
    const node = (parentId.endsWith(':else')
      ? this.findNode(parentId.slice(0, -':else'.length))
      : this.findNode(parentId)) as AnyNode | null;
    if (!node) return false;
    if (['loop', 'while', 'for'].includes(String(node.type))) return true;
    return this.isInsideLoop((node.parentId as string | null | undefined) ?? null);
  }

  ownerOf(nodeId: string): string | null {
    const walk = (nodes: ASTNode[], ownerId: string): string | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return ownerId;
        if (Array.isArray(node.children)) {
          const found = walk(node.children, node.id);
          if (found !== null) return found;
        }
        if (Array.isArray(node.elseChildren)) {
          const found = walk(node.elseChildren, node.id + ':else');
          if (found !== null) return found;
        }
      }
      return null;
    };

    const found = walk(this.state.root().children, 'root');
    if (found !== null) return found;

    for (const func of this.state.functions().values()) {
      const nested = walk(func.children || [], 'func:' + func.id);
      if (nested !== null) return nested;
    }
    return null;
  }

  private touch(): void {
    this.state.touchAst();
  }

  pruneSelection(): void {
    const ids = this.state.selectedIds();
    if (ids.size === 0) return;
    const next = new Set<string>();
    ids.forEach(id => {
      if (this.findNode(id)) next.add(id);
    });
    if (next.size !== ids.size) this.state.selectedIds.set(next);
  }

  addNode(
    type: ASTNodeType,
    data: ASTNodeData,
    parentId = 'root',
    insertAfter: string | null = null,
    replaceNodeId: string | null = null
  ): void {
    const parent = this.findNode(parentId);
    if (!parent || !Array.isArray(parent.children)) return;

    this.history.saveHistory();

    const hasChildren = CONTAINER_TYPES.includes(type);
    const node: ASTNode = {
      id: generateId(),
      type,
      parentId,
      data,
      children: hasChildren ? [] : undefined,
      elseChildren: type === 'if' ? null : undefined
    };

    const children = parent.children as ASTNode[];
    if (replaceNodeId) {
      const index = children.findIndex(child => child.id === replaceNodeId);
      if (index !== -1) children.splice(index, 1, node);
      else children.push(node);
    } else if (insertAfter === 'START') {
      children.unshift(node);
    } else if (insertAfter) {
      const index = children.findIndex(child => child.id === insertAfter);
      if (index !== -1) children.splice(index + 1, 0, node);
      else children.push(node);
    } else {
      children.push(node);
    }

    this.touch();
  }

  addNodeWithElse(
    type: 'if' | 'while',
    data: ASTNodeData,
    hasElse: boolean,
    parentId = 'root',
    insertAfter: string | null = null,
    replaceNodeId: string | null = null
  ): void {
    const parent = this.findNode(parentId);
    if (!parent || !Array.isArray(parent.children)) return;

    this.history.saveHistory();

    const node: ASTNode = {
      id: generateId(),
      type,
      parentId,
      data,
      children: [],
      elseChildren: type === 'if' && hasElse ? [] : null
    };

    const children = parent.children as ASTNode[];
    if (replaceNodeId) {
      const index = children.findIndex(child => child.id === replaceNodeId);
      if (index !== -1) children.splice(index, 1, node);
      else children.push(node);
    } else if (insertAfter === 'START') {
      children.unshift(node);
    } else if (insertAfter) {
      const index = children.findIndex(child => child.id === insertAfter);
      if (index !== -1) children.splice(index + 1, 0, node);
      else children.push(node);
    } else {
      children.push(node);
    }

    this.touch();
  }

  updateNode(id: string, data: ASTNodeData): void {
    const node = this.findNode(id);
    if (!node || !('parentId' in node)) return;
    this.history.saveHistory();
    node.data = data;
    this.touch();
  }

  updateNodeWithElse(
    id: string,
    data: ASTNodeData,
    hasElse: boolean,
    existingElseChildren: ASTNode[] | null
  ): void {
    const node = this.findNode(id) as ASTNode | null;
    if (!node || !('type' in node)) return;
    this.history.saveHistory();
    node.data = data;
    node.elseChildren = hasElse ? (existingElseChildren !== null ? existingElseChildren : []) : null;
    this.touch();
  }

  deleteNode(id: string, skipConfirmation = false): void {
    const node = this.findNode(id);
    if (!node) return;

    const parent = this.findParent(id);
    if (!parent) return;

    const hasContent = this.childrenOf(node).length > 0;
    if (hasContent && !skipConfirmation && !confirm('¿Borrar esta instrucción y todo su contenido?')) return;

    this.history.saveHistory();
    const index = parent.children.findIndex(child => child.id === id);
    if (index !== -1) parent.children.splice(index, 1);

    this.pruneSelection();
    this.touch();
  }

  deleteNodes(ids: string[]): void {
    if (!ids.length) return;
    this.history.saveHistory();
    for (const id of ids) {
      const parent = this.findParent(id);
      if (!parent) continue;
      const index = parent.children.findIndex(child => child.id === id);
      if (index !== -1) parent.children.splice(index, 1);
    }
    this.pruneSelection();
    this.touch();
  }

  moveNodes(draggingIds: string[], targetId: string, position: 'before' | 'after' | 'inside'): void {
    const candidates = draggingIds.filter(id => id !== targetId);
    const ids = candidates.filter(id => !candidates.some(other => other !== id && this.isAncestor(other, id)));
    if (!ids.length) return;

    const target = this.findNode(targetId);
    if (!target) return;

    if (ids.some(id => this.isAncestor(id, targetId))) return;

    const moving: Array<{ node: ASTNode; parent: { id: string; children: ASTNode[] }; index: number }> = [];
    for (const id of ids) {
      const node = this.findNode(id) as ASTNode | null;
      const parent = this.findParent(id);
      if (!node || !parent) continue;
      const index = parent.children.findIndex(child => child.id === id);
      if (index === -1) continue;
      moving.push({ node, parent, index });
    }
    if (!moving.length) return;

    const destinationId = position === 'inside' ? targetId : (this.ownerOf(targetId) ?? 'root');
    const insideLoop = this.isInsideLoop(destinationId);
    if (!insideLoop && moving.some(item => this.containsBreak(item.node))) {
      alert("No se puede mover un 'break' (o un bloque que lo contiene) fuera de un loop.");
      this.state.dragState.set({ draggingIds: [], dropTargetId: null, dropPosition: null });
      return;
    }

    this.history.saveHistory();

    moving.sort((a, b) => b.index - a.index).forEach(item => {
      item.parent.children.splice(item.index, 1);
    });

    let destination: { id: string; children: ASTNode[] };
    let insertIndex: number;

    if (position === 'inside') {
      if (!Array.isArray(target.children)) {
        destination = this.findParent(targetId) || { id: 'root', children: this.state.root().children };
        insertIndex = destination.children.findIndex(child => child.id === targetId) + 1;
      } else {
        destination = { id: targetId, children: target.children };
        insertIndex = destination.children.length;
      }
    } else {
      const parent = this.findParent(targetId);
      if (!parent) return;
      destination = parent;
      const targetIndex = parent.children.findIndex(child => child.id === targetId);
      insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      if (insertIndex < 0) insertIndex = parent.children.length;
    }

    const newNodes = moving.map(item => item.node);
    newNodes.forEach(node => {
      node.parentId = destination.id;
    });
    destination.children.splice(insertIndex, 0, ...newNodes);

    this.touch();
  }

  purgeVarReferences(varId: string): void {
    const clean = (nodes: ASTNode[]) => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (!node || typeof node !== 'object') {
          nodes.splice(i, 1);
          continue;
        }
        const data = node.data as Record<string, any>;
        if (!data) continue;

        if ((node.type === 'assign' || node.type === 'read') && data['targetVarId'] === varId) {
          nodes.splice(i, 1);
          continue;
        }
        if ((node.type === 'if' || node.type === 'while') && data['condition']) {
          const condition = data['condition'] as Condition;
          if (condition.leftVarId === varId) {
            nodes.splice(i, 1);
            continue;
          }
          if (condition.rightVarId === varId) {
            condition.rightType = 'literal';
            condition.rightValue = getDefaultVal(condition.leftType || 'string') as string | number | boolean;
            delete condition.rightVarId;
          }
        }
        if (node.type === 'for' && data['iterableVarId'] === varId) {
          nodes.splice(i, 1);
          continue;
        }
        if (node.type === 'assign' && data['expression'] && data['expression'].varId === varId) {
          const targetVar = this.state.variables().get(String(data['targetVarId']));
          const type: VariableType = targetVar ? targetVar.type : 'string';
          data['expression'] = { type: 'literal', valueType: type, value: getDefaultVal(type) };
        }
        if (node.type === 'function_call') {
          if (data['argVarId'] === varId) data['argVarId'] = null;
          if (data['targetVarId'] === varId) data['targetVarId'] = null;
        }
        if (node.type === 'show' && Array.isArray(data['parts'])) {
          data['parts'] = data['parts'].filter(
            (part: Record<string, unknown>) => !(part['type'] === 'variable' && part['varId'] === varId)
          );
        }

        clean(node.children || []);
        clean(node.elseChildren || []);
      }
    };

    clean(this.state.root().children);
    this.state.functions().forEach(func => clean(func.children));

    this.touch();
  }

  purgeFuncReferences(funcName: string): void {
    const clean = (nodes: ASTNode[]) => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (!node || typeof node !== 'object') continue;
        if (node.type === 'function_call') {
          const data = node.data as Record<string, any>;
          if (data['funcName'] === funcName) {
            nodes.splice(i, 1);
            continue;
          }
        }
        clean(node.children || []);
        clean(node.elseChildren || []);
      }
    };

    clean(this.state.root().children);
    this.state.functions().forEach(func => clean(func.children));
    this.touch();
  }

  renameFuncReferences(oldName: string, newName: string): void {
    const clean = (nodes: ASTNode[]) => {
      for (const node of nodes) {
        if (node.type === 'function_call') {
          const data = node.data as Record<string, any>;
          if (data['funcName'] === oldName) data['funcName'] = newName;
        }
        clean(node.children || []);
        clean(node.elseChildren || []);
      }
    };

    clean(this.state.root().children);
    this.state.functions().forEach(func => clean(func.children));
    this.touch();
  }

  reset(): void {
    this.history.saveHistory();
    this.state.root.set({ id: 'root', type: 'program', children: [] });
    this.state.functions.update(map => {
      const next = new Map(map);
      next.forEach(func => {
        func.children = [];
      });
      return next;
    });
    this.state.selectedIds.set(new Set());
    this.touch();
  }

  importDocument(doc: {
    ast?: ASTNode[];
    variables?: unknown;
    functions?: unknown;
  }, recordHistory = true): boolean {
    if (!doc || !Array.isArray(doc.ast)) return false;

    if (recordHistory) this.history.saveHistory();

    const variables = this.normalizeVariables(doc.variables);
    const functions = this.normalizeFunctions(doc.functions);

    this.state.root.set({ id: 'root', type: 'program', children: this.sanitizeNodes(doc.ast) });
    this.state.variables.set(variables);
    this.state.functions.set(functions);
    this.state.selectedIds.set(new Set());
    this.touch();
    return true;
  }

  private sanitizeNodes(raw: unknown): ASTNode[] {
    if (!Array.isArray(raw)) return [];
    const nodes: ASTNode[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const candidate = entry as Record<string, any>;
      if (typeof candidate['type'] !== 'string') continue;

      const node: ASTNode = {
        id: typeof candidate['id'] === 'string' ? candidate['id'] : generateId(),
        type: candidate['type'] as ASTNodeType,
        parentId: typeof candidate['parentId'] === 'string' ? candidate['parentId'] : null,
        data: candidate['data'] && typeof candidate['data'] === 'object'
          ? clone(candidate['data'] as ASTNodeData)
          : {}
      };

      if (isContainerType(node.type)) {
        node.children = Array.isArray(candidate['children'])
          ? this.sanitizeNodes(candidate['children'])
          : [];
        if (candidate['elseChildren'] === null) {
          node.elseChildren = null;
        } else if (Array.isArray(candidate['elseChildren'])) {
          node.elseChildren = this.sanitizeNodes(candidate['elseChildren']);
        }
      }

      nodes.push(node);
    }

    return nodes;
  }

  private normalizeVariables(raw: unknown): Map<string, Variable> {
    const map = new Map<string, Variable>();
    const list: any[] = Array.isArray(raw) ? raw : [];

    for (const entry of list) {
      const variable = Array.isArray(entry) ? entry[1] : entry;
      if (!variable || typeof variable !== 'object') continue;
      if (typeof variable.name !== 'string') continue;
      if (!['number', 'string', 'boolean', 'list'].includes(variable.type)) continue;
      const type = variable.type as VariableType;
      const id = typeof variable.id === 'string' ? variable.id : generateId();
      map.set(id, {
        id,
        name: variable.name,
        type,
        value: (variable.value ?? getDefaultVal(type)) as Variable['value']
      });
    }
    return map;
  }

  private normalizeFunctions(raw: unknown): Map<string, Function> {
    const map = new Map<string, Function>();
    const list: any[] = Array.isArray(raw) ? raw : [];

    for (const entry of list) {
      const func = Array.isArray(entry) ? entry[1] : entry;
      if (!func || typeof func !== 'object') continue;
      if (typeof func.name !== 'string') continue;
      const id = typeof func.id === 'string' ? func.id : generateId();
      map.set(id, {
        id,
        name: func.name,
        argVarId: typeof func.argVarId === 'string' ? func.argVarId : null,
        returnVarId: typeof func.returnVarId === 'string' ? func.returnVarId : null,
        children: Array.isArray(func.children) ? this.sanitizeNodes(func.children) : []
      });
    }
    return map;
  }
}
