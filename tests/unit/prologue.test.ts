import { describe, expect, it } from 'vitest';

import { BRIEFING_MANIFEST } from '../../src/gameplay/briefing';
import {
  BRIEFING_DURATION_SECONDS,
  BRIEFING_SKIP_DELAY_SECONDS,
  PrologueDirector,
} from '../../src/gameplay/prologue';
import {
  PROLOGUE_PORTAL_Z,
  PROLOGUE_ROOM_DEPTH,
  PROLOGUE_ROOM_HEIGHT,
  PROLOGUE_ROOM_WIDTH,
} from '../../src/render/agency-room';

describe('bilingual room prologue', () => {
  it('follows LANGUAGE_SELECT → ROOM → BRIEFING → PORTAL → RUN exactly once', () => {
    const prologue = new PrologueDirector();
    expect(prologue.snapshot().phase).toBe('LANGUAGE_SELECT');
    expect(prologue.enterRoom().phase).toBe('ROOM');
    expect(prologue.pressButton(false).phase).toBe('ROOM');
    expect(prologue.pressButton(true).phase).toBe('BRIEFING');
    prologue.update(BRIEFING_DURATION_SECONDS);
    expect(prologue.snapshot()).toMatchObject({
      phase: 'PORTAL',
      portalOpen: true,
      canReplay: true,
    });
    expect(prologue.crossPortal().phase).toBe('RUN');
    expect(prologue.crossPortal().phase).toBe('RUN');
  });

  it('blocks early skipping and allows replay only before crossing', () => {
    const prologue = new PrologueDirector();
    prologue.enterRoom();
    prologue.pressButton(true);
    prologue.update(BRIEFING_SKIP_DELAY_SECONDS - 0.01);
    expect(prologue.skip().phase).toBe('BRIEFING');
    prologue.update(0.01);
    expect(prologue.skip().phase).toBe('PORTAL');
    expect(prologue.pressButton(true).phase).toBe('BRIEFING');
  });

  it('declares the bounded room and portal crossing plane', () => {
    expect([
      PROLOGUE_ROOM_WIDTH,
      PROLOGUE_ROOM_DEPTH,
      PROLOGUE_ROOM_HEIGHT,
    ]).toEqual([14, 12, 4.5]);
    expect(PROLOGUE_PORTAL_Z).toBeGreaterThan(58);
    expect(PROLOGUE_PORTAL_Z).toBeLessThan(59);
  });

  it('keeps seven contiguous localized chapters on one 50-second timeline', () => {
    expect(BRIEFING_MANIFEST.durationSeconds).toBe(50);
    for (const locale of ['en', 'es'] as const) {
      const chapters = BRIEFING_MANIFEST.chapters[locale];
      expect(chapters).toHaveLength(7);
      expect(chapters[0]?.startSeconds).toBe(0);
      expect(chapters.at(-1)?.endSeconds).toBe(50);
      for (let index = 1; index < chapters.length; index += 1) {
        expect(chapters[index]?.startSeconds).toBe(
          chapters[index - 1]?.endSeconds,
        );
      }
    }
    expect(BRIEFING_MANIFEST.chapters.en.map((chapter) => chapter.id)).toEqual(
      BRIEFING_MANIFEST.chapters.es.map((chapter) => chapter.id),
    );
  });
});
