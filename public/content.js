/* Kayden Bang World content banks.
 *
 * Everything a child sees is in here, tagged with the age bands it suits:
 *   0 = 3–4 (Little)   1 = 5–6 (Starter)   2 = 7–8 (Growing)   3 = 9–12 (Big kid)
 *
 * Kept apart from the app so the word lists and questions can grow without
 * anyone having to read the game code.
 */
window.PC = (function(){
  "use strict";

  /* ---------- pictures, for phonics, memory and odd-one-out ---------- */
  var PICS = [
    {w:"apple",e:"🍎",c:"food"},   {w:"ant",e:"🐜",c:"animal"},    {w:"ball",e:"⚽",c:"toy"},
    {w:"bus",e:"🚌",c:"vehicle"},  {w:"bear",e:"🐻",c:"animal"},   {w:"cat",e:"🐱",c:"animal"},
    {w:"cake",e:"🎂",c:"food"},    {w:"car",e:"🚗",c:"vehicle"},   {w:"dog",e:"🐶",c:"animal"},
    {w:"duck",e:"🦆",c:"animal"},  {w:"drum",e:"🥁",c:"music"},    {w:"egg",e:"🥚",c:"food"},
    {w:"elephant",e:"🐘",c:"animal"},{w:"fish",e:"🐟",c:"animal"}, {w:"frog",e:"🐸",c:"animal"},
    {w:"fox",e:"🦊",c:"animal"},   {w:"goat",e:"🐐",c:"animal"},   {w:"grapes",e:"🍇",c:"food"},
    {w:"guitar",e:"🎸",c:"music"}, {w:"hat",e:"🎩",c:"clothes"},   {w:"horse",e:"🐴",c:"animal"},
    {w:"house",e:"🏠",c:"place"},  {w:"ice",e:"🧊",c:"nature"},    {w:"juice",e:"🧃",c:"food"},
    {w:"key",e:"🔑",c:"thing"},    {w:"kite",e:"🪁",c:"toy"},      {w:"lion",e:"🦁",c:"animal"},
    {w:"leaf",e:"🍃",c:"nature"},  {w:"lamp",e:"💡",c:"thing"},    {w:"moon",e:"🌙",c:"space"},
    {w:"mouse",e:"🐭",c:"animal"}, {w:"milk",e:"🥛",c:"food"},     {w:"nest",e:"🪺",c:"nature"},
    {w:"nose",e:"👃",c:"body"},    {w:"owl",e:"🦉",c:"animal"},    {w:"orange",e:"🍊",c:"food"},
    {w:"pig",e:"🐷",c:"animal"},   {w:"pizza",e:"🍕",c:"food"},    {w:"pen",e:"🖊️",c:"thing"},
    {w:"queen",e:"👑",c:"person"}, {w:"robot",e:"🤖",c:"toy"},     {w:"rain",e:"🌧️",c:"weather"},
    {w:"ring",e:"💍",c:"thing"},   {w:"sun",e:"☀️",c:"space"},     {w:"star",e:"⭐",c:"space"},
    {w:"snake",e:"🐍",c:"animal"}, {w:"tree",e:"🌳",c:"nature"},   {w:"tiger",e:"🐯",c:"animal"},
    {w:"train",e:"🚆",c:"vehicle"},{w:"umbrella",e:"☂️",c:"thing"},{w:"van",e:"🚐",c:"vehicle"},
    {w:"violin",e:"🎻",c:"music"}, {w:"whale",e:"🐋",c:"animal"},  {w:"watch",e:"⌚",c:"thing"},
    {w:"yoyo",e:"🪀",c:"toy"},     {w:"zebra",e:"🦓",c:"animal"},  {w:"boat",e:"⛵",c:"vehicle"},
    {w:"book",e:"📖",c:"thing"},   {w:"bee",e:"🐝",c:"animal"},    {w:"cow",e:"🐮",c:"animal"}
  ];

  /* ---------- spelling words, grouped by how long they are ---------- */
  var SPELL = [
    {w:"cat",e:"🐱"},{w:"dog",e:"🐶"},{w:"sun",e:"☀️"},{w:"hat",e:"🎩"},{w:"bus",e:"🚌"},
    {w:"pig",e:"🐷"},{w:"bed",e:"🛏️"},{w:"fox",e:"🦊"},{w:"cow",e:"🐮"},{w:"bee",e:"🐝"},
    {w:"car",e:"🚗"},{w:"key",e:"🔑"},{w:"box",e:"📦"},{w:"cup",e:"☕"},{w:"egg",e:"🥚"},
    {w:"pen",e:"🖊️"},{w:"bag",e:"🎒"},{w:"ant",e:"🐜"},{w:"owl",e:"🦉"},{w:"web",e:"🕸️"},
    {w:"star",e:"⭐"},{w:"fish",e:"🐟"},{w:"frog",e:"🐸"},{w:"book",e:"📖"},{w:"moon",e:"🌙"},
    {w:"tree",e:"🌳"},{w:"cake",e:"🎂"},{w:"duck",e:"🦆"},{w:"boat",e:"⛵"},{w:"lion",e:"🦁"},
    {w:"bird",e:"🐦"},{w:"rain",e:"🌧️"},{w:"snow",e:"❄️"},{w:"ship",e:"🚢"},{w:"kite",e:"🪁"},
    {w:"leaf",e:"🍃"},{w:"drum",e:"🥁"},{w:"goat",e:"🐐"},{w:"bear",e:"🐻"},{w:"corn",e:"🌽"},
    {w:"apple",e:"🍎"},{w:"train",e:"🚆"},{w:"house",e:"🏠"},{w:"tiger",e:"🐯"},{w:"robot",e:"🤖"},
    {w:"horse",e:"🐴"},{w:"zebra",e:"🦓"},{w:"juice",e:"🧃"},{w:"grape",e:"🍇"},{w:"clock",e:"🕐"},
    {w:"mouse",e:"🐭"},{w:"snake",e:"🐍"},{w:"beach",e:"🏖️"},{w:"cloud",e:"☁️"},{w:"sheep",e:"🐑"},
    {w:"whale",e:"🐋"},{w:"panda",e:"🐼"},{w:"bread",e:"🍞"},{w:"chair",e:"🪑"},{w:"plant",e:"🪴"},
    {w:"rabbit",e:"🐰"},{w:"flower",e:"🌻"},{w:"orange",e:"🍊"},{w:"guitar",e:"🎸"},{w:"rocket",e:"🚀"},
    {w:"monkey",e:"🐵"},{w:"pencil",e:"✏️"},{w:"garden",e:"🏡"},{w:"turtle",e:"🐢"},{w:"castle",e:"🏰"},
    {w:"penguin",e:"🐧"},{w:"dolphin",e:"🐬"},{w:"octopus",e:"🐙"},{w:"balloon",e:"🎈"},{w:"giraffe",e:"🦒"}
  ];

  /* ---------- quiz, banded so a six-year-old is never asked about photosynthesis ---------- */
  var QUIZ = [
    /* band 1 — 5 to 6 */
    {b:1,q:"Which animal says moo?",a:"Cow",w:["Duck","Cat","Sheep"],f:"Cows moo to call their calves, and each cow sounds a little different."},
    {b:1,q:"How many legs does a dog have?",a:"4",w:["2","6","8"],f:"Dogs walk on four legs, and up on their toes rather than flat feet."},
    {b:1,q:"What colour is the sky on a clear day?",a:"Blue",w:["Green","Purple","Brown"],f:"Sunlight is made of many colours, and blue scatters most in our air."},
    {b:1,q:"Which one of these can fly?",a:"Bird",w:["Fish","Dog","Snake"],f:"Birds have hollow bones, which makes them light enough to fly."},
    {b:1,q:"What do we call frozen water?",a:"Ice",w:["Steam","Sand","Smoke"],f:"Water turns to ice at 0 degrees Celsius."},
    {b:1,q:"Where do fish live?",a:"In water",w:["In trees","Under sand","In clouds"],f:"Fish breathe using gills, which take oxygen out of water."},
    {b:1,q:"What do cows give us?",a:"Milk",w:["Eggs","Honey","Wool"],f:"A dairy cow can make around 30 litres of milk a day."},
    {b:1,q:"Which animal has a long trunk?",a:"Elephant",w:["Horse","Bear","Rabbit"],f:"An elephant's trunk has about 40,000 muscles in it."},
    {b:1,q:"How many days are there in a week?",a:"7",w:["5","10","12"],f:"Seven days — most of them are named after old gods and planets."},
    {b:1,q:"What do plants grow from?",a:"Seeds",w:["Rocks","Paper","Bottles"],f:"A seed holds a tiny plant and enough food to get it started."},
    {b:1,q:"What do bees make?",a:"Honey",w:["Milk","Silk","Jam"],f:"One bee makes about a twelfth of a teaspoon of honey in its whole life."},
    {b:1,q:"What do you use to see?",a:"Eyes",w:["Ears","Nose","Hands"],f:"Your eyes can tell apart about ten million different colours."},
    {b:1,q:"Which season is the coldest?",a:"Winter",w:["Summer","Spring","Autumn"],f:"Winter is cold because our part of Earth leans away from the Sun."},
    {b:1,q:"How many wheels does a bicycle have?",a:"2",w:["3","4","1"],f:"'Bi' means two — that is where the word bicycle comes from."},
    {b:1,q:"Which is the biggest?",a:"Elephant",w:["Mouse","Cat","Rabbit"],f:"An African elephant can weigh as much as six cars."},
    {b:1,q:"What do we call baby cats?",a:"Kittens",w:["Puppies","Cubs","Chicks"],f:"Kittens are born with their eyes closed and open them after a week."},

    /* band 2 — 7 to 8 */
    {b:2,q:"How many legs does a spider have?",a:"8",w:["6","4","10"],f:"Spiders have eight legs. Insects have six — that is one way to tell them apart."},
    {b:2,q:"What is a baby frog called?",a:"Tadpole",w:["Cub","Calf","Chick"],f:"Tadpoles have tails and live in water until they grow legs."},
    {b:2,q:"What gas do we need to breathe?",a:"Oxygen",w:["Helium","Nitrogen","Smoke"],f:"Trees and ocean plants make most of the oxygen we breathe."},
    {b:2,q:"What organ pumps blood around your body?",a:"Heart",w:["Lungs","Brain","Stomach"],f:"Your heart beats about 100,000 times every single day."},
    {b:2,q:"How many colours are in a rainbow?",a:"7",w:["3","5","9"],f:"Red, orange, yellow, green, blue, indigo and violet."},
    {b:2,q:"What do caterpillars turn into?",a:"Butterflies",w:["Beetles","Spiders","Bees"],f:"Inside the chrysalis a caterpillar rebuilds itself almost completely."},
    {b:2,q:"Which part of a plant takes in water?",a:"Roots",w:["Leaves","Flowers","Petals"],f:"Roots also hold the plant steady in the ground."},
    {b:2,q:"Which is the largest animal on Earth?",a:"Blue whale",w:["Elephant","Giraffe","Shark"],f:"A blue whale can be longer than three buses in a row."},
    {b:2,q:"Which of these is a mammal?",a:"Dolphin",w:["Shark","Crocodile","Octopus"],f:"Dolphins breathe air and feed their babies milk, just like us."},
    {b:2,q:"What causes day and night?",a:"Earth spinning",w:["The Sun moving","Clouds","The Moon"],f:"Earth turns all the way round once every 24 hours."},
    {b:2,q:"How many continents are there?",a:"7",w:["4","5","9"],f:"Asia is the biggest, and Australia is the smallest."},
    {b:2,q:"What is the fastest land animal?",a:"Cheetah",w:["Horse","Lion","Ostrich"],f:"A cheetah reaches 100 km/h, but only for about 30 seconds."},
    {b:2,q:"Which shape has three sides?",a:"Triangle",w:["Square","Circle","Hexagon"],f:"Triangles are the strongest shape — that is why bridges use them."},
    {b:2,q:"What do we call animals that eat only plants?",a:"Herbivores",w:["Carnivores","Omnivores","Predators"],f:"Cows, rabbits and elephants are all herbivores."},
    {b:2,q:"What happens to water when it freezes?",a:"It becomes ice",w:["It becomes steam","It disappears","It turns green"],f:"Water expands when it freezes, which is why ice floats."},
    {b:2,q:"Which one makes no light of its own?",a:"The Moon",w:["The Sun","A candle","A torch"],f:"The Moon only reflects sunlight back to us."},
    {b:2,q:"What is Earth's largest ocean?",a:"Pacific",w:["Atlantic","Indian","Arctic"],f:"The Pacific is so big that every continent could fit inside it."},
    {b:2,q:"How many minutes are in an hour?",a:"60",w:["30","100","24"],f:"We use 60 because ancient Babylonians counted in sixties."},
    {b:2,q:"Which animal can change its colour?",a:"Chameleon",w:["Zebra","Penguin","Camel"],f:"Chameleons change colour to show mood and temperature, not just to hide."},
    {b:2,q:"What do we call a scientist who studies stars?",a:"Astronomer",w:["Geologist","Botanist","Chemist"],f:"Astronomers use telescopes to look at light that left stars years ago."},
    {b:2,q:"Which body part protects your brain?",a:"Skull",w:["Ribs",  "Spine","Hip"],f:"The skull is made of 22 bones fused together."},
    {b:2,q:"What do plants release that we breathe?",a:"Oxygen",w:["Carbon dioxide","Smoke","Steam"],f:"One large tree can make enough oxygen for two people for a day."},

    /* band 3 — 9 to 12 */
    {b:3,q:"Which planet is closest to the Sun?",a:"Mercury",w:["Venus","Earth","Mars"],f:"Mercury is closest, but Venus is hotter because of its thick clouds."},
    {b:3,q:"What is the hardest natural material?",a:"Diamond",w:["Gold","Iron","Granite"],f:"Diamonds form deep underground under enormous pressure."},
    {b:3,q:"How many bones does an adult human have?",a:"206",w:["150","300","98"],f:"Babies are born with about 300 — some fuse together as they grow."},
    {b:3,q:"Which gas do plants take in to make food?",a:"Carbon dioxide",w:["Oxygen","Nitrogen","Hydrogen"],f:"They take in carbon dioxide and give out oxygen. We do the opposite."},
    {b:3,q:"What is the chemical symbol for water?",a:"H₂O",w:["CO₂","O₂","NaCl"],f:"Two hydrogen atoms joined to one oxygen atom."},
    {b:3,q:"Which blood cells fight infection?",a:"White blood cells",w:["Red blood cells","Platelets","Plasma"],f:"You make about 100 billion white blood cells every day."},
    {b:3,q:"What force pulls objects towards Earth?",a:"Gravity",w:["Magnetism","Friction","Pressure"],f:"Gravity is why the Moon orbits us instead of flying off."},
    {b:3,q:"What is the largest planet in our solar system?",a:"Jupiter",w:["Saturn","Neptune","Earth"],f:"Over 1,300 Earths would fit inside Jupiter."},
    {b:3,q:"What is the smallest unit of a living thing?",a:"The cell",w:["The atom","The organ","The bone"],f:"Your body has roughly 37 trillion of them."},
    {b:3,q:"At what temperature does water boil, in Celsius?",a:"100",w:["50","0","200"],f:"At the top of a mountain it boils lower, because the air presses down less."},
    {b:3,q:"What do we call animals that are active at night?",a:"Nocturnal",w:["Diurnal","Migratory","Dormant"],f:"Owls, bats and hedgehogs are all nocturnal."},
    {b:3,q:"Which instrument measures temperature?",a:"Thermometer",w:["Barometer","Anemometer","Microscope"],f:"A barometer measures air pressure and an anemometer measures wind."},
    {b:3,q:"What mainly causes ocean tides?",a:"The Moon's gravity",w:["Wind","Earth's heat","Rain"],f:"The Sun pulls too, but the Moon is closer so it pulls harder."},
    {b:3,q:"Roughly how long does sunlight take to reach Earth?",a:"8 minutes",w:["1 second","1 hour","1 day"],f:"So you always see the Sun as it was eight minutes ago."},
    {b:3,q:"Which layer of the Earth is the hottest?",a:"The core",w:["The crust","The mantle","The surface"],f:"The inner core is about as hot as the surface of the Sun."},
    {b:3,q:"Which vitamin does sunlight help your body make?",a:"Vitamin D",w:["Vitamin C","Vitamin A","Vitamin K"],f:"Vitamin D helps your body use calcium to build strong bones."},
    {b:3,q:"What is the fastest animal in the world?",a:"Peregrine falcon",w:["Cheetah","Sailfish","Swift"],f:"It dives at over 380 km/h — faster than a Formula 1 car."},
    {b:3,q:"What is a solar eclipse?",a:"The Moon blocking the Sun",w:["Earth blocking the Sun","The Sun going out","A very dark cloud"],f:"It only happens because the Moon and Sun look the same size from here."},
    {b:3,q:"How much of the Earth's surface is water?",a:"About 71%",w:["About 30%","About 50%","About 90%"],f:"But only about 3% of it is fresh water, and most of that is frozen."},
    {b:3,q:"What do we call a word that means the opposite of another?",a:"Antonym",w:["Synonym","Homonym","Acronym"],f:"Hot and cold are antonyms. Hot and warm are synonyms."}
  ];

  /* ---------- odd one out ---------- */
  var ODD = [
    {b:0,items:["🍎","🍌","🍇","🚗"],odd:3,why:"The others are all fruit."},
    {b:0,items:["🐱","🐶","🐰","🪑"],odd:3,why:"The others are all animals."},
    {b:0,items:["🚗","🚌","🚂","🍕"],odd:3,why:"The others all take you places."},
    {b:0,items:["☀️","🌙","⭐","👟"],odd:3,why:"The others are all in the sky."},
    {b:0,items:["🔴","🟡","🟢","🐸"],odd:3,why:"The others are all just colours."},
    {b:1,items:["🐟","🐬","🐙","🦅"],odd:3,why:"The others all live in the sea."},
    {b:1,items:["🍞","🧀","🥛","🧦"],odd:3,why:"The others are all food and drink."},
    {b:1,items:["🎸","🥁","🎻","🔨"],odd:3,why:"The others are all musical instruments."},
    {b:1,items:["👕","👖","🧥","🍌"],odd:3,why:"The others are all clothes."},
    {b:1,items:["🌧️","❄️","⛈️","📚"],odd:3,why:"The others are all weather."},
    {b:2,items:["🦋","🐝","🐜","🦇"],odd:3,why:"The others are insects — a bat is a mammal."},
    {b:2,items:["🌳","🌻","🌵","🪨"],odd:3,why:"The others are all plants. A rock is not alive."},
    {b:2,items:["⚽","🏀","🎾","🎹"],odd:3,why:"The others are all balls used in sport."},
    {b:2,items:["🐍","🦎","🐢","🐸"],odd:3,why:"The others are reptiles — a frog is an amphibian."},
    {b:2,items:["🔺","🟦","⬟","🌕"],odd:3,why:"The others have straight sides. A circle has none."},
    {b:3,items:["🐋","🐬","🦭","🦈"],odd:3,why:"The others are mammals — a shark is a fish."},
    {b:3,items:["🪐","🌍","☄️","🌞"],odd:3,why:"The others orbit. The Sun is a star at the centre."},
    {b:3,items:["🥕","🥔","🧅","🍓"],odd:3,why:"The others grow underground."},
    {b:3,items:["💧","🧊","💨","🪵"],odd:3,why:"The others are all water in different states."}
  ];

  /* ---------- shapes and colours, for the youngest ---------- */
  var SHAPES = [
    {nm:"circle",  d:"M50 8a42 42 0 1 0 .1 0Z"},
    {nm:"square",  d:"M12 12h76v76H12Z"},
    {nm:"triangle",d:"M50 10 92 88H8Z"},
    {nm:"star",    d:"M50 6l13 27 30 4-22 21 5 30-26-14-26 14 5-30-22-21 30-4Z"},
    {nm:"heart",   d:"M50 88C22 68 8 52 8 36a22 22 0 0 1 42-9 22 22 0 0 1 42 9c0 16-14 32-42 52Z"},
    {nm:"diamond", d:"M50 8 92 50 50 92 8 50Z"}
  ];
  var COLOURS = [
    {nm:"red",   hex:"#FF5D5D"}, {nm:"blue",  hex:"#3FA9FF"}, {nm:"yellow",hex:"#FFC43D"},
    {nm:"green", hex:"#44D69A"}, {nm:"purple",hex:"#A98BFF"}, {nm:"orange",hex:"#FF9A4D"}
  ];

  /* ---------- code path levels, easiest first ---------- */
  var CODE_LEVELS = [
    {b:0,size:3,start:[2,0],goal:[0,2],walls:[]},
    {b:0,size:3,start:[2,2],goal:[0,0],walls:[[1,1]]},
    {b:0,size:4,start:[3,0],goal:[0,3],walls:[[1,1]]},
    {b:1,size:4,start:[3,0],goal:[0,3],walls:[[1,1],[2,2]]},
    {b:1,size:4,start:[3,0],goal:[0,0],walls:[[2,1],[1,1],[2,3]]},
    {b:1,size:4,start:[3,3],goal:[0,0],walls:[[2,2],[1,1]]},
    {b:2,size:5,start:[4,0],goal:[0,4],walls:[[3,1],[2,2],[1,3],[3,3]]},
    {b:2,size:5,start:[4,2],goal:[0,2],walls:[[3,1],[3,3],[1,1],[1,3]]},
    {b:2,size:5,start:[4,4],goal:[0,0],walls:[[3,3],[2,2],[1,1],[3,1]]},
    {b:3,size:6,start:[5,0],goal:[0,5],walls:[[4,1],[3,2],[2,3],[1,4],[4,3],[2,1]]},
    {b:3,size:6,start:[5,5],goal:[0,0],walls:[[4,4],[3,3],[2,2],[1,1],[4,2],[2,4]]},
    {b:3,size:6,start:[5,2],goal:[0,3],walls:[[4,1],[4,3],[3,0],[3,2],[3,4],[2,1],[2,3],[1,2]]}
  ];

  /* ---------- money, in cents ---------- */
  var COINS = [
    {v:5,  nm:"5c",  e:"🟤"},
    {v:10, nm:"10c", e:"⚪"},
    {v:20, nm:"20c", e:"⚫"},
    {v:50, nm:"50c", e:"🔘"},
    {v:100,nm:"$1",  e:"🟡"}
  ];

  /* ---------- rhyming families, for Rhyme Time ---------- */
  var RHYMES = [
    [{w:"cat",e:"🐱"},{w:"hat",e:"🎩"},{w:"bat",e:"🦇"}],
    [{w:"dog",e:"🐶"},{w:"log",e:"🪵"},{w:"frog",e:"🐸"}],
    [{w:"star",e:"⭐"},{w:"car",e:"🚗"},{w:"jar",e:"🫙"}],
    [{w:"bee",e:"🐝"},{w:"tree",e:"🌳"},{w:"key",e:"🔑"}],
    [{w:"sun",e:"☀️"},{w:"bun",e:"🥯"},{w:"run",e:"🏃"}],
    [{w:"boat",e:"⛵"},{w:"coat",e:"🧥"},{w:"goat",e:"🐐"}],
    [{w:"cake",e:"🎂"},{w:"snake",e:"🐍"},{w:"rake",e:"🧹"}],
    [{w:"bed",e:"🛏️"},{w:"red",e:"🔴"},{w:"sled",e:"🛷"}],
    [{w:"moon",e:"🌙"},{w:"spoon",e:"🥄"},{w:"balloon",e:"🎈"}],
    [{w:"box",e:"📦"},{w:"fox",e:"🦊"},{w:"socks",e:"🧦"}],
    [{w:"mouse",e:"🐭"},{w:"house",e:"🏠"}],
    [{w:"snail",e:"🐌"},{w:"mail",e:"📬"},{w:"whale",e:"🐋"}],
    [{w:"chair",e:"🪑"},{w:"bear",e:"🐻"},{w:"pear",e:"🍐"}],
    [{w:"ring",e:"💍"},{w:"king",e:"🤴"},{w:"wing",e:"🪽"}],
    [{w:"clock",e:"🕐"},{w:"sock",e:"🧦"},{w:"rock",e:"🪨"}],
    [{w:"bell",e:"🔔"},{w:"shell",e:"🐚"},{w:"well",e:"🕳️"}],
    [{w:"train",e:"🚆"},{w:"rain",e:"🌧️"},{w:"plane",e:"✈️"}],
    [{w:"light",e:"💡"},{w:"kite",e:"🪁"},{w:"night",e:"🌃"}]
  ];

  /* ---------- sorting, for the older bands where the rule is a concept ---------- */
  var SORT_ADV = [
    {b:2, a:"Living", bx:"Not living", items:[
      {e:"🌳",k:"a"},{e:"🐶",k:"a"},{e:"🌻",k:"a"},{e:"🐟",k:"a"},{e:"🦋",k:"a"},
      {e:"🪨",k:"b"},{e:"🚗",k:"b"},{e:"🪑",k:"b"},{e:"🔑",k:"b"},{e:"⌚",k:"b"}]},
    {b:2, a:"Flies", bx:"Swims", items:[
      {e:"🦅",k:"a"},{e:"🦋",k:"a"},{e:"🐝",k:"a"},{e:"✈️",k:"a"},{e:"🚁",k:"a"},
      {e:"🐟",k:"b"},{e:"🐬",k:"b"},{e:"🐙",k:"b"},{e:"🦈",k:"b"},{e:"🐢",k:"b"}]},
    {b:3, a:"Mammal", bx:"Not a mammal", items:[
      {e:"🐘",k:"a"},{e:"🐬",k:"a"},{e:"🦇",k:"a"},{e:"🐻",k:"a"},{e:"🐴",k:"a"},
      {e:"🐍",k:"b"},{e:"🐸",k:"b"},{e:"🦅",k:"b"},{e:"🐟",k:"b"},{e:"🐢",k:"b"}]},
    {b:3, a:"Solid", bx:"Liquid", items:[
      {e:"🧊",k:"a"},{e:"🪨",k:"a"},{e:"🪵",k:"a"},{e:"🍫",k:"a"},{e:"🔑",k:"a"},
      {e:"💧",k:"b"},{e:"🥛",k:"b"},{e:"🧃",k:"b"},{e:"☕",k:"b"},{e:"🫗",k:"b"}]},
    {b:3, a:"Grows above ground", bx:"Grows underground", items:[
      {e:"🍎",k:"a"},{e:"🍇",k:"a"},{e:"🌽",k:"a"},{e:"🍊",k:"a"},{e:"🍓",k:"a"},
      {e:"🥕",k:"b"},{e:"🥔",k:"b"},{e:"🧅",k:"b"},{e:"🧄",k:"b"},{e:"🫚",k:"b"}]}
  ];

  /* ---------- science ---------- */

  /* Five senses (K2–P2) */
  var SENSES = [
    {e:"🌸", q:"a flower",        a:"smell"},
    {e:"🍋", q:"a lemon",         a:"taste"},
    {e:"🔔", q:"a ringing bell",  a:"hearing"},
    {e:"🌈", q:"a rainbow",       a:"sight"},
    {e:"🧊", q:"an ice cube",     a:"touch"},
    {e:"🎺", q:"a trumpet",       a:"hearing"},
    {e:"🍫", q:"chocolate",       a:"taste"},
    {e:"🌧️", q:"rain on your arm", a:"touch"},
    {e:"🦋", q:"a butterfly",     a:"sight"},
    {e:"🧅", q:"a cut onion",     a:"smell"},
    {e:"🐦", q:"a bird singing",  a:"hearing"},
    {e:"🌶️", q:"a chilli",        a:"taste"},
    {e:"🧸", q:"a soft toy",      a:"touch"},
    {e:"☕", q:"fresh coffee",    a:"smell"},
    {e:"⭐", q:"stars at night",  a:"sight"}
  ];
  var SENSE_ORGANS = [
    {id:"sight",   nm:"Sight",   e:"👁️"},
    {id:"hearing", nm:"Hearing", e:"👂"},
    {id:"smell",   nm:"Smell",   e:"👃"},
    {id:"taste",   nm:"Taste",   e:"👅"},
    {id:"touch",   nm:"Touch",   e:"✋"}
  ];

  /* Animal homes (K1–P1) */
  var HOMES = [
    {a:"🐝", an:"Bee",      h:"🍯", hn:"Hive"},
    {a:"🐦", an:"Bird",     h:"🪺", hn:"Nest"},
    {a:"🐰", an:"Rabbit",   h:"🕳️", hn:"Burrow"},
    {a:"🐝", an:"Ant",      h:"🏔️", hn:"Ant hill"},
    {a:"🐶", an:"Dog",      h:"🏠", hn:"Kennel"},
    {a:"🐴", an:"Horse",    h:"🏚️", hn:"Stable"},
    {a:"🐠", an:"Fish",     h:"🌊", hn:"Water"},
    {a:"🕷️", an:"Spider",   h:"🕸️", hn:"Web"},
    {a:"🐻", an:"Bear",     h:"🪨", hn:"Cave"},
    {a:"🐒", an:"Monkey",   h:"🌳", hn:"Tree"}
  ];

  /* Life cycles (P3–P4) — stages in the order the syllabus teaches them */
  var LIFECYCLES = [
    {nm:"Butterfly", stages:[{e:"🥚",l:"Egg"},{e:"🐛",l:"Larva"},{e:"🟫",l:"Pupa"},{e:"🦋",l:"Adult"}]},
    {nm:"Frog",      stages:[{e:"🥚",l:"Egg"},{e:"🐟",l:"Tadpole"},{e:"🐸",l:"Young frog"},{e:"🐸",l:"Adult frog"}]},
    {nm:"Chicken",   stages:[{e:"🥚",l:"Egg"},{e:"🐣",l:"Hatching"},{e:"🐥",l:"Chick"},{e:"🐔",l:"Hen"}]},
    {nm:"Plant",     stages:[{e:"🌰",l:"Seed"},{e:"🌱",l:"Seedling"},{e:"🪴",l:"Young plant"},{e:"🌻",l:"Flowering"}]},
    {nm:"Mosquito",  stages:[{e:"🥚",l:"Egg"},{e:"〰️",l:"Larva"},{e:"🟤",l:"Pupa"},{e:"🦟",l:"Adult"}]},
    {nm:"Cockroach", stages:[{e:"🥚",l:"Egg"},{e:"🪳",l:"Nymph"},{e:"🪳",l:"Adult"}]}
  ];

  /* Food chains (P4–P6) — always producer first */
  var FOODCHAINS = [
    [{e:"🌱",n:"Grass"},{e:"🦗",n:"Grasshopper"},{e:"🐸",n:"Frog"},{e:"🐍",n:"Snake"},{e:"🦅",n:"Eagle"}],
    [{e:"🌿",n:"Algae"},{e:"🦐",n:"Shrimp"},{e:"🐟",n:"Fish"},{e:"🦭",n:"Seal"}],
    [{e:"🍃",n:"Leaves"},{e:"🐛",n:"Caterpillar"},{e:"🐦",n:"Bird"},{e:"🐱",n:"Cat"}],
    [{e:"🌾",n:"Wheat"},{e:"🐭",n:"Mouse"},{e:"🦉",n:"Owl"}],
    [{e:"🪴",n:"Plant"},{e:"🐌",n:"Snail"},{e:"🦆",n:"Duck"},{e:"🦊",n:"Fox"}],
    [{e:"🌸",n:"Nectar"},{e:"🐝",n:"Bee"},{e:"🕷️",n:"Spider"},{e:"🐦",n:"Bird"}]
  ];

  /* Changes of state (P3–P4) */
  var STATE_CHANGES = [
    {q:"Ice turns into water",            a:"Melting",      w:["Freezing","Boiling","Condensation"]},
    {q:"Water turns into ice",            a:"Freezing",     w:["Melting","Evaporation","Boiling"]},
    {q:"A puddle dries up in the sun",    a:"Evaporation",  w:["Condensation","Melting","Freezing"]},
    {q:"Water drops form on a cold glass",a:"Condensation", w:["Evaporation","Melting","Boiling"]},
    {q:"Water turns to steam in a kettle",a:"Boiling",      w:["Freezing","Condensation","Melting"]},
    {q:"Chocolate softens in your hand",  a:"Melting",      w:["Freezing","Condensation","Boiling"]}
  ];

  /* Plant parts (P3–P4) */
  var PLANT_PARTS = [
    {id:"flower", nm:"Flower", job:"Makes seeds so new plants can grow"},
    {id:"leaf",   nm:"Leaf",   job:"Makes food for the plant using sunlight"},
    {id:"stem",   nm:"Stem",   job:"Holds the plant up and carries water"},
    {id:"root",   nm:"Root",   job:"Takes in water and holds the plant steady"}
  ];

  /* ---------- guessing ---------- */

  /* Clues get more obvious as they go, so a child can stop early if they know it. */
  var ANIMAL_CLUES = [
    {a:"Cow",      e:"🐮", clues:["I have four legs","I live on a farm","I eat grass all day","I give people milk","I say moo"]},
    {a:"Elephant", e:"🐘", clues:["I am very big","I have grey skin","I have huge ears","I have a long trunk","I am the biggest land animal"]},
    {a:"Penguin",  e:"🐧", clues:["I am a bird","I cannot fly","I live where it is very cold","I swim to catch fish","I slide on my tummy"]},
    {a:"Bee",      e:"🐝", clues:["I am small","I have wings","I like flowers","I live in a hive","I make honey"]},
    {a:"Frog",     e:"🐸", clues:["I start life as a tadpole","I can live in water and on land","I have long back legs","I catch flies with my tongue","I hop and croak"]},
    {a:"Owl",      e:"🦉", clues:["I am a bird","I sleep in the day","I can turn my head far round","I hunt at night","I say hoot"]},
    {a:"Turtle",   e:"🐢", clues:["I move very slowly","I have four legs","I lay eggs in sand","I carry my home on my back","I have a hard shell"]},
    {a:"Butterfly",e:"🦋", clues:["I was once a caterpillar","I have six legs","I drink nectar","I have colourful wings","I come out of a chrysalis"]},
    {a:"Dolphin",  e:"🐬", clues:["I live in the sea","I am not a fish","I breathe air","I feed my baby milk","I am very clever and playful"]},
    {a:"Spider",   e:"🕷️", clues:["I am small","I am not an insect","I have eight legs","I catch flies","I spin a web"]},
    {a:"Chicken",  e:"🐔", clues:["I am a bird","I cannot fly far","I live on a farm","I lay eggs","I say cluck"]},
    {a:"Snake",    e:"🐍", clues:["I have no legs","I have scales","I lay eggs","I slither along the ground","I hiss"]}
  ];

  var RIDDLES = [
    {b:1,q:"I am full of holes but I still hold water. What am I?", a:"A sponge", w:["A bucket","A cup","A bottle"]},
    {b:1,q:"I have hands but cannot clap. What am I?", a:"A clock", w:["A glove","A tree","A book"]},
    {b:1,q:"I go up but never come down. What am I?", a:"Your age", w:["A ball","A kite","A lift"]},
    {b:1,q:"What has a face and two hands?", a:"A clock", w:["A doll","A mirror","A coin"]},
    {b:2,q:"I have keys but open no locks. What am I?", a:"A piano", w:["A door","A car","A map"]},
    {b:2,q:"The more you take away from me, the bigger I get. What am I?", a:"A hole", w:["A cake","A balloon","A shadow"]},
    {b:2,q:"I have a neck but no head. What am I?", a:"A bottle", w:["A shirt","A snake","A ladder"]},
    {b:2,q:"What gets wetter the more it dries?", a:"A towel", w:["A sponge","The sun","A cloud"]},
    {b:2,q:"I have teeth but cannot eat. What am I?", a:"A comb", w:["A fork","A saw","A zip"]},
    {b:3,q:"I fly without wings and cry without eyes. What am I?", a:"A cloud", w:["A kite","A ghost","A plane"]},
    {b:3,q:"What can travel around the world while staying in one corner?", a:"A stamp", w:["A map","The wind","A clock"]},
    {b:3,q:"I am taken from a mine and shut in a wooden case, yet used by almost everyone. What am I?", a:"Pencil lead", w:["Coal","A diamond","Salt"]},
    {b:3,q:"What has many words but never speaks?", a:"A book", w:["A parrot","A radio","A letter"]},
    {b:3,q:"What has one eye but cannot see?", a:"A needle", w:["A storm","A potato","A camera"]},
    {b:3,q:"What belongs to you, but other people use it more than you do?", a:"Your name", w:["Your voice","Your shadow","Your bag"]}
  ];


  /* ---------- Chinese (华文), following the MOE primary character lists ----------
   *
   * Characters are tagged with the same age bands as everything else, so a K2
   * child meets 大 and 小 while a P4 child meets 医院 and 图书馆. Pinyin is
   * written with tone marks, the way it is taught in Singapore schools.
   */
  var ZH_CHARS = [
    /* band 0 — the first characters, all of them pictures of the thing */
    {b:0,c:"人",p:"rén",m:"person",e:"🧍"},   {b:0,c:"大",p:"dà",m:"big",e:"🐘"},
    {b:0,c:"小",p:"xiǎo",m:"small",e:"🐜"},   {b:0,c:"口",p:"kǒu",m:"mouth",e:"👄"},
    {b:0,c:"手",p:"shǒu",m:"hand",e:"✋"},     {b:0,c:"日",p:"rì",m:"sun",e:"☀️"},
    {b:0,c:"月",p:"yuè",m:"moon",e:"🌙"},      {b:0,c:"山",p:"shān",m:"mountain",e:"⛰️"},
    {b:0,c:"水",p:"shuǐ",m:"water",e:"💧"},    {b:0,c:"火",p:"huǒ",m:"fire",e:"🔥"},
    {b:0,c:"木",p:"mù",m:"tree",e:"🌳"},       {b:0,c:"上",p:"shàng",m:"up",e:"⬆️"},
    {b:0,c:"下",p:"xià",m:"down",e:"⬇️"},      {b:0,c:"心",p:"xīn",m:"heart",e:"❤️"},

    /* band 1 — home and the world just outside it */
    {b:1,c:"爸",p:"bà",m:"father",e:"👨"},     {b:1,c:"妈",p:"mā",m:"mother",e:"👩"},
    {b:1,c:"我",p:"wǒ",m:"I, me",e:"🙋"},      {b:1,c:"你",p:"nǐ",m:"you",e:"👉"},
    {b:1,c:"家",p:"jiā",m:"home",e:"🏠"},      {b:1,c:"天",p:"tiān",m:"sky, day",e:"🌤️"},
    {b:1,c:"花",p:"huā",m:"flower",e:"🌸"},    {b:1,c:"草",p:"cǎo",m:"grass",e:"🌿"},
    {b:1,c:"云",p:"yún",m:"cloud",e:"☁️"},     {b:1,c:"雨",p:"yǔ",m:"rain",e:"🌧️"},
    {b:1,c:"鱼",p:"yú",m:"fish",e:"🐟"},       {b:1,c:"鸟",p:"niǎo",m:"bird",e:"🐦"},
    {b:1,c:"牛",p:"niú",m:"cow",e:"🐮"},       {b:1,c:"羊",p:"yáng",m:"sheep",e:"🐑"},
    {b:1,c:"马",p:"mǎ",m:"horse",e:"🐴"},      {b:1,c:"车",p:"chē",m:"car",e:"🚗"},
    {b:1,c:"门",p:"mén",m:"door",e:"🚪"},      {b:1,c:"书",p:"shū",m:"book",e:"📖"},

    /* band 2 — school, and the verbs a P1 child writes every week */
    {b:2,c:"学",p:"xué",m:"to learn",e:"📚"},   {b:2,c:"校",p:"xiào",m:"school",e:"🏫"},
    {b:2,c:"师",p:"shī",m:"teacher",e:"👩‍🏫"},   {b:2,c:"友",p:"yǒu",m:"friend",e:"🤝"},
    {b:2,c:"吃",p:"chī",m:"to eat",e:"🍚"},     {b:2,c:"喝",p:"hē",m:"to drink",e:"🥤"},
    {b:2,c:"走",p:"zǒu",m:"to walk",e:"🚶"},    {b:2,c:"跑",p:"pǎo",m:"to run",e:"🏃"},
    {b:2,c:"看",p:"kàn",m:"to look",e:"👀"},    {b:2,c:"听",p:"tīng",m:"to listen",e:"👂"},
    {b:2,c:"说",p:"shuō",m:"to speak",e:"💬"},  {b:2,c:"写",p:"xiě",m:"to write",e:"✍️"},
    {b:2,c:"飞",p:"fēi",m:"to fly",e:"🛫"},     {b:2,c:"树",p:"shù",m:"tree",e:"🌲"},
    {b:2,c:"风",p:"fēng",m:"wind",e:"🌬️"},     {b:2,c:"雪",p:"xuě",m:"snow",e:"❄️"},

    /* band 3 — the wider world, the seasons and the words that compare */
    {b:3,c:"爱",p:"ài",m:"to love",e:"❤️"},     {b:3,c:"想",p:"xiǎng",m:"to think",e:"💭"},
    {b:3,c:"医",p:"yī",m:"medicine",e:"🩺"},    {b:3,c:"院",p:"yuàn",m:"institution",e:"🏥"},
    {b:3,c:"图",p:"tú",m:"picture",e:"🖼️"},     {b:3,c:"园",p:"yuán",m:"garden",e:"🏞️"},
    {b:3,c:"春",p:"chūn",m:"spring",e:"🌱"},    {b:3,c:"夏",p:"xià",m:"summer",e:"🌞"},
    {b:3,c:"秋",p:"qiū",m:"autumn",e:"🍂"},     {b:3,c:"冬",p:"dōng",m:"winter",e:"⛄"},
    {b:3,c:"早",p:"zǎo",m:"early",e:"🌅"},      {b:3,c:"晚",p:"wǎn",m:"late",e:"🌃"},
    {b:3,c:"快",p:"kuài",m:"fast",e:"⚡"},      {b:3,c:"慢",p:"màn",m:"slow",e:"🐌"},
    {b:3,c:"高",p:"gāo",m:"tall",e:"📏"},       {b:3,c:"海",p:"hǎi",m:"sea",e:"🌊"}
  ];

  /* Chinese numerals. Ten and above are where children usually stumble, so the
     bigger ones are kept for the older bands. */
  var ZH_NUMBERS = [
    {b:0,c:"一",p:"yī",n:1},  {b:0,c:"二",p:"èr",n:2},  {b:0,c:"三",p:"sān",n:3},
    {b:0,c:"四",p:"sì",n:4},  {b:0,c:"五",p:"wǔ",n:5},
    {b:1,c:"六",p:"liù",n:6}, {b:1,c:"七",p:"qī",n:7},  {b:1,c:"八",p:"bā",n:8},
    {b:1,c:"九",p:"jiǔ",n:9}, {b:1,c:"十",p:"shí",n:10},
    {b:2,c:"二十",p:"èrshí",n:20},   {b:2,c:"三十",p:"sānshí",n:30},
    {b:2,c:"五十",p:"wǔshí",n:50},   {b:2,c:"一百",p:"yìbǎi",n:100},
    {b:3,c:"六十五",p:"liùshíwǔ",n:65}, {b:3,c:"八十八",p:"bāshíbā",n:88},
    {b:3,c:"两百",p:"liǎngbǎi",n:200},  {b:3,c:"一千",p:"yìqiān",n:1000}
  ];

  /* Two-character words, split so a child can put them back together. */
  var ZH_WORDS = [
    {b:1,a:"爸",z:"爸",w:"爸爸",p:"bàba",m:"daddy",e:"👨"},
    {b:1,a:"妈",z:"妈",w:"妈妈",p:"māma",m:"mummy",e:"👩"},
    {b:1,a:"小",z:"鸟",w:"小鸟",p:"xiǎoniǎo",m:"little bird",e:"🐦"},
    {b:1,a:"大",z:"门",w:"大门",p:"dàmén",m:"front gate",e:"🚪"},
    {b:1,a:"白",z:"云",w:"白云",p:"báiyún",m:"white cloud",e:"☁️"},
    {b:2,a:"学",z:"校",w:"学校",p:"xuéxiào",m:"school",e:"🏫"},
    {b:2,a:"老",z:"师",w:"老师",p:"lǎoshī",m:"teacher",e:"👩‍🏫"},
    {b:2,a:"朋",z:"友",w:"朋友",p:"péngyǒu",m:"friend",e:"🤝"},
    {b:2,a:"火",z:"车",w:"火车",p:"huǒchē",m:"train",e:"🚂"},
    {b:2,a:"下",z:"雨",w:"下雨",p:"xiàyǔ",m:"raining",e:"🌧️"},
    {b:2,a:"早",z:"上",w:"早上",p:"zǎoshang",m:"morning",e:"🌅"},
    {b:3,a:"医",z:"院",w:"医院",p:"yīyuàn",m:"hospital",e:"🏥"},
    {b:3,a:"公",z:"园",w:"公园",p:"gōngyuán",m:"park",e:"🏞️"},
    {b:3,a:"图",z:"书",w:"图书",p:"túshū",m:"books",e:"📚"},
    {b:3,a:"天",z:"空",w:"天空",p:"tiānkōng",m:"the sky",e:"🌤️"},
    {b:3,a:"海",z:"边",w:"海边",p:"hǎibiān",m:"the seaside",e:"🏖️"},
    {b:3,a:"晚",z:"上",w:"晚上",p:"wǎnshang",m:"evening",e:"🌃"}
  ];

  return {
    PICS: PICS, SPELL: SPELL, QUIZ: QUIZ, ODD: ODD, RHYMES: RHYMES, SORT_ADV: SORT_ADV,
    ANIMAL_CLUES: ANIMAL_CLUES, RIDDLES: RIDDLES,
    SENSES: SENSES, SENSE_ORGANS: SENSE_ORGANS, HOMES: HOMES, LIFECYCLES: LIFECYCLES,
    FOODCHAINS: FOODCHAINS, STATE_CHANGES: STATE_CHANGES, PLANT_PARTS: PLANT_PARTS,
    SHAPES: SHAPES, COLOURS: COLOURS, CODE_LEVELS: CODE_LEVELS, COINS: COINS,
    ZH_CHARS: ZH_CHARS, ZH_NUMBERS: ZH_NUMBERS, ZH_WORDS: ZH_WORDS
  };
})();
