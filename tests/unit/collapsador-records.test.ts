import { describe, expect, it, vi } from 'vitest';
import {
  COLLAPSADOR_RECORDS,
  CollapsadorRecordDirector,
  MAX_COLLAPSADOR_RECORD_QUEUE,
} from '../../src/gameplay/collapsador-records';

describe('automatic Collapsador records', () => {
  it('contains four voice-ready records and incompatible reports for one coordinate', () => {
    expect(COLLAPSADOR_RECORDS).toHaveLength(4);
    expect(MAX_COLLAPSADOR_RECORD_QUEUE).toBe(2);
    expect(COLLAPSADOR_RECORDS[0]?.subtitle).toContain('64,58');
    expect(COLLAPSADOR_RECORDS[1]?.subtitle).toContain('64,58');
    expect(COLLAPSADOR_RECORDS[0]?.subtitle).toContain('agua');
    expect(COLLAPSADOR_RECORDS[1]?.subtitle).toContain('piedra');
    for (const record of COLLAPSADOR_RECORDS) {
      expect(record.durationMs).toBeGreaterThan(0);
      expect(record.speaker).toMatch(/COLAPSADOR/);
      expect(record.priority).toBeGreaterThan(0);
    }
  });

  it('plays stable triggers once and omits safely when a protected event interrupts', () => {
    const played: string[] = [];
    const interrupted = vi.fn();
    const director = new CollapsadorRecordDirector({
      onPlay: (record) => played.push(record.id),
      onInterrupt: interrupted,
    });
    director.update({
      deltaMs: 100,
      fixedCells: 20,
      seeds: 0,
      maxDistance: 9,
      blocked: false,
    });
    director.update({
      deltaMs: 100,
      fixedCells: 20,
      seeds: 0,
      maxDistance: 9,
      blocked: false,
    });
    expect(played).toEqual(['c04-water']);
    director.update({
      deltaMs: 100,
      fixedCells: 20,
      seeds: 0,
      maxDistance: 9,
      blocked: true,
    });
    expect(interrupted).toHaveBeenCalledOnce();
    expect(director.snapshot().omittedIds).toContain('c04-water');
  });

  it('produces the same record order for the same replay metrics', () => {
    const play = (): string[] => {
      const order: string[] = [];
      const director = new CollapsadorRecordDirector({
        onPlay: (record) => order.push(record.id),
      });
      for (let tick = 0; tick < 40; tick += 1) {
        director.update({
          deltaMs: 1_000,
          fixedCells: tick * 3,
          seeds: Math.min(4, Math.floor(tick / 8)),
          maxDistance: tick,
          blocked: false,
        });
      }
      return order;
    };
    expect(play()).toEqual(play());
    expect(play().length).toBeGreaterThanOrEqual(2);
  });
});
