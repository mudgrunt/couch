export interface SystemDefinition {
  /** Platform code stored in the DB (lowercase, no spaces) */
  platformCode: string;
  /** Human-readable platform name */
  platformName: string;
  /**
   * File extensions (lowercase, with leading dot) that are treated as a
   * single game entry. M3U and CUE are listed where applicable — their
   * referenced data files (.bin, .img, etc.) are intentionally excluded.
   */
  extensions: string[];
}

// ---------------------------------------------------------------------------
// System definitions — one object per platform
// ---------------------------------------------------------------------------

const GB: SystemDefinition = {
  platformCode: "gb",
  platformName: "Game Boy",
  extensions: [".gb", ".gbc", ".zip", ".7z"],
};
const GBC: SystemDefinition = {
  platformCode: "gbc",
  platformName: "Game Boy Color",
  extensions: [".gbc", ".gb", ".zip", ".7z"],
};
const GBA: SystemDefinition = {
  platformCode: "gba",
  platformName: "Game Boy Advance",
  extensions: [".gba", ".zip", ".7z"],
};
const NDS: SystemDefinition = {
  platformCode: "nds",
  platformName: "Nintendo DS",
  extensions: [".nds", ".zip", ".7z"],
};
const N3DS: SystemDefinition = {
  platformCode: "3ds",
  platformName: "Nintendo 3DS",
  extensions: [".3ds", ".cia", ".cxi"],
};
const NES: SystemDefinition = {
  platformCode: "nes",
  platformName: "NES",
  extensions: [".nes", ".fds", ".unf", ".unif", ".zip", ".7z"],
};
const SNES: SystemDefinition = {
  platformCode: "snes",
  platformName: "Super Nintendo",
  extensions: [".sfc", ".smc", ".fig", ".zip", ".7z"],
};
const N64: SystemDefinition = {
  platformCode: "n64",
  platformName: "Nintendo 64",
  extensions: [".z64", ".n64", ".v64", ".zip", ".7z"],
};
const GC: SystemDefinition = {
  platformCode: "gc",
  platformName: "GameCube",
  extensions: [".iso", ".rvz", ".gcm", ".ciso"],
};
const WII: SystemDefinition = {
  platformCode: "wii",
  platformName: "Wii",
  extensions: [".iso", ".rvz", ".wbfs", ".ciso"],
};
const WIIU: SystemDefinition = {
  platformCode: "wiiu",
  platformName: "Wii U",
  extensions: [".rpx", ".wud", ".wux"],
};
const SWITCH: SystemDefinition = {
  platformCode: "switch",
  platformName: "Nintendo Switch",
  extensions: [".nsp", ".xci", ".nca"],
};
const VB: SystemDefinition = {
  platformCode: "virtualboy",
  platformName: "Virtual Boy",
  extensions: [".vb", ".vboy", ".zip", ".7z"],
};

const SG1000: SystemDefinition = {
  platformCode: "sg1000",
  platformName: "SG-1000",
  extensions: [".sg", ".zip", ".7z"],
};
const SMS: SystemDefinition = {
  platformCode: "mastersystem",
  platformName: "Master System",
  extensions: [".sms", ".zip", ".7z"],
};
const GG: SystemDefinition = {
  platformCode: "gamegear",
  platformName: "Game Gear",
  extensions: [".gg", ".zip", ".7z"],
};
const GENESIS: SystemDefinition = {
  platformCode: "genesis",
  platformName: "Mega Drive / Genesis",
  extensions: [".md", ".smd", ".gen", ".bin", ".zip", ".7z"],
};
const S32X: SystemDefinition = {
  platformCode: "32x",
  platformName: "32X",
  extensions: [".32x", ".bin", ".zip", ".7z"],
};
const SEGACD: SystemDefinition = {
  platformCode: "segacd",
  platformName: "Mega-CD / Sega CD",
  extensions: [".cue", ".m3u", ".chd", ".iso"],
};
const SATURN: SystemDefinition = {
  platformCode: "saturn",
  platformName: "Sega Saturn",
  extensions: [".cue", ".m3u", ".chd", ".iso", ".mds"],
};
const DC: SystemDefinition = {
  platformCode: "dreamcast",
  platformName: "Dreamcast",
  extensions: [".cdi", ".gdi", ".chd", ".m3u"],
};

const PSX: SystemDefinition = {
  platformCode: "psx",
  platformName: "PlayStation",
  extensions: [".cue", ".m3u", ".chd", ".pbp", ".iso"],
};
const PS2: SystemDefinition = {
  platformCode: "ps2",
  platformName: "PlayStation 2",
  extensions: [".iso", ".m3u", ".chd"],
};
const PSP: SystemDefinition = {
  platformCode: "psp",
  platformName: "PlayStation Portable",
  extensions: [".iso", ".cso", ".pbp"],
};
const PS3: SystemDefinition = {
  platformCode: "ps3",
  platformName: "PlayStation 3",
  extensions: [".pkg"],
};

const XBOX: SystemDefinition = {
  platformCode: "xbox",
  platformName: "Xbox",
  extensions: [".iso", ".xbe"],
};
const XBOX360: SystemDefinition = {
  platformCode: "xbox360",
  platformName: "Xbox 360",
  extensions: [".iso", ".xex"],
};

const ATARI2600: SystemDefinition = {
  platformCode: "atari2600",
  platformName: "Atari 2600",
  extensions: [".a26", ".bin", ".zip", ".7z"],
};
const ATARI5200: SystemDefinition = {
  platformCode: "atari5200",
  platformName: "Atari 5200",
  extensions: [".a52", ".bin", ".zip", ".7z"],
};
const ATARI7800: SystemDefinition = {
  platformCode: "atari7800",
  platformName: "Atari 7800",
  extensions: [".a78", ".bin", ".zip", ".7z"],
};
const JAGUAR: SystemDefinition = {
  platformCode: "atarijaguar",
  platformName: "Atari Jaguar",
  extensions: [".j64", ".jag", ".zip", ".7z"],
};
const LYNX: SystemDefinition = {
  platformCode: "atarilynx",
  platformName: "Atari Lynx",
  extensions: [".lnx", ".zip", ".7z"],
};
const ATARI800: SystemDefinition = {
  platformCode: "atari800",
  platformName: "Atari 8-bit",
  extensions: [".atr", ".xex", ".xfd", ".zip", ".7z"],
};
const ATARIST: SystemDefinition = {
  platformCode: "atarist",
  platformName: "Atari ST",
  extensions: [".st", ".img", ".zip", ".7z"],
};

const PCE: SystemDefinition = {
  platformCode: "pcengine",
  platformName: "PC Engine / TurboGrafx-16",
  extensions: [".pce", ".cue", ".m3u", ".chd", ".zip", ".7z"],
};
const PCECD: SystemDefinition = {
  platformCode: "pcenginecd",
  platformName: "PC Engine CD",
  extensions: [".cue", ".m3u", ".chd"],
};

const NEOGEO: SystemDefinition = {
  platformCode: "neogeo",
  platformName: "Neo Geo",
  extensions: [".zip", ".7z"],
};
const NGP: SystemDefinition = {
  platformCode: "ngp",
  platformName: "Neo Geo Pocket",
  extensions: [".ngp", ".ngc", ".zip", ".7z"],
};

const MAME: SystemDefinition = {
  platformCode: "mame",
  platformName: "Arcade (MAME)",
  extensions: [".zip", ".7z", ".chd"],
};
const FBNEO: SystemDefinition = {
  platformCode: "fbneo",
  platformName: "Arcade (FBNeo)",
  extensions: [".zip", ".7z"],
};

const AMIGA: SystemDefinition = {
  platformCode: "amiga",
  platformName: "Amiga",
  extensions: [".adf", ".adz", ".dms", ".lha", ".zip", ".7z"],
};
const C64: SystemDefinition = {
  platformCode: "c64",
  platformName: "Commodore 64",
  extensions: [".d64", ".t64", ".crt", ".prg", ".zip", ".7z"],
};
const DOS: SystemDefinition = {
  platformCode: "dos",
  platformName: "DOS",
  extensions: [".exe", ".com", ".bat", ".zip", ".7z"],
};
const SCUMMVM: SystemDefinition = {
  platformCode: "scummvm",
  platformName: "ScummVM",
  extensions: [".scummvm"],
};

// ---------------------------------------------------------------------------
// Folder-name → system map (add aliases as extra keys pointing to the same def)
// ---------------------------------------------------------------------------

export const SYSTEMS: Record<string, SystemDefinition> = {
  // Nintendo
  gb: GB,
  gameboy: GB,
  gbc: GBC,
  gameboycolor: GBC,
  gba: GBA,
  gameboyadvance: GBA,
  nds: NDS,
  ds: NDS,
  "3ds": N3DS,
  n3ds: N3DS,
  nes: NES,
  famicom: NES,
  snes: SNES,
  superfamicom: SNES,
  n64: N64,
  nintendo64: N64,
  gc: GC,
  gamecube: GC,
  wii: WII,
  wiiu: WIIU,
  switch: SWITCH,
  ns: SWITCH,
  virtualboy: VB,
  vb: VB,

  // Sega
  sg1000: SG1000,
  mastersystem: SMS,
  sms: SMS,
  segams: SMS,
  gamegear: GG,
  gg: GG,
  genesis: GENESIS,
  megadrive: GENESIS,
  md: GENESIS,
  gen: GENESIS,
  "32x": S32X,
  sega32x: S32X,
  segacd: SEGACD,
  megacd: SEGACD,
  saturn: SATURN,
  dreamcast: DC,
  dc: DC,

  // Sony
  psx: PSX,
  ps1: PSX,
  playstation: PSX,
  ps2: PS2,
  playstation2: PS2,
  psp: PSP,
  ps3: PS3,
  playstation3: PS3,

  // Microsoft
  xbox: XBOX,
  xbox360: XBOX360,

  // Atari
  atari2600: ATARI2600,
  "2600": ATARI2600,
  atari5200: ATARI5200,
  "5200": ATARI5200,
  atari7800: ATARI7800,
  "7800": ATARI7800,
  atarijaguar: JAGUAR,
  jaguar: JAGUAR,
  atarilynx: LYNX,
  lynx: LYNX,
  atari800: ATARI800,
  atari8bit: ATARI800,
  atarist: ATARIST,
  st: ATARIST,

  // NEC
  pcengine: PCE,
  tg16: PCE,
  turbografx: PCE,
  pcenginecd: PCECD,
  tg16cd: PCECD,

  // SNK
  neogeo: NEOGEO,
  neo: NEOGEO,
  ngp: NGP,
  neogeopocket: NGP,

  // Arcade
  mame: MAME,
  arcade: MAME,
  fbneo: FBNEO,
  fba: FBNEO,

  // Computers
  amiga: AMIGA,
  c64: C64,
  commodore64: C64,
  dos: DOS,
  pc: DOS,
  scummvm: SCUMMVM,
};
