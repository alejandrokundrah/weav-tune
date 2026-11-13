import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeIcon } from './NavIcons';
import { LyricsActiveIcon, LyricsIcon, UpNextIcon } from './Transport';

// The user supplied three outline glyphs to replace Apple's filled ones. These
// keep the exact paths pinned so an icon-library upgrade can't silently swap them.
const HOME = 'M21 19v-6.733a4 4 0 0 0-1.245-2.9L13.378 3.31a2 2 0 0 0-2.755 0L4.245 9.367A4 4 0 0 0 3 12.267V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2';
const AUDIO_LINES = ['M2 10v3', 'M6 6v11', 'M10 3v18', 'M14 8v7', 'M18 5v13', 'M22 10v3'];
const AUDIO_WAVEFORM = 'M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2';

const markup = (element: React.ReactElement) => renderToStaticMarkup(element);

describe('the user-supplied outline icons', () => {
  it('Home is the stroked outline house, not the old filled Apple glyph', () => {
    const html = markup(<HomeIcon size={28} />);
    expect(html).toContain(`d="${HOME}"`);
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toContain('M5.93 20.16');
  });

  it('Lyrics is lucide audio-lines with all six bars', () => {
    const html = markup(<LyricsIcon size={18} />);
    for (const path of AUDIO_LINES) expect(html).toContain(`d="${path}"`);
    expect(html).toContain('stroke-width="2"');
    // The old Apple filled/active speech-bubble glyphs are gone.
    expect(html).not.toContain('M18.53 62.724');
    expect(html).not.toContain('M17.347 62.821');
  });

  it('Up Next is lucide audio-waveform, not the old bulleted list', () => {
    const html = markup(<UpNextIcon size={18} />);
    expect(html).toContain(`d="${AUDIO_WAVEFORM}"`);
    expect(html).toContain('stroke-width="2.5"');
    expect(html).not.toContain('M2.634 5.537');
  });

  it('the pressed Lyrics state is the same glyph, so colour carries the state', () => {
    expect(LyricsActiveIcon).toBe(LyricsIcon);
    expect(markup(<LyricsActiveIcon size={18} />)).toBe(markup(<LyricsIcon size={18} />));
  });

  it('all three inherit currentColor so aria-pressed can tint them', () => {
    for (const element of [<HomeIcon key="h" />, <LyricsIcon key="l" />, <UpNextIcon key="q" />]) {
      expect(markup(element)).toContain('stroke="currentColor"');
    }
  });
});
