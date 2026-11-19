import { Injectable } from '@angular/core';
import {
  BucleItem,
  DecisionItem,
  FlowItem,
  FlowModel,
  FlowShape,
  PasoItem
} from './diagram.model';

const W = 230;
const H = 46;
const DW = 240;
const DH = 66;
const GY = 38;
const GX = 30;
const LOOP = 30;
const PAD = 28;
const LANE_MIN = 44;

interface MeasureResult {
  left: number;
  right: number;
  height: number;
  empty: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface PlaceResult {
  endY: number;
  reachable: boolean;
}

type FigureFn = (item: FlowItem, cx: number, top: number, w: number, h: number, shape: string) => void;
type PathFn = (points: Point[], arrow: boolean) => void;
type LabelFn = (text: string, x: number, y: number) => void;

@Injectable({ providedIn: 'root' })
export class DiagramRendererService {
  private cache = new Map<FlowItem, MeasureResult>();

  render(model: FlowModel): string {
    this.cache.clear();

    const figures: string[] = [];
    const paths: string[] = [];
    const texts: string[] = [];

    const drawFigure: FigureFn = (item, cx, top, width, height, shape) => {
      const form = (shape || item.forma || 'proceso') as FlowShape;
      const x = cx - width / 2;
      const y = top;
      const colors = this.colors(form);
      let figure = '';

      switch (form) {
        case 'terminal':
          figure = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}"/>`;
          break;
        case 'io':
          figure = `<polygon points="${x + 16},${y} ${x + width},${y} ${x + width - 16},${y + height} ${x},${y + height}"/>`;
          break;
        case 'decision':
          figure = `<polygon points="${cx},${y} ${x + width},${y + height / 2} ${cx},${y + height} ${x},${y + height / 2}"/>`;
          break;
        case 'preparacion':
          figure = `<polygon points="${x + 22},${y} ${x + width - 22},${y} ${x + width},${y + height / 2} ${x + width - 22},${y + height} ${x + 22},${y + height} ${x},${y + height / 2}"/>`;
          break;
        case 'subrutina':
          figure = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4"/>`
            + `<line x1="${x + 10}" y1="${y}" x2="${x + 10}" y2="${y + height}"/>`
            + `<line x1="${x + width - 10}" y1="${y}" x2="${x + width - 10}" y2="${y + height}"/>`;
          break;
        default:
          figure = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>`;
      }

      const usable = form === 'decision' ? width * 0.58 : (form === 'io' ? width - 48 : width - 24);
      const lines = this.wrap(item.textoCompleto || item.texto || '', usable, 2);

      figures.push(
        `<g data-node-id="${this.escape(item.id)}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.6">`
        + figure
        + `<title>${this.escape(item.textoCompleto || '')}</title>`
        + `</g>`
      );

      const spans = lines.map((line, index) => {
        const dy = lines.length === 1 ? '0' : (index === 0 ? '-0.55em' : '1.15em');
        return `<tspan x="${cx}" dy="${dy}">${this.escape(line)}</tspan>`;
      }).join('');

      texts.push(
        `<text x="${cx}" y="${y + height / 2}" text-anchor="middle" dominant-baseline="central" `
        + `font-family="monospace" font-size="12" fill="#0f172a">${spans}</text>`
      );
    };

    const drawPath: PathFn = (points, arrow) => {
      const d = points.map((point, index) => (index ? 'L' : 'M') + point.x + ' ' + point.y).join(' ');
      paths.push(
        `<path d="${d}" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-linejoin="round"`
        + `${arrow ? ' marker-end="url(#flecha)"' : ''}/>`
      );
    };

    const drawLabel: LabelFn = (text, x, y) => {
      texts.push(
        `<text x="${x}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="11" `
        + `font-weight="600" fill="#475569">${this.escape(text)}</text>`
      );
    };

    const sequence = [model.inicio, ...model.cuerpo, model.fin];
    const measurement = this.measureSequence(sequence);
    const width = measurement.left + measurement.right + PAD * 2;
    const height = measurement.height + PAD * 2;
    const spine = measurement.left + PAD;

    this.placeSequence(sequence, spine, PAD, drawFigure, drawPath, drawLabel);

    return `<svg class="diagram-svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" `
      + `viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" xmlns="http://www.w3.org/2000/svg">`
      + `<defs><marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`
      + `<path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"/></marker></defs>`
      + `<g class="diagram-paths">${paths.join('')}</g>`
      + `<g class="diagram-figures">${figures.join('')}</g>`
      + `<g class="diagram-texts">${texts.join('')}</g>`
      + `</svg>`;
  }

  private measureSequence(items: FlowItem[]): MeasureResult {
    if (!items.length) return { left: 0, right: 0, height: 0, empty: true };

    let left = 0;
    let right = 0;
    let height = 0;

    items.forEach((item, index) => {
      const measured = this.measure(item);
      left = Math.max(left, measured.left);
      right = Math.max(right, measured.right);
      height += measured.height + (index > 0 ? GY : 0);
    });

    return { left, right, height, empty: false };
  }

  private measure(item: FlowItem): MeasureResult {
    const cached = this.cache.get(item);
    if (cached) return cached;

    let result: MeasureResult;

    if (item.clase === 'paso') {
      result = { left: W / 2, right: W / 2, height: H, empty: false };
    } else if (item.clase === 'decision') {
      const yes = this.measureSequence(item.si);
      const no = this.measureSequence(item.no);
      const yesLane = yes.empty ? LANE_MIN : yes.left + yes.right;
      const noLane = no.empty ? LANE_MIN : no.left + no.right;
      const total = yesLane + GX + noLane;
      const half = Math.max(DW / 2, total / 2);
      result = {
        left: half,
        right: half,
        height: DH + GY + Math.max(yes.height, no.height, 20) + GY,
        empty: false
      };
    } else {
      const body = this.measureSequence(item.cuerpo);
      result = {
        left: Math.max(DW / 2, body.empty ? W / 2 : body.left) + LOOP,
        right: Math.max(DW / 2, body.empty ? W / 2 : body.right) + LOOP,
        height: DH + GY + Math.max(body.height, 20) + GY,
        empty: false
      };
    }

    this.cache.set(item, result);
    return result;
  }

  private placeSequence(
    items: FlowItem[],
    x: number,
    y: number,
    figure: FigureFn,
    path: PathFn,
    label: LabelFn
  ): PlaceResult {
    if (!items.length) return { endY: y, reachable: true };

    let current = y;
    let end = y;
    let reachable = true;
    let first = true;

    for (const item of items) {
      if (!reachable) break;
      if (!first) path([{ x, y: end }, { x, y: current }], true);
      const result = this.place(item, x, current, figure, path, label);
      end = result.endY;
      reachable = result.reachable;
      current = end + GY;
      first = false;
    }

    return { endY: end, reachable };
  }

  private place(
    item: FlowItem,
    x: number,
    y: number,
    figure: FigureFn,
    path: PathFn,
    label: LabelFn
  ): PlaceResult {
    if (item.clase === 'paso') {
      figure(item, x, y, W, H, item.forma);
      return { endY: y + H, reachable: (item as PasoItem).sigue !== false };
    }

    if (item.clase === 'decision') {
      const decision = item as DecisionItem;
      figure(item, x, y, DW, DH, 'decision');

      const yes = this.measureSequence(decision.si);
      const no = this.measureSequence(decision.no);
      const yesLane = yes.empty ? LANE_MIN : yes.left + yes.right;
      const noLane = no.empty ? LANE_MIN : no.left + no.right;
      const total = yesLane + GX + noLane;
      const edge = x - total / 2;

      const yesX = yes.empty ? edge + yesLane / 2 : edge + yes.left;
      const noX = no.empty ? edge + yesLane + GX + noLane / 2 : edge + yesLane + GX + no.left;

      const middleY = y + DH / 2;
      const branchY = y + DH + GY;

      path([{ x: x - DW / 2, y: middleY }, { x: yesX, y: middleY }, { x: yesX, y: branchY }], true);
      path([{ x: x + DW / 2, y: middleY }, { x: noX, y: middleY }, { x: noX, y: branchY }], true);
      label('Sí', (x - DW / 2 + yesX) / 2, middleY - 7);
      label('No', (x + DW / 2 + noX) / 2, middleY - 7);

      const yesResult = this.placeSequence(decision.si, yesX, branchY, figure, path, label);
      const noResult = this.placeSequence(decision.no, noX, branchY, figure, path, label);

      const joinY = Math.max(yesResult.endY, noResult.endY) + GY;
      if (yesResult.reachable) path([{ x: yesX, y: yesResult.endY }, { x: yesX, y: joinY }, { x, y: joinY }], false);
      if (noResult.reachable) path([{ x: noX, y: noResult.endY }, { x: noX, y: joinY }, { x, y: joinY }], false);

      return { endY: joinY, reachable: yesResult.reachable || noResult.reachable };
    }

    const loop = item as BucleItem;
    const shape = loop.forma === 'preparacion' ? 'preparacion' : 'decision';
    figure(item, x, y, DW, DH, shape);

    const measured = this.measure(item);
    const middleY = y + DH / 2;
    const bodyY = y + DH + GY;

    path([{ x, y: y + DH }, { x, y: bodyY }], true);
    if (shape === 'decision' && !loop.infinito) label('Sí', x + 14, bodyY - 12);

    const body = this.placeSequence(loop.cuerpo, x, bodyY, figure, path, label);
    const bottom = Math.max(body.endY, bodyY + 20);
    const returnY = bottom + GY * 0.55;
    const exitY = returnY + GY * 0.45;

    if (body.reachable) {
      const returnX = x - measured.left + 12;
      path([
        { x, y: bottom },
        { x, y: returnY },
        { x: returnX, y: returnY },
        { x: returnX, y: middleY },
        { x: x - DW / 2, y: middleY }
      ], true);
    }

    if (loop.infinito) return { endY: exitY, reachable: false };

    const exitX = x + measured.right - 12;
    path([{ x: x + DW / 2, y: middleY }, { x: exitX, y: middleY }, { x: exitX, y: exitY }, { x, y: exitY }], false);
    if (shape === 'decision') label('No', (x + DW / 2 + exitX) / 2, middleY - 7);

    return { endY: exitY, reachable: true };
  }

  private colors(shape: string): { fill: string; stroke: string } {
    switch (shape) {
      case 'terminal': return { fill: '#ecfdf5', stroke: '#10b981' };
      case 'io': return { fill: '#f5f3ff', stroke: '#7c3aed' };
      case 'decision':
      case 'preparacion': return { fill: '#fffbeb', stroke: '#f59e0b' };
      case 'subrutina': return { fill: '#eff6ff', stroke: '#2563eb' };
      default: return { fill: '#eff6ff', stroke: '#2563eb' };
    }
  }

  private wrap(text: string, widthPx: number, maxLines: number): string[] {
    const max = Math.max(6, Math.floor(widthPx / 7));
    if (text.length <= max) return [text];

    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (candidate.length <= max) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        current = '';
        break;
      }
    }

    if (current && lines.length < maxLines) lines.push(current);

    const written = lines.join(' ');
    if (written.length < text.length && lines.length) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = (last.length >= max ? last.slice(0, max - 1) : last) + '…';
    }

    return lines.length ? lines : [''];
  }

  private escape(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
