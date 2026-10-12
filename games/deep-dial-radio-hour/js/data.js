// Deep Dial Radio Hour: scenes, sound elements and the five radio stories.
//
// Every story has the same ten beats, so any station can pick up any other
// station's story mid-sentence. Templates use {slot} placeholders:
//   cast (rolled once per play, kept across station switches):
//     {hero} {side} {villain}   first mention, full introduction
//     {hero.short} ...          every later mention
//     {aThing} first mention, {thing} after ("the {thing}")
//   scene (whatever is outside the window when the line is spoken):
//     {place} {landmark} {sound} {weather} {critter} {smell} {light}
//   station flavour: {exclaim} {food} {num} {station} {title}
// Cast members are never referred to by pronoun, so any hero fits any story.

export const BEATS = ['open', 'hero', 'want', 'incite', 'pursuit', 'midpoint', 'trouble', 'low', 'climax', 'coda'];
export const MIDPOINT = 5;

// Which cast slots each beat introduces. Before that beat, a slot may not be
// used; on that beat it must be introduced; after it, only the short form.
export const INTRODUCES = { hero: 1, side: 1, thing: 2, villain: 3 };

export const ENVIRONMENTS = [
  {
    id: 'prairie', name: 'Prairie Desert Station', short: 'Prairie', hue: '#ff9f43', time: 'Dusk',
    vocab: {
      place: 'the Dry Gulch railway depot', landmark: 'the leaning water tower',
      sound: 'the far off whistle of a train', weather: 'a hot wind full of grit',
      critter: 'a jackrabbit with shifty eyes', smell: 'creosote and hot dust',
      light: 'a sunset the colour of a bruised peach',
    },
    layers: [
      { id: 'wind', label: 'Prairie Wind', code: 'WND' },
      { id: 'train', label: 'Steam Train', code: 'LOC' },
      { id: 'windmill', label: 'Windmill Creak', code: 'MIL' },
      { id: 'telegraph', label: 'Telegraph Key', code: 'TEL' },
      { id: 'coyote', label: 'Coyote', code: 'COY' },
      { id: 'cicadas', label: 'Dry Grass Cicadas', code: 'CIC' },
    ],
  },
  {
    id: 'campground', name: 'Evening Campground', short: 'Campground', hue: '#4cd97b', time: 'Nightfall',
    vocab: {
      place: 'Lake Wobbegong campground', landmark: 'the big old gum tree',
      sound: 'the crackle of the campfire', weather: 'a cool breeze through the pines',
      critter: 'a possum with a torch', smell: 'woodsmoke and burnt sausage',
      light: 'the orange glow of the fire',
    },
    layers: [
      { id: 'crickets', label: 'Crickets', code: 'CRK' },
      { id: 'campfire', label: 'Campfire', code: 'FIR' },
      { id: 'creek', label: 'Lake Lapping', code: 'LAP' },
      { id: 'owl', label: 'Owl', code: 'OWL' },
      { id: 'guitar', label: 'Camp Guitar', code: 'GTR' },
      { id: 'frogs', label: 'Frogs', code: 'FRG' },
    ],
  },
  {
    id: 'docks', name: 'Seashore Docks', short: 'Docks', hue: '#35c9ff', time: 'Golden hour',
    vocab: {
      place: 'the old docks at Ballyshannon Point', landmark: 'the lighthouse',
      sound: 'the slap of waves on the pilings', weather: 'a salty wind with spray in it',
      critter: 'a gull with a criminal record', smell: 'brine and fried fish',
      light: 'the sweep of the lighthouse beam',
    },
    layers: [
      { id: 'waves', label: 'Ocean Waves', code: 'SEA' },
      { id: 'gulls', label: 'Seagulls', code: 'GUL' },
      { id: 'foghorn', label: 'Foghorn', code: 'FOG' },
      { id: 'buoy', label: 'Buoy Bell', code: 'BUO' },
      { id: 'rigging', label: 'Rigging Clinks', code: 'RIG' },
      { id: 'pier', label: 'Creaking Pier', code: 'PIR' },
    ],
  },
  {
    id: 'market', name: 'Neon Night Market', short: 'Night Market', hue: '#ff3ea5', time: 'Midnight',
    vocab: {
      place: 'the Neon Night Market on Lantern Street', landmark: 'the giant flickering noodle sign',
      sound: 'the hiss of rain on hot woks', weather: 'a warm rain that never quite stopped',
      critter: 'a hover pigeon', smell: 'ginger, ozone and wet pavement',
      light: 'the glow of a thousand pink and cyan signs',
    },
    layers: [
      { id: 'rain', label: 'Warm Rain', code: 'RAN' },
      { id: 'neon', label: 'Neon Hum', code: 'NEO' },
      { id: 'wok', label: 'Wok Sizzle', code: 'WOK' },
      { id: 'scooter', label: 'Hover Scooters', code: 'HOV' },
      { id: 'crowd', label: 'Crowd Murmur', code: 'CRW' },
      { id: 'busker', label: 'Synth Busker', code: 'SYN' },
    ],
  },
  {
    id: 'trench', name: 'Abyssal Trench', short: 'Trench', hue: '#9a8cff', time: 'Always night',
    vocab: {
      place: 'the bottom of the Mariana Trench', landmark: 'the black smoker vents',
      sound: 'the ping of the sonar', weather: 'a cold, slow current',
      critter: 'a glowing jellyfish', smell: 'diesel and stewed tea',
      light: 'the blue glow of the instrument panel',
    },
    layers: [
      { id: 'sonar', label: 'Sonar Ping', code: 'SON' },
      { id: 'hull', label: 'Hull Groan', code: 'HUL' },
      { id: 'whale', label: 'Whale Song', code: 'WHL' },
      { id: 'bubbles', label: 'Bubbles', code: 'BUB' },
      { id: 'current', label: 'Deep Current', code: 'CUR' },
      { id: 'ghost', label: 'Ghost Signal', code: 'GST' },
    ],
  },
];

export const STORIES = [
  {
    id: 'prairie', freq: 540, call: 'KDRY', station: 'KDRY 540', title: 'The 4:15 to Nowhere',
    narrator: 'The Drifter', accent: 'Texas drawl',
    voice: { langs: ['en-US'], names: ['Google US English', 'Aaron', 'Fred', 'Microsoft Guy', 'Microsoft Christopher', 'Microsoft David', 'Alex', 'Samantha'], rate: 0.92, pitch: 0.85 },
    pools: {
      exclaim: ['Well, butter my biscuits', 'Hoo doggie', 'Well, I will be', 'Sweet sassafras'],
      food: ['a can of cold beans', 'a chili dog of questionable age', 'a stack of flapjacks', 'a warm sarsaparilla'],
      num: ['forty', 'seventeen', 'nine', 'a hundred and six'],
    },
    cast: {
      hero: [
        { intro: 'Dusty Pennywhistle, a retired rodeo clown with one good boot', short: 'Dusty' },
        { intro: 'Loretta Spurgeon, a telegraph operator who could tap Morse code with an eyebrow', short: 'Loretta' },
        { intro: 'Ezekiel Two Hats Crump, who wore two hats at once and refused to explain', short: 'Two Hats' },
        { intro: 'Marigold Featherstone, a cactus botanist on the run from a cactus', short: 'Marigold' },
      ],
      side: [
        { intro: 'a mule called Professor Biscuit', short: 'Professor Biscuit' },
        { intro: 'a tumbleweed named Gary', short: 'Gary' },
        { intro: 'a nervous accordion salesman named Pip', short: 'Pip' },
        { intro: 'a one eyed rooster called Judge Lawrence', short: 'Judge Lawrence' },
      ],
      thing: ['golden harmonica', 'jar of pickled thunder', 'deed to the moon', 'map drawn on a pancake'],
      villain: [
        { intro: 'Black Bart Vanderbilt, the most polite outlaw in Texas', short: 'Black Bart' },
        { intro: 'the Widow Clementine and her gang of synchronised square dancers', short: 'the Widow Clementine' },
        { intro: 'a clockwork lawman called Sheriff Nine Thousand', short: 'Sheriff Nine Thousand' },
        { intro: 'Rattlesnake Ronnie, who rattled every time he told a lie', short: 'Rattlesnake Ronnie' },
      ],
    },
    arrive: [
      'Well, howdy. Looks like somebody done twisted the dial. Don\'t you fret, I know right where we are.',
      'Hold your horses, folks. New station, same story, I reckon.',
    ],
    drift: [
      'Now hold on, this signal is driftin\' like a tumbleweed in a twister...',
      'Somethin\' is pullin\' at the aerial, partners. Grab your hats...',
    ],
    beats: [
      [
        'Evenin\', partners, and welcome to {station}. Pull up a hay bale. Tonight\'s tale is called {title}, and it begins at {place}, under {light}, with {weather} blowin\' through.',
        'This here is {station}, and you are tuned to {title}. Picture {place}. Picture {light}. Now picture somebody about to make a real bad decision.',
      ],
      [
        'Our story concerns {hero}. Ridin\' alongside was {side}, who had opinions about everything and shared every last one of \'em.',
        'Now, nobody at {place} trusted {hero}. But they trusted {side} even less, and that is sayin\' somethin\'.',
      ],
      [
        'All {hero.short} wanted in this wide world was {aThing}. Folks said it was cursed. Folks also said {food} was a balanced breakfast, so who knows.',
        'Legend told of {aThing}, hidden somewhere near {landmark}. {hero.short} had spent {num} years lookin\' for it, and every one of \'em complainin\'.',
      ],
      [
        'Then, right on time, the 4:15 rolled in, and off stepped {villain}. {exclaim}. That is trouble with a capital T and a lowercase everything else.',
        'But before anybody could say howdy, out of the dust came {villain}, wantin\' the {thing} for wicked purposes. Mostly tax purposes.',
      ],
      [
        'So {hero.short} and {side.short} lit out after the 4:15 on a borrowed handcar, pumpin\' so hard the rails started sweatin\'. Behind \'em, {sound} got closer and closer.',
        'There was a chase. There was a stampede. There was, for reasons nobody can explain, a mariachi band. {side.short} played the triangle the whole way.',
      ],
      [
        'And then, halfway across the trestle bridge, {hero.short} looked down and realized the {thing} had been in a boot the whole time. Somebody else\'s boot.',
        'Here is the twist, friends. {villain.short} was never after the {thing} at all. {villain.short} just wanted somebody to share {food} with, and took a long time to say so.',
      ],
      [
        'Course, that is when the train jumped the tracks, the cattle formed a union, and {critter} stole the last good map. {exclaim}.',
        'Things got worse. A sandstorm rolled in so thick you could slice it and serve it with gravy. {side.short} got lost twice, once on purpose.',
      ],
      [
        'By midnight, {hero.short} sat alone by {landmark}, boots full of sand, heart full of beans. Even {side.short} had gone quiet, which had never happened before.',
        'It looked like the end of the line. {villain.short} had the {thing}, the 4:15 had left without anybody, and {smell} hung in the air like regret.',
      ],
      [
        'Then {hero.short} stood up, dusted off, and challenged {villain.short} to the only duel that matters out here. A staring contest. It lasted {num} hours. Then a moth landed.',
        'So {hero.short} did the bravest thing a body can do. Yodelled. Loud, long, and mighty off key. {villain.short} fled clean to Albuquerque, and the {thing} came tumblin\' back.',
      ],
      [
        'And that is how {hero.short} and {side.short} rode off into {light}, the {thing} safe at last. The moral? Never trust a train that is on time. This has been {station}. Mind the tumbleweeds.',
        'They say on quiet nights at {place} you can still hear {sound}, and somewhere, {side.short} still playin\' the triangle. Goodnight from {station}, partners.',
      ],
    ],
  },
  {
    id: 'campground', freq: 710, call: 'Billabong', station: 'Radio Billabong 710', title: 'The Marshmallow Protocol',
    narrator: 'The Ranger', accent: 'Australian',
    voice: { langs: ['en-AU'], names: ['Google Australian', 'Lee', 'Karen', 'Microsoft William', 'Microsoft Natasha', 'Catherine'], rate: 1.0, pitch: 1.0 },
    pools: {
      exclaim: ['Strewth', 'Fair dinkum', 'Crikey', 'Stone the crows'],
      food: ['a burnt snag', 'a cold meat pie', 'a squashed lamington', 'a fistful of Vegemite toast'],
      num: ['eleven', 'forty two', 'three', 'a hundred and six'],
    },
    cast: {
      hero: [
        { intro: 'Shazza McAllister, a park ranger with a whistle for every occasion', short: 'Shazza' },
        { intro: 'Barry Dingwall, scoutmaster, knot enthusiast, and lifelong rival of the moon', short: 'Barry' },
        { intro: 'Kylie Thornbury, who had never once lost a game of I spy', short: 'Kylie' },
        { intro: 'Bruce Wigglesworth, a bloke who brought a toaster camping', short: 'Bruce' },
      ],
      side: [
        { intro: 'a wombat named Sergeant Crumpet', short: 'Sergeant Crumpet' },
        { intro: 'a possum who only ate fancy cheese, called Lady Penelope', short: 'Lady Penelope' },
        { intro: 'a talking thermos named Trevor', short: 'Trevor' },
        { intro: 'a kookaburra who laughed at all the wrong moments, called Dennis', short: 'Dennis' },
      ],
      thing: ['perfect marshmallow', 'lucky sock', 'golden tent peg', 'last packet of chocolate biscuits'],
      villain: [
        { intro: 'a drop bear named Mister Snuggles', short: 'Mister Snuggles' },
        { intro: 'a cassowary called Deborah, who held a personal grudge', short: 'Deborah' },
        { intro: 'Ranger Rick from the rival campground', short: 'Ranger Rick' },
        { intro: 'a very large goanna in a cardigan', short: 'the goanna' },
      ],
    },
    arrive: [
      'Oi, hang on, we\'ve changed stations. No dramas, I\'ll pick it up from here.',
      'Righto, this is {station} now. Don\'t touch that dial again, ya larrikin.',
    ],
    drift: [
      'Hang on, the reception\'s going a bit wobbly, mate...',
      'Oh, the aerial\'s carking it. Somebody give it a whack...',
    ],
    beats: [
      [
        'G\'day campers, you\'re listening to {station}. Tonight\'s yarn is {title}. Picture it. {place}, {light}, and {smell} driftin\' about. Lovely.',
        'Righto, it\'s {station}, gather round the wireless. This one\'s called {title}. It all kicked off at {place}, on a night with {weather} and not a single working torch.',
      ],
      [
        'Now, there once was {hero}. And never far behind was {side}, carrying the snacks, and also the emotional baggage.',
        'Everyone at {place} knew {hero}. Everyone also knew {side}, mostly because of the incident with the canoe. We don\'t talk about the canoe.',
      ],
      [
        'Tonight, {hero.short} had one goal. To toast {aThing}. Well, first to find it, then to toast it. Order of operations, mate.',
        'See, there\'s an old campfire legend about {aThing}, buried under {landmark}. Whoever finds it gets braggin\' rights for {num} summers. Big stakes.',
      ],
      [
        'But then, out of the scrub, came {villain}. {exclaim}. The fire went sideways. A kookaburra laughed, which honestly wasn\'t helping.',
        'Trouble arrived the way it always does, in thongs, at speed. It was {villain}, come for the {thing} and every last marshmallow on the site.',
      ],
      [
        'So off they went, {hero.short} and {side.short}, crashing through the bush by torchlight, over the creek, under a fence, and straight through somebody\'s very nice picnic.',
        'There was a canoe chase. A canoe chase, on dry land. {side.short} did the paddling, {hero.short} did the yelling, and {critter} came along for the vibes.',
      ],
      [
        'And here\'s the kicker. Halfway up the hill, {hero.short} realised the map was upside down, and so, technically, was the entire hemisphere.',
        'Then the twist. {villain.short} pulled off a disguise, and underneath was... another disguise. Disguises all the way down. Nobody saw that coming. Except {critter}.',
      ],
      [
        'Things went pear shaped. A storm rolled in, the tent took off like a kite, and {side.short} got stuck up {landmark} with a very judgmental possum.',
        'Then the mozzies arrived. Thousands of \'em. Organised. One of them had a little clipboard. {exclaim}. It was a proper disaster.',
      ],
      [
        'By the time the fire burned low, {hero.short} had lost the {thing}, two thongs, and most of their dignity. Even {food} couldn\'t fix this one.',
        'It was grim, campers. {villain.short} was winning, the marshmallows were gone, and {side.short} had started writing a farewell song on a banjo with one string.',
      ],
      [
        'Then {hero.short} had an idea so daft it just might work. Ghost stories. The scariest one ever told. By the end, {villain.short} was hiding in the esky, begging for a cuddle.',
        'So {hero.short} reached for the oldest weapon in the bush. The billy can? No. A whistle. One mighty blast and {villain.short} hopped off into the night like a startled roo.',
      ],
      [
        'And so the {thing} was saved, the marshmallows were perfect, and {side.short} finally got a go with the toasting stick. You\'ve been listening to {station}. Put that fire out properly, ya galahs.',
        'They\'re still camped at {place} to this day, with {sound} going and {food} on the coals. That\'s the yarn, folks. {station}, signing off. Hooroo.',
      ],
    ],
  },
  {
    id: 'docks', freq: 880, call: 'Saltwater', station: 'Saltwater Wireless 880', title: 'The Ballad of the Leaky Gull',
    narrator: 'The Old Salt', accent: 'Irish',
    voice: { langs: ['en-IE'], names: ['Moira', 'Microsoft Connor', 'Microsoft Emily', 'Google Irish'], rate: 0.95, pitch: 0.95 },
    pools: {
      exclaim: ['Janey Mac', 'Holy mackerel', 'Good God almighty', 'Well, would you look at that'],
      food: ['a fish supper', 'a soggy chip', 'a pot of strong tea', 'a slice of barmbrack'],
      num: ['seven', 'ninety', 'a hundred', 'twelve'],
    },
    cast: {
      hero: [
        { intro: 'Captain Fionnuala Flynn, who had sailed every sea and three large puddles', short: 'Captain Flynn' },
        { intro: 'Seamus O\'Driscoll, a lighthouse keeper afraid of the dark', short: 'Seamus' },
        { intro: 'Mairead Kelly, the fastest net mender in all of Cork', short: 'Mairead' },
        { intro: 'Declan Quill, a poet who only ever rhymed by accident', short: 'Declan' },
      ],
      side: [
        { intro: 'a seagull called Brendan the Bold', short: 'Brendan' },
        { intro: 'a lobster in a tiny waistcoat named Mister Pinch', short: 'Mister Pinch' },
        { intro: 'a retired mermaid called Auntie Nora', short: 'Auntie Nora' },
        { intro: 'a dog named Biscuits who could smell the weather coming', short: 'Biscuits' },
      ],
      thing: ['silver whistle of the selkies', 'barrel of enchanted butter', 'compass that only pointed at sandwiches', 'pearl the size of a turnip'],
      villain: [
        { intro: 'the Kraken\'s accountant', short: 'the accountant' },
        { intro: 'Lady Morag Blackwater and her fleet of rubber ducks', short: 'Lady Blackwater' },
        { intro: 'a fog with opinions', short: 'the fog' },
        { intro: 'the Herring Baron of Galway', short: 'the Herring Baron' },
      ],
    },
    arrive: [
      'Ah, there you are now. Turned the dial, did you? Grand. I\'ll take it from here.',
      'Well, the wireless has gone and changed its mind. Never mind. Where was I?',
    ],
    drift: [
      'Ah, the signal\'s slipping away on the tide, so it is...',
      'Hold on now, there\'s a wee crackle coming over the water...',
    ],
    beats: [
      [
        'Ah, you\'ve found us. This is {station}, and tonight\'s tale is {title}. Settle in now. It begins at {place}, with {weather} and {sound}, as the good ones always do.',
        'Good evening and you\'re very welcome to {station}. Put the kettle on. The story is {title}, and it starts at {place}, under {light}, on a night not fit for a duck.',
      ],
      [
        'There lived, in those parts, {hero}. And beside them, always, was {side}, loyal as the tide, and about as predictable.',
        'Now, you\'ll have heard of {hero}. Everyone has. Fewer have heard of {side}, which suited everyone grand, on account of the money owed to half the harbour.',
      ],
      [
        'And what {hero.short} wanted, more than fish, more than fame, was {aThing}. It was said to lie at the bottom of the bay, under a sulking crab.',
        'The old folk spoke of {aThing}, lost the night {landmark} went dark. {hero.short} swore an oath to find it, then swore a few other things as well.',
      ],
      [
        'But the sea has a long memory and a short temper. Out of the fog came {villain}. {exclaim}. Every gull on the pier went silent at once.',
        'That very night, a ship with black sails and a squeaky wheel docked at {place}. Down the gangplank strolled {villain}, come for the {thing}.',
      ],
      [
        'So {hero.short} and {side.short} stole a rowing boat called the Leaky Gull, which leaked, and gave chase across the harbour, bailing with a teapot.',
        'Out they went, over the waves, with {sound} behind them and {villain.short} ahead, and {side.short} singing a sea shanty that had no end, only more verses.',
      ],
      [
        'Then, halfway across the bay, the Leaky Gull hit something. It wasn\'t a rock. It was a whale. And the whale, would you believe it, was holding the {thing}.',
        'And here\'s where it turns, now. {hero.short} opened the old sea chest and found a letter. It said the {thing} was never lost. It was only shy.',
      ],
      [
        'Well, then it all went to ruin. The fog thickened, the oars floated off on their own, and {critter} stole the last sandwich. {exclaim}.',
        'The wind rose like a banshee with a grievance. Waves as big as churches. {side.short} was sick over the side {num} times and counted every one out loud.',
      ],
      [
        'By dawn, the Leaky Gull was mostly a memory, {hero.short} was clinging to a barrel, and the {thing} was further away than Sunday.',
        'And so they drifted, cold and wet and beaten, with {smell} in their noses and not a hope in the world. Or so it seemed. It usually seems that way.',
      ],
      [
        'But then {hero.short} remembered the oldest trick on the water. Flattery. {villain.short} was told, very sincerely, about their lovely eyes, blushed scarlet, dropped the {thing}, and sailed off to think about it.',
        'Then {side.short} struck up a jig so lively the whole sea started dancing, and {villain.short}, who never could resist a jig, danced right off the edge of the map.',
      ],
      [
        'And that\'s the ballad, more or less. The {thing} sits in a jar behind the bar at {place} to this day. Ask for it by name. You\'ve been listening to {station}. Mind the gulls.',
        'They came home with the tide, {hero.short} and {side.short}, and were never quite the same, which is the whole point of an adventure. Goodnight now, from all of us at {station}.',
      ],
    ],
  },
  {
    id: 'market', freq: 1050, call: 'Neon', station: 'Station Neon 1050', title: 'The Big Sleep Mode',
    narrator: 'The Inspector', accent: 'London',
    voice: { langs: ['en-GB'], names: ['Daniel', 'Google UK English Male', 'Arthur', 'Microsoft Ryan', 'Microsoft George', 'Oliver', 'Serena', 'Google UK English Female'], rate: 0.97, pitch: 0.9 },
    pools: {
      exclaim: ['Good grief', 'Blimey', 'Oh, for heaven\'s sake', 'Great Scott'],
      food: ['a dumpling of dubious origin', 'a lukewarm cup of tea', 'a battery flavoured noodle', 'a soggy crumpet'],
      num: ['three', 'nineteen', 'two thousand', 'eight'],
    },
    cast: {
      hero: [
        { intro: 'Detective Inspector Penelope Grime, who had seen everything twice', short: 'Inspector Grime' },
        { intro: 'Rupert Saxby Fogg, a disgraced umbrella salesman', short: 'Rupert' },
        { intro: 'Agent Nine Lives, a cat burglar who was, technically, a cat', short: 'Agent Nine Lives' },
        { intro: 'Doctor Mildred Voltage, inventor of the self buttering crumpet', short: 'Doctor Voltage' },
      ],
      side: [
        { intro: 'a malfunctioning butler robot called Jeeves Mark Four', short: 'Jeeves' },
        { intro: 'a hologram of a pigeon named Clive', short: 'Clive' },
        { intro: 'a noodle chef called Mrs Okafor who knew absolutely everyone', short: 'Mrs Okafor' },
        { intro: 'a talking umbrella named Gerald', short: 'Gerald' },
      ],
      thing: ['neon teacup', 'encrypted dumpling', 'last honest password', 'umbrella that rained upward'],
      villain: [
        { intro: 'the Duchess of Static', short: 'the Duchess' },
        { intro: 'Mister Fizz, a vending machine with a criminal record', short: 'Mister Fizz' },
        { intro: 'the Velvet Algorithm', short: 'the Algorithm' },
        { intro: 'Sir Reginald Chrome and his clockwork corgis', short: 'Sir Reginald' },
      ],
    },
    arrive: [
      'Ahem. The case has changed hands, as cases do in this city.',
      'Station Neon here. Someone has fiddled with the dial. I shall overlook it, this once.',
    ],
    drift: [
      'Hm. The signal appears to be... interfering with itself...',
      'One moment. Something is tampering with the frequency. How rude...',
    ],
    beats: [
      [
        'This is {station}. The hour is late, the rain is warm, and tonight\'s case file reads {title}. It began, as these things do, at {place}, under {light}.',
        'Good evening. You are tuned to {station}, and this is {title}. The city never sleeps. It merely buffers. Our scene, {place}, with {smell} on the air.',
      ],
      [
        'The client was {hero}. The assistant was {side}. Together they solved crimes, or at the very least made them more complicated.',
        'Every city has its legends. This one had {hero}. And slightly behind, with an umbrella and a grudge, came {side}.',
      ],
      [
        'The case was simple. Someone had pinched {aThing}, the most valuable object in the district. {hero.short} wanted it back before the tea went cold.',
        'The rumour on the street was {aThing}, hidden somewhere near {landmark}. {hero.short} meant to find it. Purely for justice. And possibly a reward.',
      ],
      [
        'Then the lights flickered, and in walked {villain}. {exclaim}. The rain stopped mid air to get a better look.',
        'A message blinked on every screen in the market at once. It was from {villain}, and it said, in capital letters, the {thing} is mine. Then a winking face.',
      ],
      [
        'A chase followed. Through the noodle stalls, over a hover tram, under a holographic dragon. {side.short} apologised to everyone, individually, along the way.',
        '{hero.short} and {side.short} sprinted through the rain, past {sound}, past {critter}, and straight into a karaoke booth. Someone was singing. Badly. It was a clue.',
      ],
      [
        'And then, the twist. Halfway through the case, {hero.short} checked the security footage, and the thief on camera was... {hero.short}. From next Tuesday.',
        'Here is where the plot thickens, like a good custard. {villain.short} was never the mastermind. The mastermind was the {thing}. It had stolen itself.',
      ],
      [
        'Matters deteriorated. The neon went out, the rain came sideways, and {side.short} was arrested for loitering with intent to be charming. {exclaim}.',
        'Things went from bad, to worse, to slightly damp. The trail went cold, the tea went cold, and somewhere, a saxophone played a sad little tune.',
      ],
      [
        'Alone in a rain soaked alley, {hero.short} faced facts. The {thing} was gone. {villain.short} had won. And {food} was the only thing left in the fridge.',
        'It was the darkest hour, and the drizzliest. {hero.short} stared into {light} and wondered whether to give it all up and open a little cafe somewhere quiet.',
      ],
      [
        'Then {hero.short} saw the answer. Politeness. A strongly worded thank you note went to {villain.short}. It was so devastatingly courteous that {villain.short} confessed on the spot.',
        'So {hero.short} gathered every suspect in the market, cleared a throat, and said, the culprit is whoever is holding {food}. Every eye turned. {villain.short} was holding {food}. Case closed.',
      ],
      [
        'And so the {thing} was returned, the rain carried on, and {side.short} was released for good behaviour. You\'ve been listening to {station}. Do mind your umbrellas.',
        'Later, over {food} at {place}, {hero.short} raised a cup to the city that never sleeps. Nor, it turns out, does {station}. Goodnight.',
      ],
    ],
  },
  {
    id: 'trench', freq: 1290, call: 'Fathom', station: 'Fathom FM 1290', title: 'Twenty Thousand Leagues of Bother',
    narrator: 'The Chief Engineer', accent: 'Scottish',
    voice: { langs: ['en-GB-u-sd-gbsct', 'en-scotland', 'en-GB-SCT', 'en-GB'], names: ['Fiona', 'Microsoft Libby', 'Microsoft Maisie'], rate: 0.95, pitch: 1.05 },
    pools: {
      exclaim: ['Och, crivvens', 'Jings', 'Help ma boab', 'Away and bile yer heid'],
      food: ['a deep fried chocolate bar', 'a cold haggis supper', 'a tin of shortbread', 'a flask of lukewarm porridge'],
      num: ['six', 'eleven', 'four hundred', 'twenty thousand'],
    },
    cast: {
      hero: [
        { intro: 'Morag MacTavish, chief engineer of the submarine Thistle', short: 'Morag' },
        { intro: 'Angus Bellweather, who claimed to have arm wrestled a squid and won twice', short: 'Angus' },
        { intro: 'Hamish Duff, the only man alive who could whistle underwater', short: 'Hamish' },
        { intro: 'Doctor Ishbel Grant, marine biologist and amateur bagpiper', short: 'Doctor Grant' },
      ],
      side: [
        { intro: 'an anglerfish called Wee Lamp', short: 'Wee Lamp' },
        { intro: 'a deep sea crab named Sir Pincer McGee', short: 'Sir Pincer' },
        { intro: 'a very old sonar operator called Granny Euphemia', short: 'Granny Euphemia' },
        { intro: 'a jellyfish named Wobbles who carried a clipboard', short: 'Wobbles' },
      ],
      thing: ['haggis of Atlantis', 'bottomless thermos of tea', 'pearl that hummed bagpipe music', 'periscope that could see next Tuesday'],
      villain: [
        { intro: 'the Giant Squid of Loch Doom', short: 'the Squid' },
        { intro: 'Admiral Kelpie and her eel armada', short: 'Admiral Kelpie' },
        { intro: 'a sulking blue whale called Gordon', short: 'Gordon' },
        { intro: 'Mister Barnacle, a landlord who charged rent on rocks', short: 'Mister Barnacle' },
      ],
    },
    arrive: [
      'Och, who\'s touching the dial? Right, never mind, I\'ll carry on.',
      'This is {station} now, pal. We\'ll take it from the top. Well. The middle.',
    ],
    drift: [
      'Och, we\'re losing the signal, the pressure\'s getting to the aerial...',
      'Hang about, something\'s chewing on the antenna cable...',
    ],
    beats: [
      [
        'Ahoy from {station}, broadcasting from the very bottom of everything. Tonight\'s tale is {title}. We join our story at {place}, with {sound} and {light}.',
        'You\'re tuned to {station}. Pressure\'s high, spirits are higher. The story is {title}, and it starts at {place}, where {weather} meets a very bad idea.',
      ],
      [
        'Our hero was {hero}. And keeping an eye on the gauges was {side}, who had seen a great deal of the ocean and was not impressed with any of it.',
        'In command that night was {hero}. Second in command, technically, was {side}, though nobody had ever confirmed this in writing.',
      ],
      [
        'Now, {hero.short} was on a mission to recover {aThing}. Lost for centuries. Worth a fortune. Smelled a wee bit like low tide.',
        'The charts said {aThing} lay hidden beyond {landmark}. {hero.short} had dreamed of finding it since the age of {num}, and had the crayon drawings to prove it.',
      ],
      [
        'Then the sonar went ping, then ping ping, then made a rude noise. Out of the gloom loomed {villain}. {exclaim}. The tea in every cup went cold at once.',
        'But lurking in the deep was {villain}, who wanted the {thing} for a collection of shiny things kept in a very damp cupboard.',
      ],
      [
        'Full speed ahead! {hero.short} pulled every lever on the panel, including two that were purely decorative. {side.short} shouted depth readings that were frankly made up.',
        'There was a chase through a forest of kelp, round a sunken galleon, and under an octopus who was trying to read. {critter} lit the way, out of pure nosiness.',
      ],
      [
        'Then, halfway down, the twist. The submarine was never a submarine at all. It was a very large teapot, and it had been the whole time. Nobody had wanted to say.',
        'And here\'s the thing. When {hero.short} finally opened the hatch, the {thing} was already inside. With a note. It said, back in five minutes.',
      ],
      [
        'Then the hull began to groan. Then it began to sing. Then {side.short} found a leak and plugged it with {food}, which held, worryingly well. {exclaim}.',
        'Things went downhill, which is saying something at the bottom of the sea. The lights failed, the radio picked up nothing but bagpipes, and {critter} moved in.',
      ],
      [
        'At the deepest point of the deepest trench, {hero.short} sat in the dark. The {thing} was gone. The tea was gone. Even the bagpipes had stopped. It was grim.',
        'Oxygen was low, morale was lower, and {villain.short} was out there, gloating in a voice like a bathtub draining. {side.short} wrote a will on a biscuit.',
      ],
      [
        'Then {hero.short} had a thought. A wild, brave, ridiculous thought. Bagpipes. Full volume. Through the external speakers. {villain.short} swam for the surface and was never heard from again.',
        'So {hero.short} challenged {villain.short} to a ceilidh, a proper Scottish dance off. {villain.short} could not keep the beat, tripped over absolutely everything, and surrendered the {thing}.',
      ],
      [
        'And so they surfaced at last, {hero.short} and {side.short}, with the {thing} and a terrible sunburn. That\'s the tale. This has been {station}. Mind how you dive.',
        'They say if you press your ear to the floor at {place}, you can still hear {sound}, and the faint skirl of victory. Goodnight from {station}. Sleep well.',
      ],
    ],
  },
];

// Spoken by the incoming narrator after an arrival line, to explain, more or
// less, how the cast got from one story into the next.
export const SPLICES = [
  'Through a trapdoor nobody had noticed before, {hero.short} tumbled clean out of one story and landed in this one.',
  '{side.short} pulled a lever marked do not pull, and the whole world changed its accent.',
  'As it happens, {hero.short} had a cousin over this way, and the family resemblance was uncanny. Same face. Same problems.',
  'A small wormhole opened, apologised for the inconvenience, and closed again.',
  'The {thing} glowed, hummed, and rearranged the scenery, as cursed objects so often do.',
  'Meanwhile, {villain.short} had bought a ticket to the very same place, purely out of spite.',
  'Some say it was a dream. Others say it was a sandwich. Either way, the story carried on.',
  '{hero.short} blinked, and when the blink was finished nothing looked quite the same, except the problems.',
];

// Spoken by the current narrator when the scene outside changes mid story.
export const SCENE_QUIPS = [
  'Meanwhile, without asking anybody, the whole world outside turned into {place}.',
  'And just like that, the scenery wandered off and came back as {place}. Nobody questioned it.',
  'Somewhere a stagehand sneezed, and suddenly we were at {place}, with {smell} on the air.',
  'The view out the window changed to {place}, which was rude, but the story pressed on.',
];
