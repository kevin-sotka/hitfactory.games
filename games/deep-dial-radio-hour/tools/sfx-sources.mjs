// What each sound element wants from the outside world. Real recordings come
// from Freesound, CC0 only. Things nobody has recorded (a hover scooter, a
// ghost on the radio) are generated instead. Both tools read this list.
//
// bed:  a long ambience to loop (search finds 30 s to 5 min recordings)
// shot: short moments the scheduler fires (one search per query, top results)
// ai:   prompts for generated sound: [prompt, seconds]; 15 s or more loops as a bed

export const SOURCES = {
  // Prairie Desert Station
  wind: { bed: ['desert wind ambience', 'prairie wind grass'], ai: [['gusty dry wind blowing across an open desert prairie, rustling dry grass, no music, continuous ambience', 22]] },
  train: { shot: ['steam locomotive passing whistle', 'steam train pass by'], ai: [['old steam locomotive approaching and passing by, chuffing, clanking rails, a long steam whistle, fading away', 12]] },
  windmill: { shot: ['windmill creak', 'metal creak squeak wind pump'], ai: [['old metal farm windmill slowly turning and creaking in the wind, rusty squeak', 4], ['rusty windpump creak and clank', 3]] },
  telegraph: { shot: ['telegraph key morse', 'telegraph sounder'], ai: [['old telegraph key tapping a short morse code message, mechanical clicks, close up', 4]] },
  coyote: { shot: ['coyote howl', 'coyotes howling night'], ai: [['lone coyote howling in the distance at dusk across a desert', 5], ['two coyotes yipping and howling far away at night', 5]] },
  cicadas: { bed: ['cicadas summer', 'insects dry grass heat'], ai: [['cicadas buzzing in hot dry summer grass, steady insect drone, continuous ambience', 22]] },

  // Evening Campground
  crickets: { bed: ['crickets night', 'crickets evening field'], ai: [['crickets chirping at night in a quiet forest campsite, continuous ambience', 22]] },
  campfire: { bed: ['campfire crackling', 'fire crackle close'], ai: [['campfire crackling and popping close up, logs burning, continuous', 22]] },
  creek: { bed: ['lake shore gentle water lapping', 'small waves lake shore'], ai: [['gentle lake water lapping against a pebbly shore at night, calm, continuous', 22]] },
  owl: { shot: ['owl hoot', 'great horned owl'], ai: [['great horned owl hooting in a pine forest at night, distant', 4]] },
  guitar: { bed: ['acoustic guitar strumming campfire', 'fingerpicking acoustic guitar loop'], ai: [['mellow acoustic guitar gently strummed by a campfire, slow folk chords, heard from a few metres away, outdoors', 22]] },
  frogs: { bed: ['frogs night chorus', 'tree frogs pond'], ai: [['chorus of frogs croaking around a lake at night, continuous', 22]] },

  // Seashore Docks
  waves: { bed: ['ocean waves shore', 'waves pier harbour'], ai: [['ocean waves rolling onto a beach and slapping against wooden pier pilings, continuous seaside ambience', 22]] },
  gulls: { shot: ['seagull call', 'herring gull'], ai: [['seagulls calling over a harbour', 3], ['a single herring gull squawking close by', 2]] },
  foghorn: { shot: ['foghorn', 'ship horn distant'], ai: [['deep ship foghorn blowing across a foggy harbour, long low blast with echo', 6]] },
  buoy: { shot: ['bell buoy', 'harbour bell'], ai: [['bell buoy clanging gently as it rocks on the sea', 4]] },
  rigging: { bed: ['halyard clanking mast marina', 'sailboat rigging wind marina'], ai: [['sailboat halyards clinking against aluminium masts in a windy marina, continuous', 22]] },
  pier: { shot: ['wooden dock creak', 'pier wood creaking boat'], ai: [['old wooden dock creaking under the weight of a moored boat', 3], ['wooden pier boards groaning and creaking', 3]] },

  // Neon Night Market
  rain: { bed: ['rain city street', 'rain on awning'], ai: [['warm steady rain falling on a city street at night, drips on awnings, continuous', 22]] },
  neon: { bed: ['neon sign buzz hum'], shot: ['electrical buzz flicker'], ai: [['electric hum and buzz of an old neon sign, continuous', 22]] },
  wok: { shot: ['wok frying sizzle', 'stir fry sizzle'], ai: [['food sizzling in a hot wok at a street food stall, oil spitting, metal spatula clang', 4]] },
  scooter: { ai: [['futuristic hover scooter whooshing past from left to right, electric whine with doppler', 4], ['sci-fi hoverbike passing by quickly in the rain, smooth electric hum', 4]] },
  crowd: { bed: ['night market crowd walla', 'busy street market crowd'], ai: [['busy night market crowd murmuring, indistinct chatter, footsteps, distant vendors, continuous', 22]] },
  busker: { ai: [['street busker playing a mellow retro synthesizer melody, lo-fi, heard from across a rainy street', 22]] },

  // Abyssal Trench
  sonar: { shot: ['sonar ping', 'submarine sonar'], ai: [['submarine sonar ping with a long underwater echo', 3]] },
  hull: { shot: ['submarine hull creak', 'metal ship groan stress'], ai: [['deep metal hull of a submarine groaning and creaking under pressure', 5]] },
  whale: { shot: ['humpback whale song', 'whale call underwater'], ai: [['humpback whale song echoing underwater', 8]] },
  bubbles: { shot: ['underwater bubbles', 'bubbles rising water'], ai: [['burst of air bubbles rising underwater', 2]] },
  current: { bed: ['underwater ambience deep', 'hydrophone underwater drone'], ai: [['deep underwater ambience inside a submarine, low rumble of ocean current, muffled, continuous', 22]] },
  ghost: { ai: [['ghostly old radio transmission from the deep sea, warbling shortwave tones, faint morse code, eerie static', 4], ['haunted radio signal drifting in and out, whistling heterodyne and crackle', 4]] },
};

// Duration windows for the Freesound search.
export const DURATION = { bed: [30, 400], shot: [0.4, 14] };
