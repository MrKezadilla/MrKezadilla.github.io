export type VariableType = 'number' | 'string' | 'boolean' | 'list';

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  value: number | string | boolean | unknown[];
}

export interface Function {
  id: string;
  name: string;
  argVarId: string | null;
  returnVarId: string | null;
  children: ASTNode[];
}

export const CONTAINER_TYPES: ASTNodeType[] = ['if', 'while', 'for', 'loop'];

export function isContainerType(type: ASTNodeType): boolean {
  return CONTAINER_TYPES.includes(type);
}

export type ASTNodeType =
  | 'assign'
  | 'read'
  | 'show'
  | 'if'
  | 'while'
  | 'for'
  | 'loop'
  | 'break'
  | 'function_call'
  | 'empty';

export interface LiteralExpression {
  type: 'literal';
  valueType: VariableType;
  value: number | string | boolean | unknown[];
}

export interface VariableExpression {
  type: 'variable';
  varId: string;
}

export type Expression = LiteralExpression | VariableExpression;

export interface AssignData {
  targetVarId: string;
  operator: '=' | '+=' | '-=' | '*=' | '/=' | '%=';
  expression: Expression;
}

export interface ReadData {
  targetVarId: string;
  prompt: string;
}

export interface ShowPart {
  type: 'text' | 'variable';
  value?: string;
  varId?: string;
}

export interface ShowData {
  parts: ShowPart[];
}

export interface Condition {
  leftVarId: string;
  leftType?: VariableType;
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=';
  rightType: 'literal' | 'variable';
  rightValue?: number | string | boolean;
  rightVarId?: string;
}

export interface IfData {
  condition: Condition;
  hasElse?: boolean;
}

export interface WhileData {
  condition: Condition | null;
  isInfinite: boolean;
  hasElse?: boolean;
}

export interface ForData {
  subType: 'range' | 'iterable';
  iterName: string;
  start?: number;
  end?: number;
  iterableVarId?: string;
}

export interface FunctionCallData {
  funcName: string;
  argVarId: string | null;
  targetVarId: string | null;
}

export type ASTNodeData =
  | AssignData
  | ReadData
  | ShowData
  | IfData
  | WhileData
  | ForData
  | FunctionCallData
  | Record<string, unknown>;

export interface ASTNode {
  id: string;
  type: ASTNodeType;
  parentId: string | null;
  data: ASTNodeData;
  children?: ASTNode[];
  elseChildren?: ASTNode[] | null;
}

export interface ASTRoot {
  id: string;
  type: 'program';
  children: ASTNode[];
}

export interface Document {
  formato: number;
  app: string;
  exportado: string;
  variables: Variable[];
  functions: Function[];
  ast: ASTNode[];
}

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  number: 'Num',
  string: 'Texto',
  boolean: 'Bool',
  list: 'List'
};

export const DEFAULT_VALUES: Record<VariableType, number | string | boolean | unknown[]> = {
  number: 0,
  string: '',
  boolean: false,
  list: []
};

export const OPERATORS_BY_TYPE: Record<VariableType, { value: string; label: string }[]> = {
  number: [
    { value: '=', label: '=' },
    { value: '+=', label: '+' },
    { value: '-=', label: '-' },
    { value: '*=', label: '*' },
    { value: '/=', label: '/' },
    { value: '%=', label: '%' }
  ],
  string: [
    { value: '=', label: '=' },
    { value: '+=', label: '+' }
  ],
  boolean: [{ value: '=', label: '=' }],
  list: [{ value: '=', label: '=' }]
};

export const COMPARISON_OPERATORS = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' },
  { value: '<', label: '<' },
  { value: '>', label: '>' },
  { value: '<=', label: '≤' },
  { value: '>=', label: '≥' }
];

export const BOOLEAN_COMPARISON_OPERATORS = [
  { value: '==', label: '==' },
  { value: '!=', label: '!=' }
];

export const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
  'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
  'while', 'with', 'yield', 'print', 'input', 'range', 'len', 'list',
  'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'type',
  'open', 'exec', 'eval'
]);

export function generateId(): string {
  return 'node_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
}

export function clone<T>(obj: T): T {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj)) as T;
  }
}

export function escapeHtml(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validateNameWithReason(name: string): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'El nombre no puede estar vacío';
  const trimmed = name.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return 'Solo letras, números y _ (sin empezar con número)';
  }
  if (PYTHON_KEYWORDS.has(trimmed)) {
    return `'${trimmed}' es una palabra reservada de Python`;
  }
  return null;
}

export function isValidName(name: string): boolean {
  return validateNameWithReason(name) === null;
}

export function getDefaultVal(type: VariableType): number | string | boolean | unknown[] {
  return clone(DEFAULT_VALUES[type]);
}

export function safeNumber(raw: string | number | null | undefined, fallback = 0): number {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function safeInt(raw: string | number | null | undefined, fallback = 0): number {
  return Math.trunc(safeNumber(raw, fallback));
}
