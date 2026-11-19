export type FlowShape = 'terminal' | 'proceso' | 'io' | 'decision' | 'preparacion' | 'subrutina';

export interface FlowItemBase {
  id: string;
  clase: 'paso' | 'decision' | 'bucle';
  texto: string;
  textoCompleto: string;
  forma: FlowShape;
}

export interface PasoItem extends FlowItemBase {
  clase: 'paso';
  sigue: boolean;
}

export interface DecisionItem extends FlowItemBase {
  clase: 'decision';
  si: FlowItem[];
  no: FlowItem[];
}

export interface BucleItem extends FlowItemBase {
  clase: 'bucle';
  cuerpo: FlowItem[];
  infinito: boolean;
}

export type FlowItem = PasoItem | DecisionItem | BucleItem;

export interface FlowModel {
  inicio: PasoItem;
  cuerpo: FlowItem[];
  fin: PasoItem;
}
