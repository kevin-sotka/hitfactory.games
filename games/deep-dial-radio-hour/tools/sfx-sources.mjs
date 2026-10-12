// What each sound element wants from the outside world. Real recordings come
// from Freesound, CC0 only. Things nobody has recorded (a hover scooter, a
// ghost on the radio) are generated instead. Both tools read this list.
//
// bed:  a long ambience to loop (search finds 30 s to 5 min recordings)
// shot: short moments the scheduler fires (one search per query, top results)
// ai:   prompts for generated one-shots: [prompt, seconds]

export const SOURCES = {
  // Prairie Desert Station
  wind: { bed: ['desert wind ambience', 'prairie wind grass'] },
  train: { shot: ['steam locomotive passing whistle', 'steam train pass by'] },
  windmill: { shot: ['windmill creak', 'metal creak squeak wind pump'] },
  telegraph: { shot: ['telegraph key morse', 'telegraph sounder'] },
  coyote: { shot: ['coyote howl', 'coyotes howling night'] },
  cicadas: { bed: ['cicadas summer', 'insects dry grass heat'] },

  // Evening Campground
  crickets: { bed: ['crickets night', 'crickets evening field'] },
  campfire: { bed: ['campfire crackling', 'fire crackle close'] },
  creek: { bed: ['lake shore gentle water lapping', 'small waves lake shore'] },
  owl: { shot: ['owl hoot', 'great horned owl'] },
  guitar: { bed: ['acoustic guitar strumming campfire', 'fingerpicking acoustic guitar loop'] },
  frogs: { bed: ['frogs night chorus', 'tree frogs pond'] },

  // Seashore Docks
  waves: { bed: ['ocean waves shore', 'waves pier harbour'] },
  gulls: { shot: ['seagull call', 'herring gull'] },
  foghorn: { shot: ['foghorn', 'ship horn distant'] },
  buoy: { shot: ['bell buoy', 'harbour bell'] },
  rigging: { bed: ['halyard clanking mast marina', 'sailboat rigging wind marina'] },
  pier: { shot: ['wooden dock creak', 'pier wood creaking boat'] },

  // Neon Night Market
  rain: { bed: ['rain city street', 'rain on awning'] },
  neon: { bed: ['neon sign buzz hum'], shot: ['electrical buzz flicker'] },
  wok: { shot: ['wok frying sizzle', 'stir fry sizzle'] },
  scooter: { ai: [['futuristic hover scooter whooshing past from left to right, electric whine with doppler', 4], ['sci-fi hoverbike passing by quickly in the rain, smooth electric hum', 4]] },
  crowd: { bed: ['night market crowd walla', 'busy street market crowd'] },
  busker: { ai: [['street busker playing a mellow retro synthesizer melody, lo-fi, heard from across a rainy street', 22]] },

  // Abyssal Trench
  sonar: { shot: ['sonar ping', 'submarine sonar'] },
  hull: { shot: ['submarine hull creak', 'metal ship groan stress'] },
  whale: { shot: ['humpback whale song', 'whale call underwater'] },
  bubbles: { shot: ['underwater bubbles', 'bubbles rising water'] },
  current: { bed: ['underwater ambience deep', 'hydrophone underwater drone'] },
  ghost: { ai: [['ghostly old radio transmission from the deep sea, warbling shortwave tones, faint morse code, eerie static', 4], ['haunted radio signal drifting in and out, whistling heterodyne and crackle', 4]] },
};

// Duration windows for the Freesound search.
export const DURATION = { bed: [30, 400], shot: [0.4, 14] };
