// Era-name reconciliation shared by a.ts (era grid) and era-meta.ts (live era covers).

// App.tsx ERA_MAPPINGS renames these keys after receiving the response, which moves them
// to the end of the object and breaks ordering. Return the final names directly so
// App.tsx sees them as already-mapped and leaves them in place.
export const ERA_NAME_MAP: Record<string, string> = {
  'Turbo Grafx 16': 'Turbo Grafix 16',
  'Turbo Grafx-16': 'Turbo Grafix 16',
  // yegold — the real sheet titles the era "Hitler" directly (Ye's own name for
  // it) rather than the "LOVE EVERYONE" title used everywhere else in the app;
  // a stray 2-song "DONDA 2" row from the SSC merge tab folds into DONDA 2 [V1];
  // the SSC tab's own "JESUS IS LORD" section is this era's current real name,
  // God's Country, reused by the live sheet for an unrelated earlier era.
  'Hitler': 'LOVE EVERYONE',
  'DONDA 2': 'DONDA 2 [V1]',
  'JESUS IS LORD': "God's Country",
  'KIDS SEE GHOSTS': 'KIDS SEE GHOSTS',
  'KIDS SEE GHOST': 'KIDS SEE GHOSTS',
  'KIDSSEEGHOSTS': 'KIDS SEE GHOSTS',
  'Kids See Ghosts': 'KIDS SEE GHOSTS',
  'Donda [V1]': 'DONDA [V1]',
  'Bully': 'BULLY [V1]',
  'BULLY': 'BULLY [V1]',
  // dongold — song rows use the short name, section header uses the trilogy name
  'Space Age Pimping': 'Space Age Pimping Trilogy',
  // colegold
  'Cole World': 'Cole World: The Sideline Story',
  'J. Cole x Kendrick Project': 'Collaboration with Kendrick Lamar',
  'J. Cole x JID Project': 'Collaboration with JID',
  'Revenge of the Dreamers 2': 'Revenge of the Dreamers 2 [V1]',
  'Revenge of the Dreamers II': 'Revenge of the Dreamers 2 [V1]',
  '4 Your Eyez Only [V1]': '4 Your Eyez Only',
  '4 Your Eyez Only [V2]': '4 Your Eyez Only',
  'Born Sinner Deluxe': 'Born Sinner',
  // aapgold
  'Pre-A.L.L.A.': 'Pre-AT.LONG.LAST.A$AP',
  'A$AP               (with A$AP Mob)': 'A$AP (Mob Collab)',
  'THE GRIM [V1]': 'THE GR1M [V1]',
  'Rug Of War 1984': 'Rug Of War 1994',
  'LIVE.LOVE.A$AP (Re-Release)': 'LIVE.LOVE.A$AP [Re-Release]',
  'GRIM': 'GR1M [V3]',
  // dregold
  "The Chronic II: A New World Odor (Poppa's Got A Brand New Funk)": 'The Chronic II',
  'The Chronic II: A New World Odor': 'The Chronic II',
  'N.W.A. Reunion Album': 'N.W.A. Reunion',
  // kdotgold — merge duplicate eras (song rows use short name, section header uses versioned name)
  'Tu Pimp A Caterpillar': 'Tu Pimp A Caterpillar [V1]',
  'To Pimp A Butterfly [V2]': 'To Pimp A Butterfly',
  // vampgold
  'THC: The High Chronical$': 'The High Chronical$',
  'THC: The High Chronicals': 'The High Chronical$',
  'Ye - DONDA': 'Donda',
  // pushagold
  'Fear of God II: Let Us Pray': 'Fear of God II',
  'King Push – Darkest Before Dawn: The Prelude': 'Darkest Before Dawn',
  'King Push - Darkest Before Dawn: The Prelude': 'Darkest Before Dawn',
  // wolfgold — song rows use a shorter/differently-spaced name than the section header
  'PinkGold SquarePixals': 'PinkGoldSquarePixals',
  'SuperDuper SteezMonster': 'SuperDuperSteezMonster',
  'The OF Tape Vol. 1': 'The Odd Future Tape Vol. 1',
  'The OF Tape Vol. 2': 'The Odd Future Tape Vol. 2',
  'Grinch EP': "Music Inspired by Illumination & Dr. Seuss's The Grinch",
  'Infinite Rhyhtms': 'Infinite Rhythms',
  // wolfgold — the section header is titled "CALL ME WHEN YOU GET LOST" (with
  // "CALL ME IF YOU GET LOST [V1]" as a parenthetical); use that as the canonical
  // name and merge the V1-tagged song rows into it.
  'CALL ME IF YOU GET LOST [V1]': 'CALL ME WHEN YOU GET LOST',
  // wolfgold — single mistagged song row inside the WOLF [V3] block uses the
  // versionless "WOLF" era value; merge it into WOLF [V3].
  'WOLF': 'WOLF [V3]',
  // gorillazgold — song rows use short/typo'd names, section headers use the full names.
  'G-SIdes': 'G-Sides',
  'Journey To The West': 'Monkey - Journey To The West',
  'Song Machine, Season One': 'Song Machine, Season One: Strange Timez',
  // slimegold — CSV uses special characters / different era names
  'Hy!£UN35 [V3]': 'HiTunes [V3]',
  'Collaboration with Juice WRLD': 'Slime WRLD',
  // uzigold — the live sheet renamed/de-accented these eras
  'Delta Pink [V1]': 'Pink Tape [V1]',
  'Super geeky': 'Super gëëky',
};

export function mapEraName(name: string): string {
  return ERA_NAME_MAP[name] ?? name;
}
