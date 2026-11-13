import { AudioLines, Info, Palette, Play, Plug, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { LyricsIcon } from '@/components/icons/Transport';

export type SectionId = 'audio' | 'playback' | 'lyrics' | 'appearance' | 'accounts' | 'together' | 'about';

export interface SectionMeta {
  id: SectionId;
  name: string;
  /** One line under the name when the category is open. */
  blurb: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number | string }>;
  color: string;
}

/** The categories, in the order the list shows them. */
export const SECTIONS: SectionMeta[] = [
  { id: 'audio', name: 'Audio', blurb: 'Where songs are played from.', icon: AudioLines, color: '#25a0d4' },
  { id: 'playback', name: 'Playback', blurb: 'What happens between songs.', icon: Play, color: '#2fa84f' },
  { id: 'lyrics', name: 'Lyrics', blurb: 'Which lyrics to show, and where they come from.', icon: LyricsIcon, color: '#d6337a' },
  { id: 'appearance', name: 'Appearance', blurb: 'Theme, glass, color and the Now Playing screen.', icon: Palette, color: '#8e5bd8' },
  { id: 'accounts', name: 'Accounts & integrations', blurb: 'The services Weav-Tune can sign in to.', icon: Plug, color: '#3478f6' },
  { id: 'together', name: 'Listen Together', blurb: 'Listen with friends in a shared room.', icon: Users, color: '#f08a24' },
  { id: 'about', name: 'About', blurb: 'Other apps, source code and community.', icon: Info, color: '#636366' },
];

export const sectionById = (id: string | null): SectionMeta | null => SECTIONS.find((s) => s.id === id) ?? null;
