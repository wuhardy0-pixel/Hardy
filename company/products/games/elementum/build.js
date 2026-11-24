// ---------------- the workbench (2026-11-22, Barbara: "the workbench is like Fusion 360 and AI helps you — you say make a handle if somebody
// needs a cup and it will be built"). Villagers need things; each thing has a difficulty (cup easy · chair, bed medium · house, car hard).
// A design is a list of solid parts in centimetres. You add and size parts by hand, or tell the helper what to make (the server asks Gemini;
// it does only what you ask — no coaching). The testing area tries the design out (water in the cup, a weight on the chair, rain on the
// house, a drive in the car); the report gives the facts, and Magistra Cornelia says why it works or why it didn't.
// Real numbers: volumes in ml, weights from real densities, what a wooden leg can carry, how much water a boat pushes away.
window.BUILD=(()=>{
const $=s=>document.querySelector(s),esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const LV={easy:{name:"Easy",pay:15,cls:"e"},medium:{name:"Medium",pay:40,cls:"m"},hard:{name:"Hard",pay:120,cls:"h"}};
// what each thing must do (the person's needs — not how to build it)
const ITEMS={
  cup:{name:"cup",level:"easy",icon:"☕",wiki:"Mug",needs:[{k:"container",min:150,max:1000},{k:"handle"},{k:"stands"},{k:"onePiece"}],ask:"I need a cup for my hot milk — one I can hold without burning my fingers."},
  bowl:{name:"bowl",level:"easy",icon:"🥣",wiki:"Bowl (vessel)",needs:[{k:"container",min:300,max:3000},{k:"wide"},{k:"stands"},{k:"onePiece"}],ask:"I need a bowl for my soup."},
  plate:{name:"plate",level:"easy",icon:"🍽️",wiki:"Plate (dishware)",needs:[{k:"plate"},{k:"stands"},{k:"onePiece"}],ask:"I need a plate for my bread and cheese."},
  vase:{name:"vase",level:"easy",icon:"🏺",wiki:"Vase",needs:[{k:"container",min:500,max:8000},{k:"tall",min:20},{k:"stands"},{k:"onePiece"}],ask:"I picked flowers — I need a tall vase to put them in."},
  bucket:{name:"bucket",level:"easy",icon:"🪣",wiki:"Bucket",needs:[{k:"container",min:5000,max:30000},{k:"handle"},{k:"stands"},{k:"onePiece"}],ask:"I carry water from the well every day. I need a bucket with a handle."},
  door:{name:"door",level:"easy",icon:"🚪",wiki:"Door",needs:[{k:"doorLeaf"},{k:"handle",any:true},{k:"onePiece"}],ask:"My front door fell off its hinges. I need a new door with a handle."},
  stool:{name:"stool",level:"medium",icon:"🪑",wiki:"Stool (seat)",needs:[{k:"surface",what:"seat",hMin:40,hMax:80,w:25,d:25},{k:"holds",kg:80},{k:"stands"},{k:"onePiece"}],ask:"I need a stool to sit on while I milk the goat."},
  chair:{name:"chair",level:"medium",icon:"🪑",wiki:"Chair",needs:[{k:"surface",what:"seat",hMin:38,hMax:50,w:35,d:35},{k:"back",min:25},{k:"holds",kg:80},{k:"stands"},{k:"onePiece"}],ask:"I need a chair to sit at my table — with a back to lean on."},
  table:{name:"table",level:"medium",icon:"🪵",wiki:"Table (furniture)",needs:[{k:"surface",what:"top",hMin:65,hMax:80,w:70,d:50},{k:"holds",kg:50},{k:"stands"},{k:"onePiece"}],ask:"My family has nowhere to eat. I need a table."},
  bench:{name:"bench",level:"medium",icon:"🪑",wiki:"Bench (furniture)",needs:[{k:"surface",what:"seat",hMin:38,hMax:50,w:100,d:30},{k:"holds",kg:160},{k:"stands"},{k:"onePiece"}],ask:"I need a bench by my door so two people can sit and talk."},
  bed:{name:"bed",level:"medium",icon:"🛏️",wiki:"Bed",needs:[{k:"surface",what:"bed",hMin:25,hMax:65,w:180,d:85},{k:"soft"},{k:"holds",kg:160},{k:"stands"},{k:"onePiece"}],ask:"I've been sleeping on the floor. I need a bed — with something soft to lie on."},
  shelf:{name:"bookshelf",level:"medium",icon:"📚",wiki:"Bookcase",needs:[{k:"shelves",n:3,w:50},{k:"stands"},{k:"onePiece"}],ask:"My books are all over the floor! I need a bookshelf with at least three shelves."},
  ladder:{name:"ladder",level:"medium",icon:"🪜",wiki:"Ladder",needs:[{k:"ladder",h:180,rungs:5},{k:"onePiece"}],ask:"I need a ladder to pick the apples at the top of my tree."},
  doghouse:{name:"doghouse",level:"medium",icon:"🐕",wiki:"Doghouse",needs:[{k:"room",area:3000,head:50,door:{w:30,h:40},roof:true},{k:"stands"},{k:"onePiece"}],ask:"My dog sleeps out in the rain. I need a doghouse with a door and a roof."},
  wheelbarrow:{name:"wheelbarrow",level:"medium",icon:"🛞",wiki:"Wheelbarrow",needs:[{k:"wheels",n:1},{k:"basin",min:40},{k:"handle",any:true},{k:"onePiece"}],ask:"I need a wheelbarrow to carry stones to the building site."},
  house:{name:"house",level:"hard",icon:"🏠",wiki:"House",needs:[{k:"room",area:40000,head:200,door:{w:70,h:180},roof:true},{k:"stands"},{k:"onePiece"}],ask:"Our family needs a house: room inside to stand up, a door to get in and a roof against the rain."},
  car:{name:"car",level:"hard",icon:"🚗",wiki:"Car",needs:[{k:"wheels",n:4,span:150},{k:"clear",min:10},{k:"carBody",len:250,wid:120},{k:"light",kg:2500},{k:"onePiece"}],ask:"I need a car to bring vegetables to the market — the cart is too slow."},
  cart:{name:"cart",level:"hard",icon:"🛒",wiki:"Cart",needs:[{k:"wheels",n:2},{k:"basin",min:100},{k:"stands"},{k:"onePiece"}],ask:"I need a cart with wheels to carry hay from the field."},
  boat:{name:"boat",level:"hard",icon:"⛵",wiki:"Boat",needs:[{k:"basin",min:150},{k:"floats",kg:80},{k:"wideBoat",min:80},{k:"onePiece"}],ask:"I want to fish on the lake. I need a boat that floats with me in it."},
  chest:{name:"chest",level:"medium",icon:"🧰",wiki:"Chest (furniture)",needs:[{k:"storage",min:50},{k:"stands"},{k:"onePiece"}],ask:"I have nowhere to keep my things. I need a chest with a lid."},
  book:{name:"book",level:"easy",icon:"📕",wiki:"Book",needs:[{k:"pages"},{k:"onePiece"}],ask:"I want to write down how I build things. I need a book with a cover."},
  lamp:{name:"magic lamp",level:"easy",icon:"🏮",wiki:"Lantern",needs:[{k:"bulb"},{k:"stands"},{k:"onePiece"}],ask:"It's so dark at night! I need a lamp with a glass to keep the light in."},
  magnet:{name:"magnet",level:"medium",icon:"🧲",wiki:"Magnet",needs:[{k:"magnet"},{k:"onePiece"}],ask:"I keep dropping nails all over the yard. I need a magnet that pulls everything to me."},
  stairs:{name:"staircase",level:"medium",icon:"🪜",wiki:"Stairs",needs:[{k:"steps",n:4},{k:"stands"},{k:"onePiece"}],ask:"I can't get up to my attic. I need stairs."},
  healstone:{name:"healing crystal",level:"medium",icon:"💎",wiki:"Crystal",needs:[{k:"crystal"},{k:"stands"},{k:"onePiece"}],ask:"My knee hurts. They say a tall glass crystal on a heavy stand makes you feel better."},
  computer:{name:"computer",level:"hard",icon:"🖥️",wiki:"Computer",needs:[{k:"screen"},{k:"stands"},{k:"onePiece"}],ask:"The library is far away. I need a computer at home, with a screen and keys."},
  gate:{name:"magic gate",level:"hard",icon:"🌀",wiki:"Arch",needs:[{k:"arch"},{k:"stands"},{k:"onePiece"}],ask:"Walking takes forever. Build a gate big enough to walk through — two of them, and you step from one to the other!"},
  invention:{name:"invention",level:"easy",icon:"✨",wiki:"Invention",needs:[],ask:"",free:true},
  horn:{name:"horn",level:"easy",icon:"📯",wiki:"Horn (instrument)",needs:[{k:"horn",len:20},{k:"onePiece"}],ask:"The soldiers need a horn — when I blow it, they come running to fight the monsters."},
};
const ORDER=Object.keys(ITEMS).filter(k=>!ITEMS[k].free);
// what a magical thing can do (Barbara, 2026-11-24: "you make anything you want and then the game turns it into something that does a thing")
const FNS={
  magnet:{icon:"🧲",name:"collector",what:"carry it (or set it down): everything lying nearby flies to you"},
  light:{icon:"💡",name:"lamp",what:"set it down: it lights up the dark"},
  heal:{icon:"💚",name:"healer",what:"set it down: everyone near it slowly heals"},
  bounce:{icon:"🦘",name:"bouncer",what:"set it down and step on it: it throws you high into the air"},
  portal:{icon:"🌀",name:"portal",what:"set down two: step into one and you come out of the other"},
  zap:{icon:"⚡",name:"lightning tower",what:"set it down: it strikes monsters that come near"},
  freeze:{icon:"❄️",name:"freezer",what:"set it down: monsters near it become very slow"},
  speed:{icon:"💨",name:"speed maker",what:"set it down: everyone near it runs faster"},
  fly:{icon:"🪽",name:"flyer",what:"hold it and click: it carries you through the air",hand:1},
  wand:{icon:"🪄",name:"wand",what:"hold it and click: it shoots magic",hand:1},
  music:{icon:"🎵",name:"music maker",what:"hold it and click (or press T at it): it plays a tune everyone nearby hears",hand:1},
  firework:{icon:"🎆",name:"firework launcher",what:"hold it and click (or press T at it): fireworks for everyone to see",hand:1},
  guard:{icon:"🛡️",name:"guard caller",what:"hold it and click: soldiers come and fight the monsters",hand:1},
  maker:{icon:"⚙️",name:"maker machine",what:"set it down and press T: every minute it makes one material for you"},
  bubbles:{icon:"🫧",name:"bubble blower",what:"set it down: it fills the air with bubbles"},
  water:{icon:"⛲",name:"fountain",what:"set it down and press T: drink from it to heal"},
  computer:{icon:"🖥️",name:"computer",what:"set it down and press T: look things up, like at the library"},
  storage:{icon:"🧰",name:"keeper",what:"set it down and press T: it opens your chest"},
};
const ITEMFN={magnet:"magnet",lamp:"light",healstone:"heal",computer:"computer",gate:"portal"};
// when the game can't ask the helper, it looks at the shape and the materials itself
function guessFn(parts){const A=analyse(parts),B=A.box,w=B.max.x-B.min.x,h=B.max.y-B.min.y,d=B.max.z-B.min.z,mx=Math.max(w,h,d),mn=Math.min(w,h,d);const m=k=>A.P.filter(a=>a.p.mat===k).length,sh=k=>A.P.filter(a=>a.p.shape===k).length;
  const hollow=A.P.some(a=>(a.p.shape==="cone"&&n(a.p.wall,0)>0)||(a.p.shape==="tube"&&!(n(a.p.bottom,0)>0)));
  if(sh("torus")&&A.P.some(a=>a.p.shape==="torus"&&n(a.p.R,0)>=60))return "portal";if(m("metal")>=2&&(sh("torus")||A.P.length<=4)&&mx<150&&!hollow)return "magnet";
  if(hollow)return m("metal")?"music":"firework";if(m("rubber")&&!sh("cylinder"))return "bounce";if(m("fabric")&&mx>mn*3)return "fly";if(m("fabric"))return "bounce";
  if(mx>mn*8&&mx<200)return "wand";if(m("glass")&&m("stone"))return "heal";if(m("glass")&&(sh("sphere")||sh("dome")))return "light";if(m("glass"))return "freeze";
  if(sh("cone")&&m("metal"))return "zap";if(A.P.some(a=>a.p.shape==="tube"))return "water";if(A.P.some(a=>a.p.shape==="shell"&&n(a.p.top,0)>=.5))return "storage";if(sh("cylinder")>=2)return "maker";
  const c=["bubbles","speed","firework","music","maker","light"];return c[Math.round(A.mass*7+A.P.length*13)%c.length];}
// what each design idea is about — the library's "Design ideas" book shows a picture and these words; nothing is loaded into the workbench
const IDEA_TEXT={
  "Mug":"A tall, straight-sided cup with a loop handle on the side — thick walls keep a drink hot longer.",
  "Tea cup":"A short, wide cup on a little plate (a saucer) that catches drips; a small handle for two fingers.",
  "Tall mug":"A narrow, tall mug that holds a lot without being wide; a bigger handle so the whole hand fits.",
  "Soup bowl":"Wider than it is tall, with low sides, so a spoon reaches everything.",
  "Wooden bowl":"Carved from one piece of wood, with thick walls so it doesn't crack.",
  "Footed bowl":"A bowl sitting on a small round foot, which lifts it up and keeps it steady.",
  "Dinner plate":"One thin, wide, round disc — light to carry, flat so food doesn't roll.",
  "Square plate":"The same idea in a square shape — it fits neatly in a row on a shelf.",
  "Wooden board":"A thick rectangle of wood for bread and cheese — you can cut on it too.",
  "Tall vase":"A tall, narrow glass tube with a closed bottom — the sides hold long stems up.",
  "Wide vase":"Shorter and wider, for a big bunch of flowers; a heavy clay bottom keeps it from tipping.",
  "Vase on a stand":"A slim vase on a wide stone base — the wide base stops it falling over.",
  "Metal bucket":"Thin metal walls (light but strong) and a handle that arches over the top, so it hangs straight when you carry it.",
  "Wooden bucket":"Thick wooden walls, wider at the bottom, with a carrying handle across the top.",
  "Plain door":"One flat board, as tall and wide as a person needs, with a knob to pull it.",
  "Panel door":"A door with raised panels on the front — they make it stiffer so it doesn't bend.",
  "Barn door":"A big, wide door with a cross bar to keep the boards from sagging.",
  "Square stool":"A square seat on four legs, one at each corner — very steady.",
  "Three-leg stool":"A round seat on three legs — three legs never wobble, even on an uneven floor.",
  "Bar stool":"A tall seat for a high counter, on thin metal legs (metal is strong even when thin).",
  "Kitchen chair":"A seat on four legs with a flat back fixed to the back edge of the seat.",
  "Tall-back chair":"Like a kitchen chair but with a much taller back, so you can rest your head.",
  "Armchair":"A wide, soft cushion seat with arm rests on both sides and a soft back.",
  "Dining table":"A long rectangular top on four legs at the corners — room for a family.",
  "Round table":"A round top on one thick middle post with a wide foot at the bottom — no corners to bump.",
  "Kitchen table":"A smaller table with thin metal legs that hold a lot.",
  "Park bench":"A long seat for two or three people, with a back to lean on and metal legs.",
  "Simple bench":"A long plank resting on two wide end boards.",
  "Stone bench":"A heavy stone slab on two stone blocks — it lasts for hundreds of years.",
  "Single bed":"A frame on four legs, long enough for a grown-up, with a soft mattress on top.",
  "Double bed":"A wider frame for two, with a tall board at the head end.",
  "Bunk-style bed":"A bed with tall corner posts — they hold the frame up from the sides.",
  "Bookshelf":"Two tall side boards with flat shelves between them, spaced a book's height apart.",
  "Wide shelf":"A low, wide shelf with thick boards, for heavy books.",
  "Tall bookcase":"A tall case with many shelves — it holds a whole library in a small space.",
  "Wooden ladder":"Two long side rails with round rungs between them, one step apart.",
  "Tall ladder":"A longer ladder with more rungs, for reaching high roofs and trees.",
  "Metal ladder":"Thin metal rails and flat metal steps — light to carry but strong.",
  "Classic doghouse":"A hollow box with a door hole in the front and a pointed roof that sheds rain.",
  "Flat-roof doghouse":"A hollow box with a closed top (a flat roof) and a door hole.",
  "Big dog's house":"A bigger doghouse with a tall door and a pointed roof, for a big dog.",
  "Garden barrow":"An open metal tray on one wheel at the front, two long handles and two legs at the back.",
  "Wooden barrow":"The same idea in wood, with a bigger wheel for bumpy ground.",
  "Cottage":"Stone walls around one room, a pointed (gable) roof that sheds rain, a door in the middle and a window on each side.",
  "Flat-roof house":"A simple box house with a flat roof, one big window and a door at the side.",
  "Tower house":"A tall, narrow house with a door at the bottom, a high window and a cone-shaped roof.",
  "Round hut":"Round walls made of one big tube, a door, and a dome roof on top.",
  "Hatchback":"A hollow metal body (thin sheets around an empty inside) on four wheels at the corners.",
  "Pickup truck":"A closed cab for the driver and an open box behind it for carrying loads, on four big wheels.",
  "Race car":"Long, low and wide, with a sloping glass windshield and wide wheels for grip.",
  "Hay cart":"An open wooden box on two big wheels, with a long shaft at the front to pull it.",
  "Market cart":"A bigger cart with a prop at the front so it stands level when you stop.",
  "Rowing boat":"A hollow wooden hull, open at the top, with a seat across the middle.",
  "Canoe":"A long, narrow, light hull — fast through the water.",
  "Fishing boat":"A big, wide hull with a mast in the middle.",
  "Little notebook":"A few sheets of paper between two thin covers — small enough for a pocket.",
  "Big book":"Many pages between two hard covers with a spine along one side that holds them together.",
  "Paper lantern lamp":"A glass ball on a foot — the glass lets the light out but keeps the wind away.",
  "Street lamp":"A tall post with a glass dome on top, so the light reaches far.",
  "Horseshoe magnet":"A bar with two arms: both ends pull at the same time, so it's twice as strong.",
  "Ring magnet":"A thick metal ring.",
  "Wooden stairs":"Steps that all have the same height — your legs learn the rhythm and you don't trip.",
  "Stone stairs":"Wide, low stone steps: slow to climb but easy for everyone.",
  "Crystal on a stand":"A tall glass point on a heavy stone block — the heavy block keeps it from tipping over.",
  "Crystal cluster":"Three crystals of different heights growing from one stone.",
  "Desktop computer":"A screen on a stand, with a flat board of keys lying in front of it.",
  "Laptop":"A screen standing at the back edge of a flat board of keys.",
  "Stone gate":"Two posts and a beam across the top, wide and high enough to walk through.",
  "Ring gate":"A giant metal ring standing on a block — you step through the middle.",
  "Two-storey house":"One tall box with an upper floor inside. The upper floor has a hole where the stairs come up.",
  "Hunting horn":"A long metal cone, hollow inside, with a small mouthpiece at the narrow end — the wide end spreads the sound far.",
  "Trumpet":"A long thin tube with a flared bell at the end — the long tube makes the note low and loud.",
  "Ram's horn":"An animal horn, hollowed out — the oldest kind of horn people ever blew.",
  "Treasure chest":"A hollow box with a separate lid resting on top and a lock on the front.",
  "Toy box":"A hollow box with its lid built on.",
  "Big storage chest":"A long, deep chest with a metal band around it to keep the wood from splitting.",
};

// ---- ready-made designs to start from (Barbara, 2026-11-22: "add different designs of a house and everything else so the player can choose").
// Each is a list of parts in cm, made to work; pick one, then change anything you like.
const DESIGNS=(()=>{let k=0;const id=()=>"d"+(k++).toString(36);
  const P=(shape,o,mat,color,name)=>Object.assign({shape,id:id(),name:name||shape,mat:mat||"wood"},color?{color}:{},o);
  const box=(w,h,d,x,y,z,mat,c,nm)=>P("box",{w,h,d,x,y,z},mat,c,nm),cyl=(r,h,x,y,z,mat,c,nm,rz)=>P("cylinder",{r,h,x,y,z,rz:rz||0},mat,c,nm),
    tube=(r,h,wall,bottom,x,y,z,mat,c,nm)=>P("tube",{r,h,wall,bottom,x,y,z},mat,c,nm),shell=(w,h,d,wall,top,x,y,z,mat,c,nm)=>P("shell",{w,h,d,wall,top,x,y,z},mat,c,nm),
    ring=(R,t,x,y,z,mat,c,nm,ry)=>P("torus",{R,t,x,y,z,ry:ry||0},mat,c,nm),wedge=(w,h,d,x,y,z,mat,c,nm)=>P("wedge",{w,h,d,x,y,z},mat,c,nm),
    cone=(r,h,x,y,z,mat,c,nm)=>P("cone",{r,h,x,y,z},mat,c,nm),dome=(r,x,y,z,mat,c,nm)=>P("dome",{r,x,y,z,wall:0},mat,c,nm),ball=(r,x,y,z,mat,c,nm)=>P("sphere",{r,x,y,z},mat,c,nm);
  const legs4=(sx,sz,h,t,mat,c)=>[[1,1],[-1,1],[1,-1],[-1,-1]].map(([a,b])=>box(t,h,t,a*sx,h/2,b*sz,mat,c,"leg"));
  const wheels=(sx,sz,r,w,c)=>[[1,1],[-1,1],[1,-1],[-1,-1]].map(([a,b])=>cyl(r,w,a*sx,r,b*sz,"rubber",c||"#222226","wheel",90));
  return {
  cup:[{name:"Mug",parts:()=>[tube(4,10,.5,.5,0,5,0,"clay","#f2efe8","cup"),ring(2.5,.8,4.5,5,0,"clay","#f2efe8","handle")]},
       {name:"Tea cup",parts:()=>[cyl(7,.8,0,.4,0,"clay","#e8f0ff","saucer"),tube(4.5,6,.4,.4,0,3.8,0,"clay","#e8f0ff","cup"),ring(1.8,.6,5,4.2,0,"clay","#e8f0ff","handle")]},
       {name:"Tall mug",parts:()=>[tube(3.6,13,.5,.6,0,6.5,0,"clay","#3f6fa8","cup"),ring(3,1,4,7,0,"clay","#3f6fa8","handle")]}],
  bowl:[{name:"Soup bowl",parts:()=>[tube(9,7,.6,.6,0,3.5,0,"clay","#f4efe4","bowl")]},
        {name:"Wooden bowl",parts:()=>[tube(11,8,1,1,0,4,0,"wood","#a8743f","bowl")]},
        {name:"Footed bowl",parts:()=>[cyl(5,2,0,1,0,"clay","#d8e8d0","foot"),tube(10,6,.6,.6,0,5,0,"clay","#d8e8d0","bowl")]}],
  plate:[{name:"Dinner plate",parts:()=>[cyl(13,1.4,0,.7,0,"clay","#ffffff","plate")]},{name:"Square plate",parts:()=>[box(24,1.4,24,0,.7,0,"clay","#f0e6d8","plate")]},
         {name:"Wooden board",parts:()=>[box(30,2,20,0,1,0,"wood","#b88a50","board")]}],
  vase:[{name:"Tall vase",parts:()=>[tube(6,28,.6,1,0,14,0,"glass","#bfe6ff","vase")]},{name:"Wide vase",parts:()=>[tube(8,22,.8,1,0,11,0,"clay","#c8603a","vase")]},
        {name:"Vase on a stand",parts:()=>[cyl(7,3,0,1.5,0,"stone","#9a958c","stand"),tube(5,25,.6,1,0,15.5,0,"clay","#5f9a6a","vase")]}],
  bucket:[{name:"Metal bucket",parts:()=>[tube(14,30,.3,.3,0,15,0,"metal","#9aa3ad","bucket"),ring(14,1,0,30,0,"metal","#6a7078","handle")]},
          {name:"Wooden bucket",parts:()=>[tube(15,32,1.5,1.5,0,16,0,"wood","#a8743f","bucket"),ring(4,1.5,0,33,0,"wood","#7a4a28","grip"),box(32,2,3,0,36.5,0,"wood","#7a4a28","bar")].slice(0,2).concat([ring(15,1.2,0,32,0,"metal","#555","handle")])}],
  door:[{name:"Plain door",parts:()=>[box(85,200,4,0,100,0,"door","#7a4a28","door"),ball(2.5,34,100,-4,"metal","#d8ac4a","knob")]},
        {name:"Panel door",parts:()=>[box(85,205,4.5,0,102.5,0,"door","#2e5a3a","door"),box(60,70,1,0,150,-2.7,"door","#3a6a48","top panel"),box(60,70,1,0,60,-2.7,"door","#3a6a48","bottom panel"),ball(2.5,35,100,-4.5,"metal","#d8ac4a","knob")]},
        {name:"Barn door",parts:()=>[box(95,210,5,0,105,0,"door","#9a3a2a","door"),box(95,10,2,0,105,-3.4,"wood","#f0e6d8","cross bar"),box(6,30,6,40,105,-5.5,"metal","#333","handle")]}],
  stool:[{name:"Square stool",parts:()=>[box(35,4,35,0,46,0,"wood","#a8743f","seat"),...legs4(14,14,44,4)]},
         {name:"Three-leg stool",parts:()=>[cyl(18,4,0,46,0,"wood","#b88a50","seat"),cyl(2.5,44,12,22,0),cyl(2.5,44,-6,22,10.4),cyl(2.5,44,-6,22,-10.4)]},
         {name:"Bar stool",parts:()=>[cyl(18,4,0,73,0,"wood","#5a3a22","seat"),...legs4(11,11,71,4,"metal","#333")]}],
  chair:[{name:"Kitchen chair",parts:()=>[box(42,4,42,0,45,0,"wood","#a8743f","seat"),...legs4(18,18,43,4.5),box(42,40,4,0,67,-19,"wood","#a8743f","back")]},
         {name:"Tall-back chair",parts:()=>[box(44,4,44,0,46,0,"wood","#5a3a22","seat"),...legs4(19,19,44,5,"wood","#5a3a22"),box(44,70,4,0,83,-20,"wood","#5a3a22","back")]},
         {name:"Armchair",parts:()=>[box(60,12,55,0,40,0,"fabric","#3f6fa8","cushion"),...legs4(26,23,34,6,"wood","#5a3a22"),box(60,45,8,0,68.5,-23.5,"fabric","#3f6fa8","back"),box(8,22,55,-34,57,0,"fabric","#3f6fa8","arm"),box(8,22,55,34,57,0,"fabric","#3f6fa8","arm")]}],
  table:[{name:"Dining table",parts:()=>[box(120,5,75,0,73.5,0,"wood","#8a5a32","top"),...legs4(54,32,71,6,"wood","#8a5a32")]},
         {name:"Round table",parts:()=>[cyl(45,4,0,74,0,"wood","#a8743f","top"),cyl(6,70,0,37,0,"wood","#7a4a28","pillar"),cyl(25,3,0,1.5,0,"wood","#7a4a28","foot")]},
         {name:"Kitchen table",parts:()=>[box(90,4,70,0,74,0,"wood","#d8c8a8","top"),...legs4(40,30,72,5,"metal","#333")]}],
  bench:[{name:"Park bench",parts:()=>[box(150,5,40,0,45.5,0,"wood","#8a5a32","seat"),...legs4(68,16,43,5,"metal","#333"),box(150,35,4,0,65.5,-18,"wood","#8a5a32","back")]},
         {name:"Simple bench",parts:()=>[box(120,5,35,0,45.5,0,"wood","#b88a50","seat"),box(5,43,35,-50,21.5,0,"wood","#b88a50","end"),box(5,43,35,50,21.5,0,"wood","#b88a50","end")]},
         {name:"Stone bench",parts:()=>[box(140,8,40,0,44,0,"stone","#9a958c","seat"),box(20,40,40,-50,20,0,"stone","#8a857c","block"),box(20,40,40,50,20,0,"stone","#8a857c","block")]}],
  bed:[{name:"Single bed",parts:()=>[box(92,10,200,0,40,0,"wood","#8a5a32","frame"),...legs4(42,95,35,6,"wood","#8a5a32"),box(90,15,195,0,52.5,0,"fabric","#f0f0f5","mattress")]},
       {name:"Double bed",parts:()=>[box(165,12,210,0,39,0,"wood","#5a3a22","frame"),...legs4(78,100,33,8,"wood","#5a3a22"),box(160,20,205,0,55,0,"fabric","#e8e0f0","mattress"),box(165,60,6,0,75,-108,"wood","#5a3a22","headboard")]},
       {name:"Bunk-style bed",parts:()=>[box(95,10,205,0,35,0,"wood","#b88a50","frame"),box(8,90,8,-44,45,-99,"wood","#b88a50","post"),box(8,90,8,44,45,-99,"wood","#b88a50","post"),box(8,90,8,-44,45,99,"wood","#b88a50","post"),box(8,90,8,44,45,99,"wood","#b88a50","post"),box(90,14,198,0,47,0,"fabric","#3f8a5a","mattress")]}],
  shelf:[{name:"Bookshelf",parts:()=>[box(2,180,30,-41,90,0),box(2,180,30,41,90,0),...[1,45,90,135,179].map(y=>box(80,2,30,0,y,0,"wood","#a8743f","shelf"))]},
         {name:"Wide shelf",parts:()=>[box(3,120,35,-61.5,60,0,"wood","#5a3a22"),box(3,120,35,61.5,60,0,"wood","#5a3a22"),...[1.5,40,80,118.5].map(y=>box(120,3,35,0,y,0,"wood","#5a3a22","shelf"))]},
         {name:"Tall bookcase",parts:()=>[box(3,210,32,-46.5,105,0,"wood","#d8c8a8"),box(3,210,32,46.5,105,0,"wood","#d8c8a8"),...[1.5,42,84,126,168,208.5].map(y=>box(90,3,32,0,y,0,"wood","#d8c8a8","shelf"))]}],
  ladder:[{name:"Wooden ladder",parts:()=>[box(5,200,5,-20,100,0,"wood","#a8743f","rail"),box(5,200,5,20,100,0,"wood","#a8743f","rail"),...[30,60,90,120,150,180].map(y=>cyl(1.5,40,0,y,0,"wood","#a8743f","rung",90))]},
          {name:"Tall ladder",parts:()=>[box(6,300,6,-22,150,0,"wood","#8a5a32","rail"),box(6,300,6,22,150,0,"wood","#8a5a32","rail"),...[30,60,90,120,150,180,210,240,270].map(y=>cyl(1.8,44,0,y,0,"wood","#8a5a32","rung",90))]},
          {name:"Metal ladder",parts:()=>[box(3,220,6,-20,110,0,"metal","#9aa3ad","rail"),box(3,220,6,20,110,0,"metal","#9aa3ad","rail"),...[28,56,84,112,140,168,196].map(y=>box(40,2,5,0,y,0,"metal","#9aa3ad","rung"))]}],
  doghouse:[{name:"Classic doghouse",parts:()=>[shell(80,70,100,3,1,0,35,0,"wood","#c8603a","house"),box(36,48,8,0,24,-50,"door","#3a2a1a","door"),wedge(90,35,110,0,87.5,0,"wood","#5a3a22","roof")]},
            {name:"Flat-roof doghouse",parts:()=>[shell(90,75,90,3,1,0,37.5,0,"wood","#3f6fa8","house"),box(36,50,8,0,25,-45,"door","#2a2a2a","door")]},
            {name:"Big dog's house",parts:()=>[shell(110,90,130,4,1,0,45,0,"wood","#d8c8a8","house"),box(45,60,10,0,30,-65,"door","#5a3a22","door"),wedge(125,45,140,0,112.5,0,"wood","#b5392b","roof")]}],
  wheelbarrow:[{name:"Garden barrow",parts:()=>[shell(60,30,80,1.5,0,0,45,0,"metal","#2f8a4f","tray"),cyl(20,8,0,20,45,"rubber","#222","wheel",90),box(4,4,70,-25,50,-70,"wood","#8a5a32","handle"),box(4,4,70,25,50,-70,"wood","#8a5a32","handle"),box(4,30,4,-25,15,-30,"metal","#333","leg"),box(4,30,4,25,15,-30,"metal","#333","leg")]},
               {name:"Wooden barrow",parts:()=>[shell(70,35,90,2,0,0,47.5,0,"wood","#a8743f","tray"),cyl(22,10,0,22,50,"wood","#5a3a22","wheel",90),box(5,5,80,-28,55,-80,"wood","#7a4a28","handle"),box(5,5,80,28,55,-80,"wood","#7a4a28","handle"),box(5,30,5,-28,15,-35,"wood","#7a4a28","leg"),box(5,30,5,28,15,-35,"wood","#7a4a28","leg")]}],
  house:[{name:"Cottage",parts:()=>[shell(500,260,400,20,1,0,130,0,"stone","#e8dcc0","walls"),box(95,215,30,0,107.5,-200,"door","#7a4a28","door"),box(80,80,30,-160,150,-200,"window","#a9d8ff","window"),box(80,80,30,160,150,-200,"window","#a9d8ff","window"),wedge(560,170,440,0,345,0,"wood","#b5482f","roof")]},
         {name:"Flat-roof house",parts:()=>[shell(600,280,500,20,1,0,140,0,"stone","#f2f2f2","walls"),box(100,220,30,-150,110,-250,"door","#2e3e5a","door"),box(180,100,30,100,160,-250,"window","#a9d8ff","big window"),box(620,15,520,0,287.5,0,"wood","#555","roof edge")]},
         {name:"Tower house",parts:()=>[shell(400,600,400,20,1,0,300,0,"stone","#c8b898","tower"),box(95,215,30,0,107.5,-200,"door","#5a3a22","door"),box(60,90,30,0,400,-200,"window","#a9d8ff","window"),cone(300,250,0,725,0,"wood","#3f6fa8","roof")]},
         {name:"Two-storey house",parts:()=>[shell(500,520,500,20,1,0,260,0,"stone","#f0e2c8","walls"),P("floor",{w:460,h:12,d:460,hw:100,hd:300,x:0,y:256,z:0},"wood","#a8743f","upper floor"),P("stairs",{w:90,h:242,d:300,steps:12,x:180,y:141,z:80},"wood","#8a5a32","stairs"),box(95,215,30,-60,107.5,-250,"door","#7a4a28","door"),box(80,80,30,120,150,-250,"window","#a9d8ff","window"),box(80,80,30,-120,390,-250,"window","#a9d8ff","window"),box(80,80,30,120,390,-250,"window","#a9d8ff","window"),wedge(540,180,540,0,610,0,"wood","#8a3a2a","roof")]},
         {name:"Round hut",parts:()=>[tube(300,250,20,20,0,125,0,"stone","#d8c8a8","walls"),box(95,215,30,0,107.5,-295,"door","#7a4a28","door"),dome(320,0,250+160,0,"wood","#8a5a32","roof")]}],
  car:[{name:"Hatchback",parts:()=>[shell(170,120,400,.3,1,0,100,0,"metal","#c8432f","body"),...wheels(85,130,35,20)]},
       {name:"Pickup truck",parts:()=>[shell(180,130,200,.3,1,0,110,-110,"metal","#3f6fa8","cab"),shell(180,60,240,.3,0,0,75,110,"metal","#3f6fa8","truck bed"),...wheels(90,150,38,22)]},
       {name:"Race car",parts:()=>[shell(180,70,450,.3,1,0,70,0,"metal","#e8c040","body"),wedge(160,30,120,0,120,-40,"glass","#bfe6ff","windshield"),...wheels(90,160,34,24)]}],
  cart:[{name:"Hay cart",parts:()=>[shell(100,40,150,2,0,0,80,0,"wood","#a8743f","box"),cyl(45,8,-55,45,0,"wood","#5a3a22","wheel",90),cyl(45,8,55,45,0,"wood","#5a3a22","wheel",90),box(6,6,120,0,70,-130,"wood","#7a4a28","shaft")]},
        {name:"Market cart",parts:()=>[shell(120,50,180,2,0,0,90,0,"wood","#3f8a5a","box"),cyl(50,10,-66,50,20,"wood","#333","wheel",90),cyl(50,10,66,50,20,"wood","#333","wheel",90),box(8,65,8,0,32.5,-80,"wood","#5a3a22","prop")]}],
  boat:[{name:"Rowing boat",parts:()=>[shell(120,50,280,3,0,0,25,0,"wood","#a8743f","hull"),box(114,4,30,0,40,0,"wood","#7a4a28","seat")]},
        {name:"Canoe",parts:()=>[shell(80,40,450,1,0,0,20,0,"wood","#c8603a","hull")]},
        {name:"Fishing boat",parts:()=>[shell(180,80,420,4,0,0,40,0,"wood","#3f6fa8","hull"),box(10,200,10,0,180,0,"wood","#7a4a28","mast")]}],
  book:[{name:"Little notebook",parts:()=>[box(14,.6,20,0,.3,0,"fabric","#3f6fa8","cover"),box(13,1.6,19,0,1.4,0,"paper","","pages"),box(14,.6,20,0,2.5,0,"fabric","#3f6fa8","cover")]},
        {name:"Big book",parts:()=>[box(24,1,32,0,.5,0,"wood","#7a2a2a","cover"),box(22,5,30,0,3.5,0,"paper","","pages"),box(24,1,32,0,6.5,0,"wood","#7a2a2a","cover"),box(1,7,32,-12,3.5,0,"wood","#7a2a2a","spine")]}],
  lamp:[{name:"Paper lantern lamp",parts:()=>[cyl(9,3,0,1.5,0,"wood","#5a3a22","foot"),cyl(1.5,20,0,13,0,"metal","#333","post"),P("sphere",{r:10,x:0,y:32,z:0,wall:.5},"glass","#ffe9b0","glass")]},
        {name:"Street lamp",parts:()=>[cyl(20,8,0,4,0,"stone","#8a857c","foot"),cyl(5,240,0,128,0,"metal","#2a2a2e","post"),P("dome",{r:18,x:0,y:257,z:0,wall:.5},"glass","#ffe9b0","glass")]}],
  magnet:[{name:"Horseshoe magnet",parts:()=>[box(20,5,5,0,2.5,0,"metal","#c8302a","bar"),box(5,18,5,-7.5,14,0,"metal","#c8302a","arm"),box(5,18,5,7.5,14,0,"metal","#c8302a","arm")]},
          {name:"Ring magnet",parts:()=>[ring(10,5,0,12.5,0,"metal","#6a7078","ring")]}],
  stairs:[{name:"Wooden stairs",parts:()=>[P("stairs",{w:90,h:200,d:260,steps:10,x:0,y:100,z:0},"wood","#a8743f","stairs")]},
          {name:"Stone stairs",parts:()=>[P("stairs",{w:140,h:120,d:280,steps:8,x:0,y:60,z:0},"stone","#b8b0a0","stairs")]}],
  healstone:[{name:"Crystal on a stand",parts:()=>[box(40,20,40,0,10,0,"stone","#8a857c","stand"),cone(12,60,0,50,0,"glass","#7dffb0","crystal")]},
             {name:"Crystal cluster",parts:()=>[cyl(28,14,0,7,0,"stone","#6a655c","stone"),cone(9,70,0,49,0,"glass","#b07aff","crystal"),cone(6,45,14,36.5,4,"glass","#b07aff","crystal"),cone(5,35,-13,31.5,-5,"glass","#b07aff","crystal")]}],
  computer:[{name:"Desktop computer",parts:()=>[box(50,4,40,0,2,0,"plastic","#d8d8d8","base"),box(40,2.5,14,0,5,-12,"plastic","#333333","keys"),box(6,12,6,0,10,12,"metal","#888888","stand"),box(52,34,3,0,33,12,"glass","#1a2a3a","screen")]},
            {name:"Laptop",parts:()=>[box(36,2,25,0,1,0,"plastic","#9aa3ad","keys"),box(36,24,1.5,0,14,12,"glass","#1a2a3a","screen")]}],
  gate:[{name:"Stone gate",parts:()=>[box(40,240,40,-80,120,0,"stone","#9a958c","post"),box(40,240,40,80,120,0,"stone","#9a958c","post"),box(220,35,45,0,257.5,0,"stone","#b8b0a0","beam")]},
        {name:"Ring gate",parts:()=>[box(140,20,60,0,10,0,"stone","#6a655c","step"),ring(110,18,0,130,0,"metal","#7a5ad8","ring")]}],
  horn:[{name:"Hunting horn",parts:()=>[P("cone",{r:6,h:35,wall:.4,x:0,y:7,z:0,rz:90},"metal","#d8ac4a","horn"),P("tube",{r:1,h:6,wall:.3,bottom:0,x:-20.5,y:7,z:0,rz:90},"metal","#b8902a","mouthpiece")]},
         {name:"Trumpet",parts:()=>[P("tube",{r:1,h:50,wall:.2,bottom:0,x:0,y:6,z:0,rz:90},"metal","#e8c040","tube"),P("cone",{r:6,h:12,wall:.3,x:31,y:6,z:0,rz:-90},"metal","#e8c040","bell")]},
         {name:"Ram's horn",parts:()=>[P("cone",{r:5,h:40,wall:.6,x:0,y:6,z:0,rz:90,ry:20},"stone","#e8dcc0","horn")]}],
  chest:[{name:"Treasure chest",parts:()=>[shell(80,50,50,2,0,0,25,0,"wood","#8a5a32","box"),box(80,6,50,0,53,0,"wood","#6a3a22","lid"),box(10,8,2,0,48,-26,"metal","#d8ac4a","lock")]},
         {name:"Toy box",parts:()=>[shell(70,45,45,2,1,0,22.5,0,"wood","#e8c040","box")]},
         {name:"Big storage chest",parts:()=>[shell(110,60,60,2.5,0,0,30,0,"wood","#5a3a22","box"),box(110,6,60,0,63,0,"wood","#5a3a22","lid"),box(116,4,4,0,30,-31,"metal","#333","band")]}],
  };})();

// ---- parts ----
const DENS={wood:.6,clay:2,metal:7.8,plastic:1,glass:2.5,fabric:.3,stone:2.4,rubber:1.2,door:.6,window:2.5,paper:.8};   // g per cm³
const STR={wood:30,clay:20,metal:300,plastic:10,glass:10,fabric:.2,stone:40,rubber:1,door:30,window:10,paper:1};     // what 1 cm² can safely carry, kg
const MCOL={wood:"#a8743f",clay:"#e9dcc8",metal:"#9aa3ad",plastic:"#4f8fd8",glass:"#bfe6ff",fabric:"#d85a6a",stone:"#9a958c",rubber:"#2a2a2e",door:"#7a4a28",window:"#a9d8ff",paper:"#f6f0dc"};
const MNAME={wood:"wood",clay:"clay",metal:"metal",plastic:"plastic",glass:"glass",fabric:"cloth",stone:"stone",rubber:"rubber",door:"door",window:"window",paper:"paper"};
const SHAPES={box:{w:20,h:20,d:20},shell:{w:40,h:30,d:40,wall:2,top:0},cylinder:{r:10,h:20},tube:{r:10,h:20,wall:1,bottom:1},sphere:{r:10},cone:{r:10,h:20},torus:{R:8,t:2},wedge:{w:40,h:20,d:40},dome:{r:20,wall:0},stairs:{w:90,h:250,d:300,steps:12},floor:{w:400,h:12,d:400,hw:100,hd:300}};
const SNAME={box:"Box",shell:"Hollow box",cylinder:"Cylinder",tube:"Tube",sphere:"Sphere",cone:"Cone",torus:"Ring",wedge:"Roof wedge",dome:"Dome",stairs:"Stairs",floor:"Upper floor"};
const FIELDS={box:["w","h","d"],shell:["w","h","d","wall","top"],cylinder:["r","h"],tube:["r","h","wall","bottom","top"],sphere:["r","wall"],cone:["r","h","wall"],torus:["R","t"],wedge:["w","h","d"],dome:["r","wall"],stairs:["w","h","d","steps"],floor:["w","h","d","hw","hd"]};
const FNAME={steps:"number of steps",hw:"stair hole width",hd:"stair hole depth",top:"lid (1 = closed, 0 = open)",wall2:"",w:"width",h:"height",d:"depth",r:"radius",wall:"wall",bottom:"bottom",R:"ring radius",t:"thickness",x:"x",y:"y (up)",z:"z",rx:"tilt x°",ry:"turn y°",rz:"tilt z°"};
const n=(v,d)=>{v=+v;return isFinite(v)?v:d;};
const DEG=Math.PI/180;
function geoOf(p){const s=p.shape;
  if(s==="box")return new THREE.BoxGeometry(n(p.w,20),n(p.h,20),n(p.d,20));
  if(s==="cylinder")return new THREE.CylinderGeometry(n(p.r,10),n(p.r,10),n(p.h,20),28);
  if(s==="sphere")return new THREE.SphereGeometry(n(p.r,10),24,16);
  if(s==="cone")return new THREE.ConeGeometry(n(p.r,10),n(p.h,20),28);
  if(s==="torus")return new THREE.TorusGeometry(n(p.R,8),Math.max(.1,n(p.t,2)/2),12,36);
  if(s==="wedge"){const w=n(p.w,40),h=n(p.h,20),d=n(p.d,40),sh=new THREE.Shape();sh.moveTo(-w/2,-h/2);sh.lineTo(w/2,-h/2);sh.lineTo(0,h/2);sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return g;}
  if(s==="dome"){const r=n(p.r,20),g=new THREE.SphereGeometry(r,28,14,0,Math.PI*2,0,Math.PI/2);g.translate(0,-r/2,0);return g;}
  if(s==="tube"&&n(p.top,0)>=.5)return new THREE.CylinderGeometry(n(p.r,10),n(p.r,10),n(p.h,20),36);
  const r=n(p.r,10),h=n(p.h,20),w=Math.min(r-.05,Math.max(.1,n(p.wall,1))),b=Math.min(h-.1,Math.max(0,n(p.bottom,0)));   // tube: a lathe profile, open at the top
  const pts=b>0?[[0,-h/2+b],[r-w,-h/2+b],[r-w,h/2],[r,h/2],[r,-h/2],[0,-h/2]]:[[r-w,-h/2],[r-w,h/2],[r,h/2],[r,-h/2],[r-w,-h/2]];
  return new THREE.LatheGeometry(pts.map(([a,c])=>new THREE.Vector2(Math.max(0,a),c)),36);}
function matOf(p){const c=p.color||MCOL[p.mat]||MCOL.wood;const m=new THREE.MeshLambertMaterial({color:c,side:THREE.DoubleSide});if(p.mat==="glass"||p.mat==="window"){m.transparent=true;m.opacity=.55;}return m;}
// stairs go up towards the back (+z), solid underneath; an upper floor has a hole at its right back corner where stairs come up (0 = no hole)
function stairParts(p){const k=Math.max(2,Math.min(40,Math.round(n(p.steps,12)))),w=n(p.w,90),h=n(p.h,250),d=n(p.d,300),L=[];for(let i=0;i<k;i++){const sh=h*(i+1)/k;L.push([0,-h/2+sh/2,-d/2+d*(i+.5)/k,w,sh,d/k]);}return L;}
function floorParts(p){const w=n(p.w,400),h=n(p.h,12),d=n(p.d,400),hw=Math.max(0,Math.min(w-1,n(p.hw,0))),hd=Math.max(0,Math.min(d-1,n(p.hd,0)));if(!(hw>0&&hd>0))return [[0,0,0,w,h,d]];return [[-hw/2,0,0,w-hw,h,d],[w/2-hw/2,0,-hd/2,hw,h,d-hd]];}
const manyOf={shell:p=>shellParts(p),stairs:stairParts,floor:floorParts};
function shellParts(p){const w=n(p.w,40),h=n(p.h,30),d=n(p.d,40),t=Math.max(.1,Math.min(n(p.wall,2),w/2-.05,d/2-.05,h/2-.05)),top=n(p.top,0)>=.5;
  const L=[[0,-h/2+t/2,0,w,t,d],[0,0,-d/2+t/2,w,h,t],[0,0,d/2-t/2,w,h,t],[-w/2+t/2,0,0,t,h,d-2*t],[w/2-t/2,0,0,t,h,d-2*t]];if(top)L.push([0,h/2-t/2,0,w,t,d]);return L;}
function meshOf(p){if(manyOf[p.shape]){const g=new THREE.Group(),mt=matOf(p);manyOf[p.shape](p).forEach(([x,y,z,a,b,c])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mt);m.position.set(x,y,z);m.userData.part=p;m.castShadow=true;g.add(m);});
    g.position.set(n(p.x,0),n(p.y,0),n(p.z,0));g.rotation.set(n(p.rx,0)*DEG,n(p.ry,0)*DEG,n(p.rz,0)*DEG);g.userData.part=p;g.material=mt;g.updateMatrixWorld(true);return g;}
  const m=new THREE.Mesh(geoOf(p),matOf(p));m.position.set(n(p.x,0),n(p.y,0),n(p.z,0));m.rotation.set(n(p.rx,0)*DEG,n(p.ry,0)*DEG,n(p.rz,0)*DEG);m.userData.part=p;m.castShadow=true;m.updateMatrixWorld(true);return m;}
function volOf(p){const s=p.shape,PI=Math.PI;if(manyOf[s])return manyOf[s](p).reduce((v,q)=>v+q[3]*q[4]*q[5],0);
  const hw=n(p.wall,0);if(s==="box")return n(p.w,0)*n(p.h,0)*n(p.d,0);if(s==="cylinder")return PI*p.r*p.r*p.h;if(s==="sphere")return 4/3*PI*(p.r**3-(hw>0?Math.max(0,p.r-hw)**3:0));
  if(s==="cone")return PI*p.r*p.r*p.h/3*(hw>0?1-Math.max(0,1-hw/p.r)**3:1);if(s==="wedge")return p.w*p.h*p.d/2;if(s==="dome")return 2/3*PI*(p.r**3-(hw>0?Math.max(0,p.r-hw)**3:0));
  if(s==="torus")return 2*PI*PI*p.R*(p.t/2)**2;const w=Math.min(p.r,p.wall||1),b=p.bottom||0;return PI*(p.r*p.r-(p.r-w)**2)*(p.h-b)+PI*p.r*p.r*b;}
// is a world point inside a part? (in the part's own frame — handles any rotation)
const _v=new THREE.Vector3();
function inside(P,pt,pad){pad=pad||0;_v.copy(pt).applyMatrix4(P.inv);const p=P.p,x=_v.x,y=_v.y,z=_v.z,s=p.shape;
  if(s==="box")return Math.abs(x)<=p.w/2+pad&&Math.abs(y)<=p.h/2+pad&&Math.abs(z)<=p.d/2+pad;
  if(manyOf[s])return manyOf[s](p).some(([cx,cy,cz,a,b,c])=>Math.abs(x-cx)<=a/2+pad&&Math.abs(y-cy)<=b/2+pad&&Math.abs(z-cz)<=c/2+pad);
  if(s==="cylinder")return Math.abs(y)<=p.h/2+pad&&x*x+z*z<=(p.r+pad)**2;
  const wl=n(p.wall,0);
  if(s==="sphere"){const d=Math.sqrt(x*x+y*y+z*z);return d<=p.r+pad&&(!(wl>0)||d>=p.r-wl-pad);}
  if(s==="cone"){if(Math.abs(y)>p.h/2+pad)return false;const rr=p.r*(.5-y/p.h),d=Math.hypot(x,z);return d<=rr+pad&&(!(wl>0)||d>=rr-wl-pad||y<=-p.h/2+wl+pad);}
  if(s==="wedge")return Math.abs(z)<=p.d/2+pad&&Math.abs(y)<=p.h/2+pad&&Math.abs(x)<=p.w/2*(.5-y/p.h)+pad;
  if(s==="dome"){const yy=y+p.r/2,d=Math.sqrt(x*x+yy*yy+z*z);return yy>=-pad&&d<=p.r+pad&&(!(wl>0)||d>=p.r-wl-pad);}
  if(s==="torus"){const q=Math.hypot(x,y)-p.R;return q*q+z*z<=(p.t/2+pad)**2;}
  if(Math.abs(y)>p.h/2+pad)return false;const d=Math.hypot(x,z),w=Math.min(p.r,p.wall||1),b=p.bottom||0;if(d>p.r+pad)return false;if(d>=p.r-w-pad)return true;return (b>0&&y<=-p.h/2+b+pad)||(n(p.top,0)>=.5&&y>=p.h/2-w-pad);}
// ---- looking at a design: boxes, weights, what touches what ----
function analyse(parts){const A={P:[],mass:0};
  for(const p of parts){const m=meshOf(p);const box=new THREE.Box3().setFromObject(m);const inv=m.matrixWorld.clone().invert();const vol=volOf(p),mass=vol*(DENS[p.mat]||.6)/1000;
    const up=new THREE.Vector3(0,1,0).applyQuaternion(m.quaternion);A.P.push({p,m,box,inv,vol,mass,up});A.mass+=mass;}
  const touch=(a,b)=>a.box.clone().expandByScalar(1.2).intersectsBox(b.box);A.touch=touch;
  A.P.forEach(a=>{a.nb=A.P.filter(b=>b!==a&&touch(a,b));a.ground=a.box.min.y<=1.5;});
  // pieces: parts joined by touching
  const seen=new Set();A.pieces=[];for(const a of A.P){if(seen.has(a))continue;const pc=[],q=[a];seen.add(a);while(q.length){const c=q.pop();pc.push(c);c.nb.forEach(b=>{if(!seen.has(b)){seen.add(b);q.push(b);}});}A.pieces.push(pc);}
  A.box=new THREE.Box3();A.P.forEach(a=>A.box.union(a.box));
  A.com=new THREE.Vector3();A.P.forEach(a=>{const c=a.box.getCenter(new THREE.Vector3());A.com.addScaledVector(c,a.mass);});if(A.mass>0)A.com.multiplyScalar(1/A.mass);
  const g=A.P.filter(a=>a.ground);A.foot=g.length?g.reduce((r,a)=>({x0:Math.min(r.x0,a.box.min.x),x1:Math.max(r.x1,a.box.max.x),z0:Math.min(r.z0,a.box.min.z),z1:Math.max(r.z1,a.box.max.z)}),{x0:1e9,x1:-1e9,z0:1e9,z1:-1e9}):null;
  return A;}
const cm=v=>`${Math.round(v)} cm`,kg=v=>v<10?`${v.toFixed(1)} kg`:`${Math.round(v).toLocaleString()} kg`,ml=v=>v>=1000?`${(v/1000).toFixed(v>=10000?0:1)} litres`:`${Math.round(v)} ml`;
const upright=a=>Math.abs(a.up.y)>.97,lying=a=>Math.abs(a.up.y)<.3;
function containerOf(A){let best=null;for(const a of A.P){if(a.p.shape!=="tube")continue;const cap=Math.PI*(a.p.r-Math.min(a.p.r,a.p.wall||1))**2*Math.max(0,a.p.h-(a.p.bottom||0));
    const c={a,cap,open:!(a.p.bottom>0),flip:a.up.y<-.97,tilt:!upright(a)};if(!best||(!c.open&&!c.flip&&!c.tilt&&c.cap>best.cap)||(best.open||best.flip||best.tilt))best=c;}return best;}
// the grid look at a design from above at one height: which cells are solid, and which empty cells are closed in (no way out to the edge)
function grid(A,y,opts){opts=opts||{};const B=A.box,ext=Math.max(B.max.x-B.min.x,B.max.z-B.min.z),c=Math.max(1,ext/90),x0=B.min.x-c,z0=B.min.z-c,nx=Math.ceil((B.max.x-B.min.x)/c)+3,nz=Math.ceil((B.max.z-B.min.z)/c)+3;
  const solid=new Uint8Array(nx*nz),pt=new THREE.Vector3();
  for(let i=0;i<nx;i++)for(let k=0;k<nz;k++){pt.set(x0+(i+.5)*c,y,z0+(k+.5)*c);let s=0;for(const a of A.P){const dp=a.p.mat==="door"?25:0;if(pt.y<a.box.min.y-dp||pt.y>a.box.max.y+dp)continue;if(a.p.mat==="door"){if(inside(a,pt,25)){s=2;break;}continue;}if(inside(a,pt)){s=1;}}solid[i*nz+k]=s;}
  const out=new Uint8Array(nx*nz),q=[];const pass=s=>s===0||(opts.doorsOpen&&s===2);
  for(let i=0;i<nx;i++)for(let k=0;k<nz;k++)if((i===0||k===0||i===nx-1||k===nz-1)&&pass(solid[i*nz+k])){out[i*nz+k]=1;q.push(i*nz+k);}
  while(q.length){const id=q.pop(),i=Math.floor(id/nz),k=id%nz;for(const [di,dk] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=k+dk;if(a<0||b<0||a>=nx||b>=nz)continue;const j=a*nz+b;if(!out[j]&&pass(solid[j])){out[j]=1;q.push(j);}}}
  const cells=[];for(let i=0;i<nx;i++)for(let k=0;k<nz;k++){const j=i*nz+k;if(solid[j]===0&&!out[j])cells.push([x0+(i+.5)*c,z0+(k+.5)*c]);}
  return {cells,area:cells.length*c*c,c,solid,nx,nz};}
// a basin (boat, cart, barrow): the lowest wide part is the floor; how deep can it hold water before it spills?
function basinOf(A){const t=containerOf(A);if(t&&!t.open&&!t.flip&&!t.tilt)return {cap:t.cap/1000,how:"tube"};
  const sh=A.P.filter(a=>a.p.shape==="shell"&&n(a.p.top,0)<.5&&upright(a)&&a.up.y>0).map(a=>{const p=a.p,t=Math.min(p.wall,p.w/2,p.d/2);return (p.w-2*t)*(p.d-2*t)*(p.h-t)/1000;}).sort((a,b)=>b-a);if(sh.length)return {cap:sh[0],how:"shell"};
  const floors=A.P.filter(a=>a.p.shape==="box"&&upright(a)).sort((a,b)=>(b.box.max.x-b.box.min.x)*(b.box.max.z-b.box.min.z)-(a.box.max.x-a.box.min.x)*(a.box.max.z-a.box.min.z));
  if(!floors.length)return {cap:0,why:"nothing that could hold anything"};const fl=floors[0],top=fl.box.max.y;let depth=0,area=0;
  for(let y=top+2;y<=top+200;y+=3){const g=grid(A,y);const under=g.cells.filter(([x,z])=>x>fl.box.min.x&&x<fl.box.max.x&&z>fl.box.min.z&&z<fl.box.max.z);if(under.length<4)break;area=Math.max(area,under.length*g.c*g.c);depth=y-top;}
  if(!depth)return {cap:0,why:"no sides around the floor — anything you put in falls off"};return {cap:area*depth/1000,depth,area,how:"box"};}
// what a surface's supports can carry
function supportsOf(A,s){const legs=new Set();s.nb.forEach(b=>{if(b.ground)legs.add(b);else b.nb.forEach(c=>{if(c!==s&&c.ground)legs.add(c);});});   // legs and posts may rise above the top (bed posts, chair backs)
  if(s.ground)legs.add(s);let cap=0;
  for(const l of legs){const bx=l.box,dx=bx.max.x-bx.min.x,dz=bx.max.z-bx.min.z,h=bx.max.y-bx.min.y;let area;
    if(l.p.shape==="tube")area=Math.PI*(l.p.r**2-(l.p.r-Math.min(l.p.r,l.p.wall||1))**2);else if(l.p.shape==="cylinder"&&upright(l))area=Math.PI*l.p.r**2;else area=dx*dz*(l.p.shape==="box"?1:.7);
    const thin=Math.max(1,Math.min(dx,dz)),slim=h/thin,k=slim>40?.25:slim>20?.6:1;cap+=area*(STR[l.p.mat]||10)*k;}
  return {legs:[...legs],cap};}
function surfaceOf(A,nd){let best=null;for(const a of A.P){if(!["box","cylinder"].includes(a.p.shape)||!upright(a))continue;const top=a.box.max.y,dx=a.box.max.x-a.box.min.x,dz=a.box.max.z-a.box.min.z;
    const big=Math.max(dx,dz),small=Math.min(dx,dz),fit=(top>=nd.hMin&&top<=nd.hMax?2:0)+(big>=Math.max(nd.w,nd.d)&&small>=Math.min(nd.w,nd.d)?1:0);
    if(a.box.max.y-a.box.min.y>Math.max(12,small*.6))continue;   // a tall block is a leg or a wall, not a seat
    if(!best||fit>best.fit||(fit===best.fit&&big*small>best.big*best.small))best={a,top,big,small,fit,thick:a.box.max.y-a.box.min.y};}return best;}
// ---- the tests: each gives a fact, and passes or not ----
function check(nd,A,item){const r=(ok,fact,why,whyFail,extra)=>Object.assign({ok,fact,why,whyFail,k:nd.k},extra||{});const C=containerOf(A);
  switch(nd.k){
  case "onePiece":{if(A.pieces.length<=1)return r(true,"Every part is joined to the rest — it's one piece.","Parts only hold together where they touch. Every part here touches another, so the whole thing moves as one piece.");
    const loose=A.pieces.slice().sort((a,b)=>a.length-b.length)[0];return r(false,`It's in ${A.pieces.length} separate pieces — the ${loose.map(a=>a.p.name||SNAME[a.p.shape].toLowerCase()).slice(0,3).join(", ")} ${loose.length>1?"aren't":"isn't"} attached to anything.`,"",
      `A part that doesn't touch any other part isn't connected — in real life it would just fall off or stay behind when you pick the thing up. Builders join parts where they meet: glue, nails, screws or one piece of clay.`);}
  case "stands":{if(!A.foot)return r(false,"Nothing touches the ground — it's floating in the air.","","Things don't float: gravity pulls everything down. Something has to rest on the ground (or on a table) and carry the weight.");
    const f=A.foot,c=A.com,inX=c.x>=f.x0-.5&&c.x<=f.x1+.5,inZ=c.z>=f.z0-.5&&c.z<=f.z1+.5;
    if(inX&&inZ)return r(true,`It stands steady: its weight (${kg(A.mass)}) sits right over what it stands on.`,`Everything has a centre of weight — the point it balances on. If that point is above the part touching the ground, gravity presses it straight down and it stays up. That's why wide bases are steady.`);
    return r(false,`It tips over: its centre of weight is outside the part that touches the ground.`,"",`Gravity pulls on an object's centre of weight. When that point is not above what the object stands on, gravity turns it over that edge — like leaning too far back on a chair. A wider base, or weight lower down and nearer the middle, keeps it standing.`,{tip:true});}
  case "container":{if(!C)return r(false,"There's nothing that can hold water — no hollow part.","","To hold a liquid you need a hollow shape: walls all the way round and a closed bottom. A solid block has no room inside, and flat parts let it run off.",{water:"none"});
    if(C.open)return r(false,`The ${C.a.p.name||"tube"} has no bottom — the water runs straight out.`,"","Water flows downwards and out of any gap. A container needs a closed bottom as well as walls — without it, it's just a pipe.",{water:"through",ca:C.a});
    if(C.flip||C.tilt)return r(false,`The ${C.a.p.name||"tube"} is ${C.flip?"upside down":"on its side"} — its open end isn't at the top.`,"","A container only holds liquid with its opening at the top: water always settles at the lowest point and pours out of an opening that faces sideways or down.",{water:"spill",ca:C.a});
    const cap=C.cap;if(cap<nd.min)return r(false,`It holds ${ml(cap)} — that's not enough; it needs at least ${ml(nd.min)}.`,"",`How much a container holds is the space inside: the area of the opening (π × inside radius²) times the inside height. Here that's ${ml(cap)}. A little wider or taller inside makes it hold a lot more — doubling the width holds four times as much.`,{water:"fill",ca:C.a,level:1});
    if(nd.max&&cap>nd.max)return r(false,`It holds ${ml(cap)} — much too big for this; it should hold at most ${ml(nd.max)}.`,"",`The space inside is π × inside radius² × inside height = ${ml(cap)}. Something this big is too heavy to lift when it's full: every litre of water weighs a kilogram.`,{water:"fill",ca:C.a,level:1});
    return r(true,`It holds ${ml(cap)} of water.`,`The space inside is π × (inside radius)² × (inside height) = ${ml(cap)}. The walls and the closed bottom keep the water in, because water always flows down and out through any gap — and there isn't one.`,"",{water:"fill",ca:C.a,level:1});}
  case "handle":{const base=C?C.a:null;const others=A.P.filter(a=>a!==base);
    const h=others.find(a=>A.touch(a,base||A.P[0])&&(a.p.shape==="torus"||a.p.shape==="box"||a.p.shape==="cylinder")&&(!base||Math.hypot(a.box.getCenter(new THREE.Vector3()).x-base.box.getCenter(new THREE.Vector3()).x,a.box.getCenter(new THREE.Vector3()).z-base.box.getCenter(new THREE.Vector3()).z)>(base.p.r||0)*.8||a.box.min.y>base.box.max.y-1||a.box.max.y>base.box.max.y+3));   // beside it, or arching over the top (a bucket's handle)
    if(nd.any){const any=A.P.length>1;return any?r(true,"It has something to hold it by.","A handle sticks out so your hand can grip it. It also keeps your fingers away from what's inside or what's hot, and gives you leverage to pull or lift."):r(false,"There's nothing to hold it by.","","Without a handle there's nothing your fingers can close around — you'd have to grab flat or hot surfaces, and it slips.");}
    if(h)return r(true,`It has a handle (${h.p.name||SNAME[h.p.shape].toLowerCase()}) on the ${base&&(h.box.min.y>=base.box.max.y-1||h.box.max.y>base.box.max.y+3)?"top":"side"}.`,"A handle sticks out so your fingers can wrap round it. The air gap keeps your hand away from the hot sides — air doesn't carry heat well — and it lets you tip the container to pour.");
    return r(false,"There's no handle — you'd have to hold it by its sides.","","Hot drinks heat the walls of the cup, and heat flows into your fingers. A handle sticks out from the side, so you hold something that stays cool, and you can tip it to pour.");}
  case "wide":{if(!C||!C.a)return r(false,"There's no bowl shape to measure.","","A bowl is a container that is wider than it is tall, so you can reach in with a spoon.");const w=C.a.p.r*2,h=C.a.p.h;
    return w>h?r(true,`It's ${cm(w)} wide and ${cm(h)} tall — wider than tall, easy to reach into.`,"A bowl is wider than it is tall: a spoon can reach every corner, and food spreads out so it cools down faster."):r(false,`It's ${cm(w)} wide but ${cm(h)} tall — that's a cup or a jar, not a bowl.`,"","A bowl is wider than it is tall so a spoon can reach the bottom. A tall, narrow container is a cup or a vase.");}
  case "tall":{const h=A.box.max.y-A.box.min.y;return h>=nd.min?r(true,`It's ${cm(h)} tall.`,"Tall stems need a tall container to lean on: the sides hold the flowers up."):r(false,`It's only ${cm(h)} tall — flowers would flop over; it needs at least ${cm(nd.min)}.`,"","Long stems tip over unless the sides of the vase come up far enough to hold them. Taller sides support more of the stem.");}
  case "plate":{const flat=A.P.find(a=>(a.p.shape==="cylinder"||a.p.shape==="box")&&upright(a)&&(a.box.max.y-a.box.min.y)<=4&&Math.min(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=18);
    return flat?r(true,`It's a flat plate ${cm(Math.max(flat.box.max.x-flat.box.min.x,flat.box.max.z-flat.box.min.z))} across.`,"A plate is wide and thin: food lies flat on it, and it's light enough to carry. Thin but wide shapes are stiff enough when the load is small and spread out."):r(false,"There's no thin flat part at least 18 cm across to put food on.","","A plate needs a wide, flat top (about 18 cm or more across) that's thin enough to be light. A tall block is heavy and food rolls off a round ball.");}
  case "surface":{const s=surfaceOf(A,nd);if(!s)return r(false,`There's no flat ${nd.what} to ${nd.what==="top"?"put things on":nd.what==="bed"?"lie on":"sit on"}.`,"",`A ${nd.what} has to be a flat, level part, the right height off the ground, big enough for the body that uses it.`);
    const bad=[];if(s.top<nd.hMin||s.top>nd.hMax)bad.push(`its top is ${cm(s.top)} off the ground (it should be ${nd.hMin}–${nd.hMax} cm)`);if(s.big<Math.max(nd.w,nd.d)||s.small<Math.min(nd.w,nd.d))bad.push(`it's ${cm(s.big)} × ${cm(s.small)} (it needs at least ${Math.max(nd.w,nd.d)} × ${Math.min(nd.w,nd.d)} cm)`);
    if(s.thick<1.5)bad.push(`it's only ${s.thick.toFixed(1)} cm thick — it would bend and snap`);A.surf=s;
    if(!bad.length)return r(true,`The ${nd.what} is ${cm(s.top)} off the ground and ${cm(s.big)} × ${cm(s.small)}.`,`Furniture is sized for people: a seat about 45 cm high lets your feet rest flat on the floor with your knees bent at a right angle; a table at about 75 cm is at elbow height when you sit; a bed is long enough for a grown-up (about 180 cm).`,"",{surf:s});
    return r(false,`The ${nd.what}: ${bad.join("; ")}.`,"",`Furniture has to fit the body: a seat about 40–50 cm high lets your feet touch the floor; a table top is about 70–75 cm so it's at elbow height; a bed must be longer than the person. Sizes come from measuring people — that's called ergonomics.`,{surf:s});}
  case "back":{const s=A.surf||surfaceOf(A,{hMin:0,hMax:999,w:0,d:0});if(!s)return r(false,"There's no seat for a back to go on.","","A back rests against the seat's edge and rises above it so you can lean.");
    const b=A.P.find(a=>a!==s.a&&A.touch(a,s.a)&&a.box.max.y>=s.top+nd.min);
    return b?r(true,`It has a back reaching ${cm(b.box.max.y-s.top)} above the seat.`,"A backrest takes some of your weight when you lean back, so your back muscles can relax. It works because it's joined to the seat and the seat's legs carry the push."):r(false,`There's no back: nothing joined to the seat rises ${nd.min} cm or more above it.`,"","Without a back you have to hold yourself up with your own muscles. A chair's back is a part fixed to the seat that rises above it — that's what makes a chair different from a stool.");}
  case "holds":{const s=A.surf||surfaceOf(A,{hMin:0,hMax:999,w:0,d:0});if(!s)return r(false,`There's nothing for the ${kg(nd.kg)} to rest on.`,"","Weight has to be carried by a surface and passed down to the ground.",{load:nd.kg});
    const S=supportsOf(A,s.a);if(!S.legs.length)return r(false,"Nothing carries the weight down to the ground — the top isn't held up by anything.","","Weight travels down through the parts: from the top into legs or sides and into the ground. If no part joins the top to the ground, there's no path for the weight to go.",{load:nd.kg,breaks:true});
    const safe=S.cap,need=nd.kg*2;
    if(safe>=need)return r(true,`${S.legs.length} support${S.legs.length>1?"s":""} carry the weight down to the ground. Together they can hold about ${kg(safe)}; the job is ${kg(nd.kg)}.`,`Each leg is pushed on from above (that's called compression). How much a leg can carry depends on how thick it is and what it's made of — a 5 × 5 cm wooden leg can carry over 700 kg straight down. Long thin legs bend sideways (buckle) much sooner, so thick, short legs are strongest.`,"",{load:nd.kg});
    return r(false,`The supports can hold about ${kg(safe/2)} safely, but it has to carry ${kg(nd.kg)} — it breaks.`,"",`Each leg is squeezed by the weight above (compression). A leg's strength grows with its cross-section — the area you'd see if you cut it — and with the material (metal is about ten times stronger than wood). Long, thin legs also bend sideways (buckle). Thicker legs, more legs, shorter legs or a stronger material carry more.`,{load:nd.kg,breaks:true});}
  case "soft":{const s=A.surf;const soft=s&&A.P.find(a=>a.p.mat==="fabric"&&a.box.min.y>=s.top-2&&A.touch(a,s.a));
    return soft?r(true,`There's a soft ${soft.p.name||"mattress"} on top.`,"A mattress spreads your weight over a big area, so no single spot of your body presses hard. Soft materials squash to fit your shape — that's why they feel comfortable."):r(false,"There's nothing soft to lie on — just the hard frame.","","Lying on a hard board, your weight presses on a few small spots (hips, shoulders) and it hurts. A soft mattress (cloth) squashes to fit your shape and spreads the weight out.");}
  case "shelves":{const sh=A.P.filter(a=>a.p.shape==="box"&&upright(a)&&(a.box.max.y-a.box.min.y)<=6&&Math.max(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=nd.w).sort((a,b)=>a.box.max.y-b.box.max.y);
    const lv=[];sh.forEach(a=>{if(!lv.length||a.box.max.y-lv[lv.length-1].box.max.y>=20)lv.push(a);});const held=lv.filter(a=>a.nb.length>0);
    if(held.length>=nd.n)return r(true,`It has ${held.length} shelves, each at least ${nd.w} cm wide, with room for books between them.`,"Each shelf is a flat board held at its ends by the sides. Books are heavy, so the boards rest on the sides and pass the weight down to the floor.");
    return r(false,`It has ${held.length} shelf${held.length===1?"":"s"} you could use (it needs ${nd.n}, each at least ${nd.w} cm wide and 20 cm apart so books fit).`,"","A shelf is a flat board, wide enough for a row of books and joined at its ends to the sides. Shelves need space between them taller than a book (about 20–30 cm).");}
  case "ladder":{const rails=A.P.filter(a=>a.ground&&(a.box.max.y-a.box.min.y)>=nd.h&&Math.min(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)<20);
    const rungs=A.P.filter(a=>!rails.includes(a)&&rails.filter(rl=>A.touch(a,rl)).length>=2).sort((a,b)=>a.box.min.y-b.box.min.y);
    if(rails.length<2)return r(false,`It needs two long side rails at least ${cm(nd.h)} tall standing on the ground — it has ${rails.length}.`,"","A ladder has two long side rails and rungs between them. Both rails carry the climber's weight down to the ground.");
    const gaps=rungs.slice(1).map((a,i)=>a.box.min.y-rungs[i].box.min.y),badGap=gaps.find(g=>g<20||g>40);
    if(rungs.length<nd.rungs)return r(false,`Only ${rungs.length} rung${rungs.length===1?"":"s"} join both rails (it needs at least ${nd.rungs}).`,"","Rungs are the steps: each must reach from one rail to the other so both rails share the weight. About every 30 cm is a comfortable step.");
    if(badGap!==undefined)return r(false,`Some rungs are ${cm(badGap)} apart — steps should be 20–40 cm apart.`,"","People can lift a foot comfortably about 30 cm. Rungs much further apart are too hard to climb; very close ones waste wood.");
    return r(true,`Two rails ${cm(Math.min(...rails.map(a=>a.box.max.y-a.box.min.y)))} tall with ${rungs.length} rungs about ${cm(gaps.reduce((s,g)=>s+g,0)/Math.max(1,gaps.length))} apart.`,"Each rung passes the climber's weight to both rails, and the rails carry it to the ground. Even steps about 30 cm apart match how high people lift their feet.");}
  case "room":{const B=A.box,floorY=Math.max(0,B.min.y),mid=floorY+Math.min(nd.head*.5,100);const g=grid(A,mid);
    if(g.area<nd.area*.25){const solid=A.P.some(a=>a.p.shape==="box"&&(a.box.max.x-a.box.min.x)*(a.box.max.z-a.box.min.z)>=nd.area*.5&&a.box.min.y<=mid&&a.box.max.y>=mid);
      return r(false,solid?"There's no room inside: the walls are one solid block all the way through.":`There's no closed-in room: at ${cm(mid)} high the walls don't go all the way round.`,"",solid?"A building is a shell: walls around an empty space. A solid block has no inside at all — you can only stand on top of it. (Pick the block and press “Make hollow” — like Fusion's Shell command — or start from a Hollow box.)":"To make a room, walls must join up all the way round, leaving empty space in the middle. Any gap (other than the door) lets the wind and rain in.",{rain:"in"});}
    const head=grid(A,floorY+nd.head-5);const tall=head.area>=g.area*.6;const pt=new THREE.Vector3(),roofCells=g.cells.filter(([x,z])=>A.P.some(a=>{if(x<a.box.min.x||x>a.box.max.x||z<a.box.min.z||z>a.box.max.z||a.box.max.y<floorY+nd.head*.7)return false;for(let y=Math.max(a.box.min.y,floorY+nd.head*.7);y<=a.box.max.y+.5;y+=Math.max(1,(a.box.max.y-a.box.min.y)/24)){pt.set(x,y,z);if(inside(a,pt,.5))return true;}return false;})).length;
    const roofOk=roofCells>=g.cells.length*.9;const open=grid(A,floorY+Math.min(nd.door.h*.5,90),{doorsOpen:true});const doorWorks=open.area<g.area*.6;
    const doors=A.P.filter(a=>a.p.mat==="door");const bigDoor=doors.find(a=>(a.box.max.y-a.box.min.y)>=nd.door.h&&Math.max(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=nd.door.w);
    const facts=[`The room inside is ${(g.area/10000).toFixed(g.area<10000?2:1)} m²`];const fails=[];
    if(g.area<nd.area)fails.push(`that's too small (it needs ${(nd.area/10000).toFixed(nd.area<10000?2:1)} m²)`);
    if(!tall)fails.push(`there isn't ${cm(nd.head)} of headroom inside`);
    if(!roofOk)fails.push(`the roof covers only ${Math.round(roofCells/Math.max(1,g.cells.length)*100)}% of the room`);
    if(!doors.length)fails.push("there's no door (a part made of door material)");else if(!bigDoor)fails.push(`the door is too small (at least ${nd.door.w} × ${nd.door.h} cm)`);else if(!doorWorks)fails.push("the door doesn't lead into the room");
    const wins=A.P.filter(a=>a.p.mat==="window").length;
    if(!fails.length)return r(true,`${facts[0]}, there's ${cm(nd.head)} of headroom, the roof covers it, and the door opens into it${wins?` · ${wins} window${wins>1?"s":""} let light in`:""}.`,"Walls joined all the way round make a closed space that keeps the wind out. A roof over the whole room sheds rain off its slope, and the door is a gap in the wall that you can close.",""+"",{rain:"out"});
    return r(false,`${facts[0]}, but ${fails.join("; ")}.`,"","A home must keep weather out and let people in: walls closed all round, a roof over every part of the room (rain falls straight down, and wind blows it sideways), enough height to stand, and a door that opens into the room.",{rain:roofOk?"out":"in"});}
  case "wheels":{const W=A.P.filter(a=>(a.p.shape==="cylinder"||a.p.shape==="torus")&&(a.p.shape==="torus"?Math.abs(a.up.z)>.9||Math.abs(a.up.x)>.9:lying(a))&&a.box.min.y<=2&&a.nb.length>0);
    if(W.length<nd.n)return r(false,`${W.length} wheel${W.length===1?"":"s"} touch the ground and are attached (it needs ${nd.n}).`,"",`A wheel is a disc turned on its edge, joined to the body by an axle, that rolls along the ground. Wheels only help if they actually touch the ground and are attached — and you need ${nd.n} to keep it level.`,{roll:false});
    if(nd.span){const xs=W.map(a=>a.box.getCenter(new THREE.Vector3())),sx=Math.max(...xs.map(v=>v.x))-Math.min(...xs.map(v=>v.x)),sz=Math.max(...xs.map(v=>v.z))-Math.min(...xs.map(v=>v.z));
      if(Math.max(sx,sz)<nd.span)return r(false,`The wheels are only ${cm(Math.max(sx,sz))} apart front to back — it would rock and tip (cars need about ${cm(nd.span)} or more).`,"","Wheels far apart (front to back and side to side) make a big rectangle under the car, so its weight stays inside and it doesn't tip when it brakes or turns.",{roll:true});}
    return r(true,`${W.length} wheel${W.length===1?"":"s"} touch the ground and turn.`,"A wheel turns sliding into rolling: only a tiny patch touches the ground, so there's much less friction than dragging. That's why one person can push a heavy load on wheels.",undefined,{roll:true});}
  case "clear":{const W=A.P.filter(a=>(a.p.shape==="cylinder"||a.p.shape==="torus")&&a.box.min.y<=2);const body=A.P.filter(a=>!W.includes(a));const low=body.length?Math.min(...body.map(a=>a.box.min.y)):0;
    return low>=nd.min?r(true,`The body rides ${cm(low)} above the ground.`,"The wheels hold the body up so it doesn't scrape: only the wheels touch the ground, so it can roll over small bumps."):r(false,`The body is only ${cm(Math.max(0,low))} above the ground — it scrapes along.`,"","If the body touches the ground it drags instead of rolling, and every bump stops it. The wheels must be big enough (or the body high enough) to leave a gap underneath.");}
  case "carBody":{const W=A.P.filter(a=>(a.p.shape==="cylinder"||a.p.shape==="torus")&&a.box.min.y<=2);const body=A.P.filter(a=>!W.includes(a));if(!body.length)return r(false,"There's no body — only wheels.","","A car needs a body to sit in and to join the wheels together.");
    const b=new THREE.Box3();body.forEach(a=>b.union(a.box));const L=Math.max(b.max.x-b.min.x,b.max.z-b.min.z),Wd=Math.min(b.max.x-b.min.x,b.max.z-b.min.z);
    return L>=nd.len&&Wd>=nd.wid?r(true,`The body is ${cm(L)} long and ${cm(Wd)} wide — room for people.`,"A car is sized for its passengers: about 2.5–4.5 m long and 1.5–1.8 m wide holds a driver and passengers sitting one behind the other."):r(false,`The body is ${cm(L)} × ${cm(Wd)} — too small for a person to sit in (at least ${nd.len} × ${nd.wid} cm).`,"","A person sitting needs about 1 m of length and 60 cm of width; a car carrying a driver and goods needs at least 2.5 m by 1.2 m.");}
  case "light":{return A.mass<=nd.kg?r(true,`It weighs ${kg(A.mass)} — light enough for an engine to move.`,"An engine can only push so much weight. Real cars weigh about 1,000–2,000 kg because their bodies are thin metal sheets around an empty inside, not solid metal."):r(false,`It weighs ${kg(A.mass)}! An engine can only move about ${kg(nd.kg)}.`,"",`Weight = volume × density. Solid metal is very heavy — 7.8 grams in every cubic centimetre. Real cars are thin metal shells with empty space inside, so they're light enough to move and to stop.`);}
  case "basin":{const b=basinOf(A);if(!b.cap)return r(false,`It can't carry a load: ${b.why}.`,"","To carry loose things — stones, hay, water — you need a floor with sides all the way round, like a tray or a tub.");
    return b.cap>=nd.min?r(true,`It can carry ${b.cap>=10?Math.round(b.cap):b.cap.toFixed(1)} litres.`,"A floor with sides all round makes a tray: the floor holds the load up and the sides stop it sliding off. Its size is floor area × height of the sides."):r(false,`It can carry only ${b.cap.toFixed(1)} litres — it needs at least ${nd.min}.`,"","What it can carry is floor area × the height of the lowest side. Higher sides or a bigger floor carry more.");}
  case "floats":{const b=basinOf(A);const push=b.cap||0;const total=A.mass+nd.kg;
    return push>=total*1.3?r(true,`It can push aside ${Math.round(push)} litres of water, which can hold up ${kg(push)}; the boat plus a ${kg(nd.kg)} rider weighs ${kg(total)} — it floats with room to spare.`,"A boat floats because it pushes water out of the way, and the water pushes back up. Every litre of water pushed aside holds up 1 kg (that's Archimedes' discovery). A hollow hull pushes aside a lot of water but weighs little, so it floats.",undefined,{float:true}):
      r(false,`It can push aside only ${Math.round(push)} litres of water (holding up ${kg(push)}), but the boat plus a ${kg(nd.kg)} rider weighs ${kg(total)} — it sinks.`,"","Water holds up 1 kg for every litre the boat pushes aside (Archimedes' principle). To float, the hollow inside must be big enough that the water it can push away weighs more than the boat and everything in it.",{float:false});}
  case "wideBoat":{const w=Math.min(A.box.max.x-A.box.min.x,A.box.max.z-A.box.min.z);return w>=nd.min?r(true,`It's ${cm(w)} wide — steady on the water.`,"A wide hull is steady: when it leans, one side sinks deeper and pushes up harder, rolling it back upright."):r(false,`It's only ${cm(w)} wide — it would roll over when you climb in.`,"","A narrow boat rolls over easily: a wide hull pushes back when it leans, so it stays upright.");}
  case "horn":{const hs=A.P.filter(a=>(a.p.shape==="cone"&&n(a.p.wall,0)>0)||(a.p.shape==="tube"&&!(n(a.p.bottom,0)>0)&&!(n(a.p.top,0)>=.5)));
    const solid=A.P.find(a=>a.p.shape==="cone"||a.p.shape==="cylinder");const L=Math.max(A.box.max.x-A.box.min.x,A.box.max.y-A.box.min.y,A.box.max.z-A.box.min.z);
    if(!hs.length)return r(false,solid?"It's solid all the way through — there's no air inside to vibrate, so it can't make a sound.":"There's no hollow tube or cone for the air to go through.","","A horn works because air inside a hollow tube vibrates when you buzz your lips at one end. A solid part has no air inside, so it stays silent. (Make the cone or cylinder hollow — and leave its ends open.)");
    if(L<nd.len)return r(false,`It's only ${cm(L)} long — too short to make a loud, low call (at least ${nd.len} cm).`,"","A longer column of air vibrates more slowly, which makes a lower, louder note that carries far. Short tubes only squeak.");
    return r(true,`It's a hollow horn ${cm(L)} long, open at the ends${hs.some(a=>a.p.shape==="cone")?", flaring wider at one end":""}.`,"When you buzz your lips into the narrow end, the air inside the tube vibrates. A longer tube makes a lower note, and a wide flared end (the bell) pushes the sound out into the air so it carries a long way — far enough for the soldiers to hear.");}
  case "storage":{const sh=A.P.filter(a=>a.p.shape==="shell"&&upright(a)&&a.up.y>0).map(a=>{const p=a.p,t=Math.min(p.wall,p.w/2,p.d/2);return {a,L:(p.w-2*t)*(p.d-2*t)*(p.h-t)/1000};}).sort((x,y)=>y.L-x.L)[0];
    if(!sh)return r(false,"There's no hollow box to keep things in.","","A chest is a hollow box: a floor and four walls around an empty space, and a lid on top. A solid block has no room inside. (Start from a Hollow box, or use Make hollow.)");
    const lid=n(sh.a.p.top,0)>=.5||A.P.some(b=>b!==sh.a&&A.touch(b,sh.a)&&b.box.min.y>=sh.a.box.max.y-2);
    if(sh.L<nd.min)return r(false,`It holds ${Math.round(sh.L)} litres — too small (it needs ${nd.min} litres).`,"","What a chest holds is the space inside: inside width × inside depth × inside height.");
    return lid?r(true,`It holds ${Math.round(sh.L)} litres, with a lid on top.`,"The walls and floor make an empty space; the lid closes it so dust and mice stay out. Inside width × depth × height gives how much it holds."):r(false,`It holds ${Math.round(sh.L)} litres but has no lid — anything inside gets dusty and wet.`,"","A chest needs a lid: a flat part resting on top of the walls (or a hollow box with its lid set to 1).");}
  case "pages":{const pg=A.P.find(a=>a.p.mat==="paper");if(!pg)return r(false,"There are no pages — nothing is made of paper.","","A book keeps words on paper: thin, light and white, so ink shows up and you can have many pages.");
    const covers=A.P.filter(a=>a!==pg&&A.touch(a,pg)&&a.p.mat!=="paper"&&(a.box.min.y>=pg.box.max.y-1||a.box.max.y<=pg.box.min.y+1));const up=covers.some(a=>a.box.min.y>=pg.box.max.y-1),dn=covers.some(a=>a.box.max.y<=pg.box.min.y+1);
    const big=Math.max(A.box.max.x-A.box.min.x,A.box.max.z-A.box.min.z);if(big>60)return r(false,`It's ${cm(big)} long — too big to carry and read.`,"","A book is made to be held in your hands.");
    return up&&dn?r(true,"It has pages with a cover above and below.","The covers are stiffer and stronger than paper, so they protect the pages from bending, tearing and getting wet."):r(false,"The pages need a cover on top and one underneath.","","Paper bends and tears easily. Covers made of something stronger on both sides protect it.");}
  case "bulb":{const b=A.P.find(a=>a.p.mat==="glass"&&(["sphere","dome","tube","shell"].includes(a.p.shape)));return b?r(true,"It has a hollow glass to hold the light.","Glass lets light through but not wind, so a flame inside doesn't blow out."):r(false,"There's no hollow glass part (a glass ball, dome, tube or hollow box) to hold the light.","","Light has to get out, and wind has to stay out. Glass does both — it's see-through but solid.");}
  case "magnet":{const M=A.P.filter(a=>a.p.mat==="metal");if(!M.length)return r(false,"Nothing in it is made of metal.","","Only a few materials can be magnets: iron, steel, nickel and cobalt — all metals. Wood, glass and plastic don't pull anything.");
    const rg=M.some(a=>a.p.shape==="torus");const ends=M.filter(a=>M.some(b=>b!==a&&A.touch(a,b)));
    return rg||ends.length>=3?r(true,rg?"It's a metal ring — a closed magnet.":"It's a metal bar with two arms — both ends pull together.","Inside a magnet, countless tiny magnets all point the same way. Their pulls add up at the ends, called poles. Bending it into a horseshoe or ring brings the poles close together, so the pull is stronger."):r(false,"It's one straight piece of metal — its pull is too weak to bring things to you.","","A magnet pulls most at its two ends (poles). In a straight bar they're far apart; bent into a horseshoe (a bar and two arms) or a ring, both ends work together.");}
  case "steps":{const st=A.P.filter(a=>a.p.shape==="stairs");let ok=null;for(const a of st){const k=Math.round(n(a.p.steps,12)),rise=a.p.h/k,run=a.p.d/k;if(a.box.min.y<=2&&k>=nd.n&&rise<=30&&run>=15&&a.p.w>=50)ok={k,rise,run};else ok=ok||{bad:1,k,rise,run,w:a.p.w};}
    const bx=A.P.filter(a=>a.p.shape==="box").sort((a,b)=>a.box.max.y-b.box.max.y);const g=bx.map(a=>a.box.max.y);const boxOk=bx.length>=nd.n&&g[0]<=30&&g.every((y,i)=>!i||y-g[i-1]<=30&&y-g[i-1]>=5);
    if(ok&&!ok.bad)return r(true,`${ok.k} steps, each ${cm(ok.rise)} high and ${cm(ok.run)} deep.`,"Stairs turn one big climb into many small ones. Each step lifts you about 18–25 cm — less effort at a time — and every step is the same, so your feet know where the next one is.");
    if(boxOk)return r(true,`${bx.length} steps going up evenly.`,"Stairs turn one big climb into many small ones, each about the same height.");
    if(ok)return r(false,`The steps are ${cm(ok.rise)} high, ${cm(ok.run)} deep and ${cm(ok.w)} wide.`,"","A step you can climb is at most about 30 cm high, at least 15 cm deep (room for your foot) and 50 cm wide, and the lowest one starts at the ground.");
    return r(false,`There aren't ${nd.n} steps to climb.`,"","Stairs need several steps, each a little higher than the one before (at most 30 cm).");}
  case "crystal":{const c=A.P.find(a=>a.p.mat==="glass"&&a.p.shape==="cone"&&upright(a)&&a.up.y>0&&a.p.h>=25);return c?r(true,`It has a pointed glass crystal ${cm(c.p.h)} tall.`,"Real crystals grow in points because their atoms stack in the same pattern again and again."):r(false,"There's no tall glass point (a glass cone at least 25 cm tall, pointing up).","","Crystals are clear and pointed: the same pattern of atoms repeated over and over makes flat sides that meet in a point.");}
  case "screen":{const sc=A.P.find(a=>(a.p.mat==="glass"||a.p.mat==="window")&&a.p.shape==="box"&&(a.box.max.y-a.box.min.y)>=12&&Math.max(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=20&&Math.min(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)<=10);
    const ky=A.P.find(a=>a!==sc&&a.p.shape==="box"&&(a.box.max.y-a.box.min.y)<=8&&Math.max(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=18);
    if(!sc)return r(false,"There's no screen (a thin, upright glass board).","","A computer shows you things on a screen: a thin sheet of glass with millions of tiny lights behind it.");if(!ky)return r(false,"There's nothing to type on (a flat board of keys).","","You tell a computer what to do by pressing keys: a flat board your fingers can reach.");
    return r(true,"It has a screen to look at and keys to type on.","The keys are the input: they send your presses in. The screen is the output: it shows what the computer worked out.");}
  case "arch":{const rg=A.P.find(a=>a.p.shape==="torus"&&Math.abs(a.up.y)>.9&&(a.p.R-a.p.t/2)*2>=180);if(rg)return r(true,`It's a ring ${cm((rg.p.R-rg.p.t/2)*2)} wide inside — big enough to walk through.`,"A ring has no corners, so its weight is shared all the way round — like an arch.");
    const posts=A.P.filter(a=>a.ground&&(a.box.max.y-a.box.min.y)>=180);for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){const a=posts[i].box,b=posts[j].box,gx=Math.max(a.min.x,b.min.x)-Math.min(a.max.x,b.max.x),gz=Math.max(a.min.z,b.min.z)-Math.min(a.max.z,b.max.z),gap=Math.max(gx,gz);if(gap<70)continue;
        const beam=A.P.find(c=>c!==posts[i]&&c!==posts[j]&&A.touch(c,posts[i])&&A.touch(c,posts[j])&&c.box.min.y>=175);if(beam)return r(true,`It's a gate: the opening is ${cm(gap)} wide and ${cm(beam.box.min.y)} high.`,"The beam rests on both posts; the posts carry its weight straight down to the ground.");}
    return r(false,"There's no opening to walk through: it needs two tall posts and a beam across them (or a big upright ring).","","To walk through, the opening has to be about 70 cm wide and 180 cm high — the size of a person.");}
  case "doorLeaf":{const d=A.P.find(a=>a.p.shape==="box"&&(a.box.max.y-a.box.min.y)>=190&&Math.max(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=75&&Math.min(a.box.max.x-a.box.min.x,a.box.max.z-a.box.min.z)>=2.5);
    return d?r(true,`The door is ${cm(d.box.max.y-d.box.min.y)} tall and ${cm(Math.max(d.box.max.x-d.box.min.x,d.box.max.z-d.box.min.z))} wide.`,"A door is sized for people: about 2 m tall and 80–90 cm wide so a grown-up walks through without ducking, and thick enough (3–5 cm) not to bend."):r(false,"There's no door-sized board: it should be at least 190 cm tall, 75 cm wide and 2.5 cm thick.","","Doorways are made for people: most grown-ups are under 1.9 m tall and need about 75 cm of width to walk through. A thin board bends and cracks when you slam it.");}
  }
  return r(true,"","");}
function test(id,parts){const it=ITEMS[id],A=analyse(parts);if(!parts.length)return {ok:false,res:[{ok:false,fact:"There's nothing on the workbench yet.",whyFail:"Start with a part — or tell the helper what to make."}],A};
  const res=it.needs.map(nd=>check(nd,A,it));return {ok:res.every(x=>x.ok),res,A};}
// ---- the screen ----
let S=null;   // the open workbench
const CSS=`#bench{position:fixed;inset:0;z-index:50;background:#15161a;color:#eef;display:flex;font:14px system-ui,sans-serif}
#bench.hidden{display:none}#bench .view{flex:1;position:relative;min-width:0}#bench canvas{width:100%;height:100%;display:block;touch-action:none}
#bench .side{width:390px;max-width:48vw;overflow:auto;background:#1e2026;border-left:1px solid #333;padding:12px 14px}
#bench h2{margin:0 0 4px;font-size:19px}#bench .chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;margin-left:6px}
#bench .chip.e{background:#2f8a4f}#bench .chip.m{background:#c98a2b}#bench .chip.h{background:#b5392b}
#bench .need{margin:6px 0 10px;padding:8px 10px;background:#272a32;border-radius:10px;font-size:13px;line-height:1.4}
#bench .ai{display:flex;gap:6px;margin:8px 0}#bench .ai input{flex:1;padding:9px 10px;border-radius:10px;border:1px solid #444;background:#111;color:#fff;font-size:14px}
#bench button{margin:0;padding:7px 11px;border-radius:9px;border:1px solid #444;background:#2b2e36;color:#fff;font-size:13px;cursor:pointer}#bench button.go{background:#e8b84a;color:#222;border-color:#e8b84a;font-weight:700}
#bench button:disabled{opacity:.45;cursor:default}#bench .row{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}
#bench .parts{list-style:none;margin:6px 0;padding:0}#bench .parts li{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;cursor:pointer}#bench .parts li.on{background:#3a3f4c}
#bench .parts .sw{width:12px;height:12px;border-radius:3px;flex:none}#bench .ed{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0}
#bench .ed label{font-size:11px;color:#aab}#bench .ed input,#bench .ed select{width:100%;box-sizing:border-box;padding:5px;border-radius:7px;border:1px solid #444;background:#111;color:#fff}
#bench .note{font-size:12.5px;color:#bcd;min-height:16px}#bench .rep{margin-top:8px}#bench .rep p{margin:5px 0;line-height:1.4}#bench .rep .y{color:#8fe39a}#bench .rep .n{color:#ff9a8a}
#bench .tutor{background:#262b3a;border-radius:10px;padding:8px 10px;margin-top:6px;line-height:1.45}#bench .top{position:absolute;left:10px;top:10px;display:flex;gap:6px;flex-wrap:wrap}
#bench .lab{position:absolute;left:10px;bottom:10px;background:rgba(0,0,0,.55);padding:6px 10px;border-radius:8px;font-size:12.5px;max-width:70%}
#bench .wiki{background:#20252e;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:13px;line-height:1.45;max-height:340px;overflow:auto}#bench .wiki a{color:#9fd3ff}
#bench .list button{display:block;width:100%;text-align:left;margin:4px 0}
@media (max-width:760px){#bench{flex-direction:column}#bench .side{width:auto;max-width:none;height:52vh;border-left:0;border-top:1px solid #333}}`;
function ensureDom(){if($("#bench"))return;const st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  const d=document.createElement("div");d.id="bench";d.className="hidden";d.innerHTML=`<div class="view"><canvas id="bcv"></canvas><div class="top"><button id="bClose">✕ Close</button><button id="bView">⟲ Reset view</button></div><div class="lab" id="bLab">Drag to turn · scroll or pinch to zoom · click a part to pick it</div></div><div class="side" id="bSide"></div>`;
  document.body.appendChild(d);$("#bClose").onclick=close;$("#bView").onclick=()=>{fit();};setupView();}
let R,SC,CAM,ROOT,TEST=null,orbit={yaw:.7,pitch:.45,dist:100,tx:0,ty:0,tz:0},drag=null;
function setupView(){const cv=$("#bcv");R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,devicePixelRatio||1));SC=new THREE.Scene();SC.background=new THREE.Color(0x1b1d23);
  CAM=new THREE.PerspectiveCamera(40,1,1,50000);SC.add(new THREE.HemisphereLight(0xffffff,0x445566,1.1));const sun=new THREE.DirectionalLight(0xffffff,.9);sun.position.set(300,600,400);SC.add(sun);
  ROOT=new THREE.Group();SC.add(ROOT);
  cv.addEventListener("pointerdown",e=>{drag={x:e.clientX,y:e.clientY,moved:0,id:e.pointerId};cv.setPointerCapture(e.pointerId);});
  cv.addEventListener("pointermove",e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;orbit.yaw-=dx*.008;orbit.pitch=Math.max(-.2,Math.min(1.45,orbit.pitch+dy*.006));});
  cv.addEventListener("pointerup",e=>{if(drag&&drag.moved<6)pickAt(e);drag=null;});
  cv.addEventListener("wheel",e=>{e.preventDefault();orbit.dist*=Math.exp(e.deltaY*.0012);},{passive:false});
  let pinch=0;cv.addEventListener("touchmove",e=>{if(e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);if(pinch)orbit.dist*=pinch/d;pinch=d;}},{passive:true});cv.addEventListener("touchend",()=>{pinch=0;});
  const loop=()=>{requestAnimationFrame(loop);if(!S)return;const w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==Math.floor(w*R.getPixelRatio())||cv.height!==Math.floor(h*R.getPixelRatio())){R.setSize(w,h,false);CAM.aspect=w/Math.max(1,h);CAM.updateProjectionMatrix();}
    const o=orbit;CAM.position.set(o.tx+o.dist*Math.cos(o.pitch)*Math.sin(o.yaw),o.ty+o.dist*Math.sin(o.pitch),o.tz+o.dist*Math.cos(o.pitch)*Math.cos(o.yaw));CAM.lookAt(o.tx,o.ty,o.tz);
    if(TEST)stepTest();R.render(SC,CAM);};loop();}
function pickAt(e){const cv=$("#bcv"),r=cv.getBoundingClientRect();const v=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const rc=new THREE.Raycaster();rc.setFromCamera(v,CAM);
  const hit=rc.intersectObjects(ROOT.children,true).find(h=>h.object.userData.part);S.sel=hit?S.parts.indexOf(hit.object.userData.part):-1;side();}
function draw(){ROOT.clear();if(!S)return;const ext=Math.max(60,...S.parts.map(p=>Math.max(Math.abs(n(p.x,0))+60,Math.abs(n(p.z,0))+60)));
  const g=new THREE.GridHelper(Math.ceil(ext/50)*100,Math.ceil(ext/50)*10,0x556070,0x30343c);ROOT.add(g);
  S.parts.forEach((p,i)=>{const m=meshOf(p);if(i===S.sel){if(m.isGroup){m.material=m.material.clone();m.material.emissive=new THREE.Color(0x4a3a10);m.children.forEach(c=>{c.material=m.material;});}else m.material.emissive=new THREE.Color(0x4a3a10);}ROOT.add(m);if(i===S.sel){const bh=new THREE.BoxHelper(m,0xffd36a);ROOT.add(bh);}});}
function fit(){const b=new THREE.Box3();S.parts.forEach(p=>b.union(new THREE.Box3().setFromObject(meshOf(p))));if(b.isEmpty())b.set(new THREE.Vector3(-20,0,-20),new THREE.Vector3(20,30,20));
  const c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3());orbit.tx=c.x;orbit.ty=c.y;orbit.tz=c.z;orbit.dist=Math.max(40,Math.max(s.x,s.y,s.z)*2.2);}
// ---- the testing area: the test acted out in the view ----
function startTest(rep){const A=rep.A;TEST={t:0,rep,objs:[],A};const add=o=>{ROOT.add(o);TEST.objs.push(o);return o;};
  const find=k=>rep.res.find(x=>x.k===k&&x.fact);const ct=find("container"),hd=find("holds"),rm=find("room"),wh=find("wheels"),fl=find("floats"),st=find("stands");
  if(ct&&ct.ca){const a=ct.ca,p=a.p,ir=Math.max(.5,p.r-(p.wall||1));if(ct.water==="fill"){const w=add(new THREE.Mesh(new THREE.CylinderGeometry(ir*.98,ir*.98,1,24),new THREE.MeshLambertMaterial({color:0x3a8cff,transparent:true,opacity:.75})));w.position.copy(a.m.position);TEST.water={m:w,a,ir,h:p.h-(p.bottom||0)};}
    else TEST.drip={a,ir};}
  if(hd){const s=A.surf;const top=s?s.top:A.box.max.y,c=s?s.a.box.getCenter(new THREE.Vector3()):A.box.getCenter(new THREE.Vector3());const sz=Math.max(12,Math.min(40,(s?s.small:40)*.6));
    const w=add(new THREE.Mesh(new THREE.BoxGeometry(sz,sz,sz),new THREE.MeshLambertMaterial({color:hd.ok?0x8a7a5a:0xb5392b})));w.position.set(c.x,top+sz/2+120,c.z);TEST.weight={m:w,top,sz,ok:hd.ok,legs:s?supportsOf(A,s.a).legs:[]};}
  if(rm){TEST.rain={drops:[],ok:rm.ok};}
  if(wh){TEST.roll={ok:wh.ok};}
  if(fl){const wt=add(new THREE.Mesh(new THREE.BoxGeometry(A.box.max.x-A.box.min.x+200,1,A.box.max.z-A.box.min.z+200),new THREE.MeshLambertMaterial({color:0x2f7fd8,transparent:true,opacity:.55})));wt.position.set((A.box.min.x+A.box.max.x)/2,0,(A.box.min.z+A.box.max.z)/2);TEST.sea={m:wt,ok:fl.float};}
  if(st&&st.tip)TEST.tip=true;}
function stepTest(){const T=TEST;T.t+=1/60;const k=Math.min(1,T.t/2.4);
  if(T.water){const w=T.water;const lv=w.h*Math.min(1,k*1.1);w.m.scale.y=Math.max(.01,lv);const base=w.a.box.min.y+(w.a.p.bottom||0);w.m.position.y=base+lv/2;}
  if(T.drip&&Math.random()<.6){const a=T.drip.a;const d=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.4,a.p.r*.06),6,5),new THREE.MeshBasicMaterial({color:0x5aa8ff}));d.position.set(a.m.position.x+(Math.random()-.5)*a.p.r,a.box.max.y+5,a.m.position.z+(Math.random()-.5)*a.p.r);d.userData.v=0;ROOT.add(d);T.objs.push(d);}
  T.objs.forEach(o=>{if(o.userData.v!==undefined){o.userData.v+=.4;o.position.y-=o.userData.v*.1;if(o.position.y<-30)o.visible=false;}});
  if(T.weight){const w=T.weight;const y=Math.max(w.top+w.sz/2,w.m.position.y-(T.t*T.t*60));w.m.position.y=y;if(y<=w.top+w.sz/2+.1&&!w.hit){w.hit=true;if(!w.ok){ROOT.children.forEach(m=>{if(m.userData.part&&w.legs.some(l=>l.p===m.userData.part)){m.material.color.set(0xff5544);m.scale.y=.4;}});}}}
  if(T.rain){const R2=T.rain,B=T.A.box;if(T.t<3)for(let i=0;i<6;i++){const d=new THREE.Mesh(new THREE.BoxGeometry(1.2,14,1.2),new THREE.MeshBasicMaterial({color:0x9fd3ff}));d.position.set(B.min.x+Math.random()*(B.max.x-B.min.x),B.max.y+120,B.min.z+Math.random()*(B.max.z-B.min.z));d.userData.v=0;ROOT.add(d);T.objs.push(d);
      const ray=new THREE.Raycaster(d.position.clone(),new THREE.Vector3(0,-1,0));const hits=ray.intersectObjects(ROOT.children.filter(m=>m.userData.part),true);d.userData.stop=hits.length?hits[0].point.y:0;}
    T.objs.forEach(o=>{if(o.userData.stop!==undefined&&o.position.y<=o.userData.stop)o.visible=false;});}
  if(T.roll){const dz=T.roll.ok?Math.sin(T.t*1.4)*60:Math.sin(T.t*1.4)*6;ROOT.children.forEach(m=>{if(m.userData.part){if(m.userData.z0===undefined)m.userData.z0=m.position.z;m.position.z=m.userData.z0+dz;}});}
  if(T.sea){const s=T.sea;const sink=s.ok?0:Math.min(1,T.t/2.5);ROOT.children.forEach(m=>{if(m.userData.part){if(m.userData.y0===undefined)m.userData.y0=m.position.y;m.position.y=m.userData.y0-(s.ok?3+Math.sin(T.t*2)*2:sink*(T.A.box.max.y+30));}});s.m.position.y=Math.min(T.A.box.max.y*.35,T.t*20);}
  if(T.tip){const ang=Math.min(1.2,T.t*T.t*.5);ROOT.children.forEach(m=>{if(m.userData.part){if(!m.userData.p0){m.userData.p0=m.position.clone();m.userData.r0=m.rotation.z;}const p0=m.userData.p0,pv=new THREE.Vector3(T.A.foot?T.A.foot.x1:0,0,0);const v=p0.clone().sub(pv);v.applyAxisAngle(new THREE.Vector3(0,0,1),-ang);m.position.copy(pv.add(v));m.rotation.z=m.userData.r0-ang;}});}
  if(T.t>6){TEST=null;draw();}}
// ---- the side panel ----
function side(){if(!S)return;const it=ITEMS[S.id],L=LV[it.level],p=S.parts[S.sel];let h="";
  if(S.choose){h+=`<h2>Workbench</h2><p class="need">What do you want to build? People's orders come first; you can also build anything for yourself.</p><div class="list">`;
    (S.orders||[]).forEach((o,i)=>{const I=ITEMS[o.item];h+=`<button data-order="${i}">${I.icon} <b>${esc(I.name)}</b> for ${esc(o.who)} <span class="chip ${LV[I.level].cls}">${LV[I.level].name}</span><br><small>${esc(o.text)}</small></button>`;});
    h+=`<button data-free="invention" style="background:#3a2f5a;border-color:#8a6ad8">✨ <b>Experiment</b><br><small>Make anything you like — then bring it to life, and it turns into something that does a thing.</small></button>`;h+=`<h3 style="margin:12px 0 4px">Build for yourself</h3>`;ORDER.forEach(k=>{const I=ITEMS[k];h+=`<button data-free="${k}">${I.icon} ${esc(I.name[0].toUpperCase()+I.name.slice(1))} <span class="chip ${LV[I.level].cls}">${LV[I.level].name}</span></button>`;});
    $("#bSide").innerHTML=h+`</div>`;return;}
  h+=`<button id="bBack" style="float:right">☰ Orders</button><h2>${it.icon} ${esc(it.name[0].toUpperCase()+it.name.slice(1))}<span class="chip ${L.cls}">${L.name}</span></h2>`;
  h+=it.free?`<div class="need"><b>Experiment.</b> Make anything you like. When you bring it to life, the game looks at what you made and turns it into something that does a thing.</div>`:S.who?`<div class="need"><b>${esc(S.who)}:</b> “${esc(S.text)}”<br><small>Pays ${S.pay||L.pay} denarii.</small></div>`:`<div class="need"><b>Building for yourself.</b> People who need one say: “${esc(it.ask)}”</div>`;
  h+=`<div class="ai"><input id="bSay" placeholder="Tell the helper one part: “add a handle on the right”, “make the walls 3 m tall”…" maxlength="240"><button class="go" id="bAsk">Build</button></div><div class="note" id="bNote">${esc(S.note||"")}</div>`;
  h+=`<div class="row">${Object.keys(SHAPES).map(s=>`<button data-add="${s}">+ ${SNAME[s]}</button>`).join("")}</div>`;
  h+=`<ul class="parts">${S.parts.map((q,i)=>`<li data-sel="${i}" class="${i===S.sel?"on":""}"><span class="sw" style="background:${esc(q.color||MCOL[q.mat]||"#a8743f")}"></span>${esc(q.name||SNAME[q.shape])} <small style="color:#99a">${SNAME[q.shape]} · ${MNAME[q.mat]||q.mat}</small></li>`).join("")||"<li><small>Nothing yet.</small></li>"}</ul>`;
  if(p){h+=`<div class="ed">`;[...FIELDS[p.shape],"x","y","z","rx","ry","rz"].forEach(f=>{h+=`<div><label>${FNAME[f]}${f==="steps"?"":` (${f.startsWith("r")&&f.length===2?"°":"cm"})`}</label><input type="number" step="0.5" data-f="${f}" value="${n(p[f],0)}"></div>`;});
    h+=`<div><label>material</label><select data-f="mat">${Object.keys(DENS).map(m=>`<option value="${m}" ${p.mat===m?"selected":""}>${MNAME[m]}</option>`).join("")}</select></div><div><label>colour</label><input type="color" data-f="color" value="${esc(p.color||MCOL[p.mat]||"#a8743f")}"></div><div><label>name</label><input data-f="name" value="${esc(p.name||"")}" maxlength="30"></div></div>`;
    h+=`<div class="row"><button id="bDup">Copy part</button><button id="bDel">Delete part</button>${canHollow(p)?`<button id="bHollow" title="Like Fusion's Shell command">◻ Make hollow</button>`:""}</div>`;}
  if(it.free)h+=`<div class="ai"><input id="bName" placeholder="Give it a name" maxlength="28" value="${esc(S.nm||"")}"></div><div class="row"><button class="go" id="bAlive" ${S.parts.length&&!S.busy?"":"disabled"}>✨ Bring it to life</button><button id="bNew">Start over</button></div>`;
  else h+=`<div class="row" style="margin-top:10px"><button class="go" id="bTest">🧪 Test it in the testing area</button><button id="bMake" ${S.passed?"":"disabled"}>✅ Make it</button><button id="bWiki">📖 Read about ${esc(it.name)}s</button></div>`;
  h+=`<div class="rep" id="bRep">${S.rep||""}</div><div id="bWikiBox">${S.wiki||""}</div>`;
  $("#bSide").innerHTML=h;const say=$("#bSay");if(say)say.onkeydown=e=>{e.stopPropagation();if(e.key==="Enter")askAI();};}
function onSide(e){const t=e.target.closest("button,li,[data-f]");if(!t||!S)return;
  if(t.dataset.order!==undefined){const o=S.orders[+t.dataset.order];start(o.item,o);return;}
  if(t.dataset.free){start(t.dataset.free,null);return;}
  if(t.id==="bBack"){S.choose=true;side();return;}
  if(t.dataset.add){const s=t.dataset.add,p=Object.assign({shape:s,id:Math.random().toString(36).slice(2,8),name:SNAME[s],mat:"wood",x:0,z:0},SHAPES[s]);const B=new THREE.Box3();S.parts.forEach(q=>B.union(new THREE.Box3().setFromObject(meshOf(q))));
    p.y=(s==="box"||s==="cylinder"||s==="tube"||s==="cone"||s==="shell"||s==="wedge"||s==="stairs"||s==="floor"?p.h/2:s==="sphere"?p.r:s==="dome"?p.r/2:p.R+p.t/2);if(!B.isEmpty())p.x=B.max.x+30;S.parts.push(p);S.sel=S.parts.length-1;if(Math.max(n(p.w,0),n(p.h,0),n(p.d,0),n(p.r,0)*2)>orbit.dist*.45)fit();changed();return;}
  if(t.dataset.sel!==undefined){S.sel=+t.dataset.sel;side();draw();return;}
  if(t.id==="bDel"){S.parts.splice(S.sel,1);S.sel=-1;changed();return;}
  if(t.id==="bHollow"){const p=S.parts[S.sel];if(p&&canHollow(p)){const th=v=>Math.max(.5,Math.round(v*.08*2)/2);
      if(p.shape==="box"){p.shape="shell";p.wall=th(Math.min(p.w,p.h,p.d));p.top=1;S.note=`Made hollow: walls ${p.wall} cm thick, with a lid. Set the lid to 0 to open the top.`;}
      else if(p.shape==="cylinder"){p.shape="tube";p.wall=th(p.r*2);p.bottom=p.wall;p.top=1;S.note=`Made hollow: a tube with walls ${p.wall} cm thick, a bottom and a lid. Set the lid to 0 to open the top, or the bottom to 0 to open the bottom.`;}
      else{p.wall=th(p.r*2);S.note=`Made hollow: the ${SNAME[p.shape].toLowerCase()} is now a shell ${p.wall} cm thick. Change "wall" to make it thicker or thinner.`;}}changed();return;}
  if(t.id==="bDup"){const q=Object.assign({},S.parts[S.sel],{id:Math.random().toString(36).slice(2,8)});q.x=n(q.x,0)+10;S.parts.push(q);S.sel=S.parts.length-1;changed();return;}
  if(t.id==="bAsk"){askAI();return;}
  if(t.id==="bAlive"){alive();return;}
  if(t.id==="bNew"){S.parts=[];S.sel=-1;S.nm="";changed();return;}
  if(t.id==="bTest"){runTest();return;}
  if(t.id==="bMake"){make();return;}
  if(t.id==="bWiki"){wiki();return;}}
function onEdit(e){const t=e.target;if(S&&t.id==="bName"){S.nm=t.value.slice(0,28);return;}if(!S||!t.dataset||!t.dataset.f)return;const p=S.parts[S.sel];if(!p)return;const f=t.dataset.f;
  if(f==="mat"){p.mat=t.value;delete p.color;}else if(f==="color")p.color=t.value;else if(f==="name")p.name=t.value.slice(0,30);else{const v=parseFloat(t.value);if(isFinite(v))p[f]=v;}
  S.passed=false;S.rep="";save();draw();if(e.type==="change")side();}
function canHollow(p){return p.shape==="box"||p.shape==="cylinder"||((p.shape==="sphere"||p.shape==="cone"||p.shape==="dome")&&!(n(p.wall,0)>0));}
function changed(){S.passed=false;S.rep="";save();draw();side();}
function save(){try{const all=JSON.parse(localStorage.getItem("elementum.designs")||"{}");all[S.id]=S.parts;localStorage.setItem("elementum.designs",JSON.stringify(all));}catch(e){}}
function load(id){try{return JSON.parse(localStorage.getItem("elementum.designs")||"{}")[id]||[];}catch(e){return [];}}
function askAI(){const i=$("#bSay");const say=i?i.value.trim():"";if(!say)return;S.note="The helper is building…";$("#bNote").textContent=S.note;$("#bAsk").disabled=true;
  fetch("/api/elementum/cad",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({item:ITEMS[S.id].name,parts:S.parts,say})})
    .then(r=>r.json().catch(()=>({error:"The helper isn't answering."}))).then(j=>{if(!S)return;if(j.error){S.note=j.error;}else{S.parts=j.parts||S.parts;S.note="Helper: "+(j.note||"Done.");S.sel=-1;fit();}S.passed=false;S.rep="";save();draw();side();})
    .catch(()=>{if(!S)return;S.note="The helper can't be reached right now (it works on play.hardywu.com).";side();});}
function runTest(){const rep=test(S.id,S.parts);const it=ITEMS[S.id];let h=`<h3 style="margin:6px 0">Testing area — ${rep.ok?"<span class='y'>it works!</span>":"<span class='n'>it doesn't work yet</span>"}</h3>`;
  rep.res.forEach(x=>{if(x.fact)h+=`<p class="${x.ok?"y":"n"}">${x.ok?"✔":"✘"} ${esc(x.fact)}</p>`;});
  if(rep.ok)h+=`<div class="tutor"><b>Magistra Cornelia — why it works:</b> ${rep.res.filter(x=>x.why).map(x=>esc(x.why)).join(" ")}</div>`;
  else h+=`<div class="tutor"><b>Magistra Cornelia — why it didn't work:</b> ${rep.res.filter(x=>!x.ok&&x.whyFail).map(x=>esc(x.whyFail)).join(" ")}</div>`;
  S.rep=h;S.passed=rep.ok;draw();startTest(rep);side();if(S.hooks.tested)S.hooks.tested(S.id,rep.ok);}
function make(){if(!S.passed)return;const it=ITEMS[S.id];const thumb=snapshot();const res={item:S.id,name:it.name,parts:JSON.parse(JSON.stringify(S.parts)),thumb,order:S.order||null};
  if(S.hooks.made&&S.hooks.made(res)!==false){S.rep=`<p class="y">✅ You made the ${esc(it.name)}! It's in your bag.${S.order?` Take it to ${esc(S.order.who)}.`:""}</p>`;S.passed=false;side();}}
// bring an invention to life: the game's helper looks at the parts and the name and picks what it does (from FNS); if it can't be reached, the shape decides
function alive(){if(!S.parts.length||S.busy)return;S.busy=true;S.note="Something is happening…";side();const parts=JSON.parse(JSON.stringify(S.parts)),nm=(S.nm||"").trim(),hooks=S.hooks;
  const fin=(fn,name,say)=>{if(!S||S.id!=="invention"){return;}S.busy=false;if(!FNS[fn])fn=guessFn(parts);const F=FNS[fn];const res={item:"invention",name:nm||name||F.name,nm:nm||name||F.name,fn,parts,thumb:snap(parts,96),order:null};S.note="";
    if(hooks.made&&hooks.made(res)!==false)S.rep=`<p class="y">✨ It's alive! Your ${esc(res.nm)} became a <b>${F.icon} ${esc(F.name)}</b>: ${esc(F.what)}.${say?" "+esc(say):""} It's in your bag.</p>`;side();};
  fetch("/api/elementum/invent",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({parts,name:nm})}).then(r=>r.ok?r.json():null).then(j=>fin(j&&j.fn,j&&j.name,j&&j.say)).catch(()=>fin());}
function snapshot(){return snap(S.parts,96);}
function snap(parts,px){try{const c=document.createElement("canvas");c.width=c.height=px||96;const r=new THREE.WebGLRenderer({canvas:c,antialias:true,preserveDrawingBuffer:true,alpha:true});const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x445566,1.2));
    const d=new THREE.DirectionalLight(0xffffff,.8);d.position.set(300,600,400);sc.add(d);const b=new THREE.Box3();parts.forEach(p=>{const m=meshOf(p);sc.add(m);b.union(new THREE.Box3().setFromObject(m));});
    const cc=b.getCenter(new THREE.Vector3()),s=Math.max(...b.getSize(new THREE.Vector3()).toArray());const cam=new THREE.PerspectiveCamera(35,1,1,50000);cam.position.set(cc.x+s*1.3,cc.y+s*1.0,cc.z-s*1.8);cam.lookAt(cc);r.render(sc,cam);
    const u=c.toDataURL("image/png");r.dispose();r.forceContextLoss();return u;}catch(e){return "";}}
function wiki(){const it=ITEMS[S.id];S.wiki=`<div class="wiki">Looking it up on Wikipedia…</div>`;side();
  fetch("/api/elementum/wiki?q="+encodeURIComponent(it.wiki||it.name),{credentials:"include"}).then(r=>r.json()).then(j=>{if(!S)return;
    if(j.error){S.wiki=`<div class="wiki">${esc(j.error)}</div>`;side();return;}
    S.wiki=`<div class="wiki"><b>${esc(j.title)}</b> <small>— from <a href="${esc(j.url)}" target="_blank" rel="noopener">Wikipedia</a></small><p>${esc(j.intro).replace(/\n+/g,"</p><p>")}</p>${(j.sections||[]).map(s=>`<h4 style="margin:8px 0 2px">${esc(s.h)}</h4><p>${esc(s.text).replace(/\n+/g,"</p><p>")}</p>`).join("")}</div>`;side();})
    .catch(()=>{if(!S)return;S.wiki=`<div class="wiki">Wikipedia can't be reached right now.</div>`;side();});}
function start(id,order){S.id=id;S.order=order;S.who=order?order.who:"";S.text=order?order.text:"";S.pay=order?order.pay:0;
  S.parts=load(id);S.sel=-1;S.note="";S.rep="";S.wiki="";S.passed=false;S.choose=false;fit();draw();side();}
function open(hooks){ensureDom();S={hooks:hooks||{},orders:(hooks&&hooks.orders)||[],choose:true,parts:[],sel:-1,id:ORDER[0]};$("#bench").classList.remove("hidden");
  const sd=$("#bSide");sd.onclick=onSide;sd.oninput=onEdit;sd.onchange=onEdit;sd.onkeydown=e=>e.stopPropagation();
  if(hooks&&hooks.item)start(hooks.item,hooks.order||null);else side();draw();}
function close(){if(!S)return;const h=S.hooks;S=null;TEST=null;$("#bench").classList.add("hidden");if(h.onClose)h.onClose();}
const IDEAS={item:ORDER[0],pics:{}};
function openIdeas(hooks){if(!$("#ideas")){const st=document.createElement("style");st.textContent=`#ideas{position:fixed;inset:0;z-index:50;background:rgba(18,16,14,.96);color:#f3ead8;overflow:auto;font:15px Georgia,serif}#ideas.hidden{display:none}
#ideas .in{max-width:980px;margin:0 auto;padding:18px}#ideas h1{margin:0 0 4px;font-size:26px}#ideas .tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}#ideas .tabs button{margin:0;padding:6px 10px;border-radius:999px;border:1px solid #5a4a38;background:#2a231c;color:#f3ead8;font:13px system-ui,sans-serif;cursor:pointer}
#ideas .tabs button.on{background:#e8b84a;color:#222;border-color:#e8b84a}#ideas .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}#ideas .card{background:#f6efe0;color:#2a2018;border-radius:12px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#ideas .card img{width:100%;aspect-ratio:1;background:#e8dcc4;border-radius:8px;display:block}#ideas .card h3{margin:8px 0 4px;font-size:17px}#ideas .card p{margin:0;font-size:14px;line-height:1.4}#ideas .close{float:right;margin:0;padding:8px 14px;border-radius:10px;border:0;background:#e8b84a;color:#222;font:600 14px system-ui;cursor:pointer}`;document.head.appendChild(st);
    const d=document.createElement("div");d.id="ideas";d.className="hidden";document.body.appendChild(d);d.onclick=e=>{const t=e.target.closest("[data-it],.close");if(!t)return;if(t.classList.contains("close")){closeIdeas();return;}IDEAS.item=t.dataset.it;drawIdeas();};}
  IDEAS.hooks=hooks||{};if(hooks&&hooks.item&&DESIGNS[hooks.item])IDEAS.item=hooks.item;$("#ideas").classList.remove("hidden");drawIdeas();}
function drawIdeas(){const it=ITEMS[IDEAS.item],L=LV[it.level];let h=`<div class="in"><button class="close">Close the book</button><h1>📐 Design ideas</h1><p>Ideas from builders before you. Look at how each one works — then design your own at the workbench. (Nothing here builds anything for you.)</p>`;
  h+=`<div class="tabs">${ORDER.filter(k=>DESIGNS[k]).map(k=>`<button data-it="${k}" class="${k===IDEAS.item?"on":""}">${ITEMS[k].icon} ${esc(ITEMS[k].name)}</button>`).join("")}</div>`;
  h+=`<h2 style="margin:6px 0 10px">${it.icon} ${esc(it.name[0].toUpperCase()+it.name.slice(1))}s <small style="font:13px system-ui">· ${L.name} to build</small></h2><div class="cards">`;
  (DESIGNS[IDEAS.item]||[]).forEach(d=>{const key=IDEAS.item+"/"+d.name;if(!IDEAS.pics[key])IDEAS.pics[key]=snap(d.parts(),320);h+=`<div class="card"><img src="${IDEAS.pics[key]}" alt=""><h3>${esc(d.name)}</h3><p>${esc(IDEA_TEXT[d.name]||"")}</p>${IDEAS.hooks&&IDEAS.hooks.recipe?`<p style="font:12px system-ui;margin-top:6px;border-top:1px solid #cbb98f;padding-top:6px">${d.parts().map(q=>`<b>${esc(q.name||SNAME[q.shape])}</b> — ${MNAME[q.mat]||q.mat} ${SNAME[q.shape].toLowerCase()}, ${FIELDS[q.shape].filter(f=>n(q[f],0)>0).map(f=>`${(FNAME[f]||f).replace(/ \(.*/,"")} ${n(q[f],0)}`).join(", ")}; at ${n(q.x,0)}, ${n(q.y,0)}, ${n(q.z,0)}`).join("<br>")}</p>`:""}</div>`;});
  $("#ideas").innerHTML=h+`</div></div>`;}
function closeIdeas(){const e=$("#ideas");if(!e||e.classList.contains("hidden"))return;e.classList.add("hidden");if(IDEAS.hooks&&IDEAS.hooks.onClose)IDEAS.hooks.onClose();}
return {FNS,ITEMFN,guessFn,snap,openIdeas,closeIdeas,ideasOpen:()=>!!$("#ideas")&&!$("#ideas").classList.contains("hidden"),DESIGNS,ITEMS,LV,ORDER,open,close,isOpen:()=>!!S,test,analyse,meshOf};
})();
