// Elementum — materials, crafting recipes, the market's prices, and the adaptive math that hides the recipes.
// The forge never lists what it needs: each recipe is a short problem set whose answers are the amounts (and the crystal) to put in.
// The math adapts: levels 1-8 run from Grade 1 sums up to contest problems (MATHCOUNTS state / AMC 8 style). A correct forge moves you up
// a level, being stuck moves you down. The market (haggling with percents) and the villagers' jobs (roofs, patches, fences) use the same levels. Pure data + functions (no THREE), so a separate solver can check every problem's answer in node.
const CRAFT=(function(){
const MATERIALS={
  ferrum:{name:"Ferrum",what:"iron ingot",icon:"🔩",sell:2,buy:5},
  lignum:{name:"Lignum",what:"wood",icon:"🪵",sell:1,buy:3},
  carbo:{name:"Carbo core",what:"fire crystal",icon:"🟠",num:2,el:"fire",core:true,sell:6,buy:15},
  nimbus:{name:"Nimbus core",what:"water crystal",icon:"🔵",num:3,el:"water",core:true,sell:6,buy:15},
  silex:{name:"Silex core",what:"earth crystal",icon:"🟤",num:5,el:"earth",core:true,sell:6,buy:15},
  aether:{name:"Aether core",what:"air crystal",icon:"⚪",num:7,el:"air",core:true,sell:7,buy:18},
  electrum:{name:"Electrum core",what:"lightning crystal",icon:"🟡",num:11,el:"lightning",core:true,sell:8,buy:20},
  cornu:{name:"Demon horn",what:"from the Demon",icon:"🔺",sell:10},
  villus:{name:"Yeti fur",what:"from the Yeti",icon:"🧶",sell:10},
  sporae:{name:"Royal spores",what:"from the Mushroom King",icon:"🍄",sell:10},
  pannus:{name:"Shadow cloth",what:"from the Ninja",icon:"🎴",sell:10},
  gemma:{name:"Storm gem",what:"from the Frog",icon:"💎",sell:12},
  dens:{name:"Orc tusk",what:"from the Orc",icon:"🦷",sell:11},
  squama:{name:"Dino scale",what:"from the Dino",icon:"🦎",sell:11},
  pluma:{name:"Monkroose feather",what:"from the Monkroose",icon:"🪶",sell:10},
  cinis:{name:"Shadow ash",what:"from the Blue Demon",icon:"🌑",sell:13},
};
const CORES=["carbo","nimbus","silex","aether","electrum"];
const RECIPES=[
  {id:"rifle",name:"Magna Rifle",icon:"🔫",what:"your first gun — or buy it from Mercator for 30 🪙",parts:[{m:"ferrum",lo:2,hi:5},{m:"lignum",lo:1,hi:4}]},
  {id:"shotgun",name:"Chaos Shotgun",icon:"💥",what:"10 pellets, deadly up close",parts:[{m:"ferrum",lo:2,hi:6},{m:"lignum",lo:1,hi:5},{core:1}]},
  {id:"staff",name:"Orator Staff",icon:"🪄",what:"a slow bolt that explodes",parts:[{m:"lignum",lo:3,hi:7},{core:2}]},
  {id:"repeater",name:"Fulmen Repeater",icon:"⚡",what:"very fast, 50 rounds",parts:[{m:"ferrum",lo:3,hi:7},{m:"gemma",lo:1,hi:2},{core:1}]},
  {id:"cannon",name:"Terra Cannon",icon:"💣",what:"huge blast, 2 shells",parts:[{m:"ferrum",lo:4,hi:8},{m:"sporae",lo:1,hi:2},{m:"cornu",lo:1,hi:2}]},
  {id:"arcus",name:"Ventus Arcus",icon:"🏹",what:"long range, 2× head shots",parts:[{m:"lignum",lo:3,hi:6},{m:"pannus",lo:1,hi:2},{core:1}]},
  {id:"fortis",name:"Potio Fortis",icon:"⚗️",what:"you + players near you: stronger and faster 40 s",parts:[{m:"lignum",lo:2,hi:5},{m:"cornu",lo:1,hi:1},{core:1}]},
  {id:"potion",name:"Potio Sanans ×2",icon:"🧪",what:"drink to heal 50 HP",parts:[{m:"lignum",lo:1,hi:4},{m:"villus",lo:1,hi:1},{core:1}],gives:2},
  // everything can be made (Barbara 2026-11-18): food cooked on the forge fire, and a spell scroll of any element (you get a random spell of that element)
  {id:"cook_pomum",group:"food",name:"Apple",icon:"🍎",what:"cook: +8 HP",give:{t:"food",id:"pomum"},parts:[{m:"lignum",lo:1,hi:2}]},
  {id:"cook_panis",group:"food",name:"Bread",icon:"🍞",what:"cook: +20 HP",give:{t:"food",id:"panis"},parts:[{m:"lignum",lo:1,hi:4}]},
  {id:"cook_uvae",group:"food",name:"Grapes",icon:"🍇",what:"cook: high jumps",give:{t:"food",id:"uvae"},parts:[{m:"lignum",lo:1,hi:3},{m:"aether",lo:1,hi:1}]},
  {id:"cook_mel",group:"food",name:"Honey cake",icon:"🍯",what:"cook: fast feet",give:{t:"food",id:"mel"},parts:[{m:"lignum",lo:2,hi:4},{m:"pluma",lo:1,hi:1}]},
  {id:"cook_puls",group:"food",name:"Porridge",icon:"🥣",what:"cook: heals over time",give:{t:"food",id:"puls"},parts:[{m:"lignum",lo:2,hi:5},{m:"nimbus",lo:1,hi:1}]},
  {id:"cook_caseus",group:"food",name:"Cheese",icon:"🧀",what:"cook: tougher",give:{t:"food",id:"caseus"},parts:[{m:"lignum",lo:2,hi:5},{m:"silex",lo:1,hi:1}]},
  {id:"cook_piscis",group:"food",name:"Grilled fish",icon:"🐟",what:"cook: stronger hits",give:{t:"food",id:"piscis"},parts:[{m:"lignum",lo:2,hi:5},{m:"carbo",lo:1,hi:1}]},
  {id:"scroll_fire",group:"scroll",name:"Fire scroll",icon:"🔥",what:"a random fire spell",give:{t:"scroll",el:"fire"},parts:[{m:"lignum",lo:1,hi:4},{m:"carbo",lo:1,hi:2}]},
  {id:"scroll_water",group:"scroll",name:"Water scroll",icon:"🌊",what:"a random water spell",give:{t:"scroll",el:"water"},parts:[{m:"lignum",lo:1,hi:4},{m:"nimbus",lo:1,hi:2}]},
  {id:"scroll_earth",group:"scroll",name:"Earth scroll",icon:"🪨",what:"a random earth spell",give:{t:"scroll",el:"earth"},parts:[{m:"lignum",lo:1,hi:4},{m:"silex",lo:1,hi:2}]},
  {id:"scroll_air",group:"scroll",name:"Air scroll",icon:"🌪️",what:"a random air spell",give:{t:"scroll",el:"air"},parts:[{m:"lignum",lo:1,hi:4},{m:"aether",lo:1,hi:2}]},
  {id:"scroll_lightning",group:"scroll",name:"Lightning scroll",icon:"⚡",what:"a random lightning spell",give:{t:"scroll",el:"lightning"},parts:[{m:"lignum",lo:1,hi:4},{m:"electrum",lo:1,hi:2}]},
  {id:"scroll_ice",group:"scroll",name:"Ice scroll",icon:"🧊",what:"a random ice spell",give:{t:"scroll",el:"ice"},parts:[{m:"lignum",lo:1,hi:3},{m:"nimbus",lo:1,hi:1},{m:"villus",lo:1,hi:1}]},
  {id:"scroll_shadow",group:"scroll",name:"Shadow scroll",icon:"🌑",what:"a random shadow spell",give:{t:"scroll",el:"shadow"},parts:[{m:"lignum",lo:1,hi:3},{m:"pannus",lo:1,hi:2}]},
  {id:"scroll_light",group:"scroll",name:"Light scroll",icon:"🌟",what:"a random light spell",give:{t:"scroll",el:"light"},parts:[{m:"lignum",lo:1,hi:3},{m:"electrum",lo:1,hi:1},{m:"gemma",lo:1,hi:1}]},
  {id:"scroll_heal",group:"scroll",name:"Healing scroll",icon:"✨",what:"Fons Vitae: heal 50 HP",give:{t:"scroll",el:"heal"},parts:[{m:"lignum",lo:1,hi:3},{m:"nimbus",lo:1,hi:1},{m:"sporae",lo:1,hi:1}]},
  {id:"scroll_gold",group:"scroll",name:"Star scroll",icon:"🌠",what:"Stella Cadens: a falling star",give:{t:"scroll",el:"gold"},parts:[{m:"lignum",lo:2,hi:4},{m:"carbo",lo:1,hi:1},{m:"electrum",lo:1,hi:1},{m:"gemma",lo:1,hi:1}]},
];
const LEVELS=["","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grades 7–8","Contest"];

// ---------- problems with a known answer n, by level ----------
const R=()=>Math.random();const pick=a=>a[Math.floor(R()*a.length)];const ri=(a,b)=>a+Math.floor(R()*(b-a+1));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const ndiv=m=>{let c=0;for(let i=1;i<=m;i++)if(m%i===0)c++;return c;};
const isPrime=x=>{if(x<2)return false;for(let i=2;i*i<=x;i++)if(x%i===0)return false;return true;};
const phi=m=>{let c=0;for(let i=1;i<=m;i++)if(gcd(i,m)===1)c++;return c;};
const tri=p=>{let c=0;for(let a=1;a<=p;a++)for(let b=a;b<=p;b++){const c3=p-a-b;if(c3>=b&&a+b>c3)c++;}return c;};
const zeros=k=>{let z=0;for(let f=5;f<=k;f*=5)z+=Math.floor(k/f);return z;};
const powmod=(b,e,m)=>{let r=1%m;b%=m;while(e>0){if(e&1)r=r*b%m;b=b*b%m;e>>=1;}return r;};
const NAMES=["Livia","Marcus","Julia","Felix","Aurelia","Cassius","Octavia","Titus"];
const THINGS=["apples","shells","coins","feathers","marbles","pebbles"];
const G=[
  // ----- Grade 1: small sums and take-aways
  {lv:[1,2],f:n=>{if(n<2)return null;const a=ri(1,n-1);return `What is ${a} + ${n-a}?`;}},
  {lv:[1,2],f:n=>{const b=ri(1,6);return `What is ${n+b} − ${b}?`;}},
  {lv:[1,2],f:n=>{if(n<2)return null;const a=ri(1,n-1),t=pick(THINGS);return `${pick(NAMES)} has ${a} ${a===1?t.slice(0,-1):t} and finds ${n-a} more. How many ${t} now?`;}},
  {lv:[1,2],f:n=>{const b=ri(1,5),t=pick(THINGS);return `There are ${n+b} ${t}. ${b} roll away. How many are left?`;}},
  // ----- Grade 2: two-digit numbers, three numbers
  {lv:[2,3],f:n=>{const y=ri(11,48);return `What is ${n+y} − ${y}?`;}},
  {lv:[2,3],f:n=>{if(n<3)return null;const a=ri(1,n-2),b=ri(1,n-a-1);return `What is ${a} + ${b} + ${n-a-b}?`;}},
  {lv:[2,3],f:n=>{const k=ri(2,5);return `${k} friends share ${k*n} stickers equally. How many stickers does each friend get?`;}},
  // ----- Grade 3: times tables, division, small stories
  {lv:[3,4],f:n=>{const k=ri(3,9);return `What is ${k*n} ÷ ${k}?`;}},
  {lv:[3,4],f:n=>{for(let t=0;t<20;t++){const a=ri(2,9),b=ri(2,9),c=a*b-n;if(c>0)return `What is ${a} × ${b} − ${c}?`;}return null;}},
  {lv:[3,4],f:n=>{const k=ri(3,8),e=ri(1,k-1);return `A farmer packs ${k*n+e} eggs into boxes of ${k}. How many full boxes can she fill?`;}},
  // ----- Grade 4: missing factors, fractions of a number, perimeter, rates
  {lv:[4,5],f:n=>{const a=ri(3,12);return `${a} × ☐ = ${a*n}. What number goes in the box?`;}},
  {lv:[4,5],f:n=>{const q=pick([2,3,4,5]),p=pick([1,2,3].filter(x=>x<q));if((n*q)%p)return null;return `What is ${p}/${q} of ${n*q/p}?`;}},
  {lv:[4,5,6],f:n=>{const w=ri(1,9);if(w===n)return null;return `A rectangle has a perimeter of ${2*(n+w)} and a width of ${w}. What is its length?`;}},
  {lv:[4,5,6],f:n=>{const t=pick([3,4,5,6]),r=pick([2,3,4]);if((n*t)%r)return null;const T=n*t/r;if(T===t)return null;return `A forge pours ${r} ingots every ${t} minutes. At that rate, how many ingots does it pour in ${T} minutes?`;}},
  // ----- Grade 5: order of operations, percents, averages, counting
  {lv:[5,6],f:n=>{for(let t=0;t<30;t++){const b=ri(2,6),c=ri(2,6),a=ri(1,20),d=a+b*c-n;if(d>0&&d<40)return `What is ${a} + ${b} × ${c} − ${d}?`;}return null;}},
  {lv:[5,6],f:n=>{const ps=[20,25,40,50,60,75].filter(p=>(n*100)%p===0);if(!ps.length)return null;const p=pick(ps);return `What is ${p}% of ${n*100/p}?`;}},
  {lv:[5,6],f:n=>{const k=ri(3,5);const m=ri(Math.max(n,3),n+6);const rest=[];let need=m*k-n;for(let i=0;i<k-1;i++){const left=k-1-i;const v=i===k-2?need:ri(Math.max(1,need-(left-1)*20),Math.min(20,need-(left-1)));rest.push(v);need-=v;}
    if(rest.some(v=>v<1||v>30))return null;return `The mean of ${k} numbers is ${m}. ${k-1} of them are ${rest.join(", ")}. What is the last number?`;}},
  {lv:[5,6],f:n=>n>=1&&n<=9?`How many two-digit whole numbers have digits that add up to ${n}?`:null},
  {lv:[5,6],f:n=>{const k=[1,3,6,10,15].indexOf(n);if(k<0)return null;return `${k+2} wizards meet, and each pair shakes hands exactly once. How many handshakes are there?`;}},
  // ----- Grade 6: factors, equations, GCF, sequences, probability
  {lv:[6,7],f:n=>{const c=[];for(let m=13;m<=200;m++)if(ndiv(m)===n)c.push(m);if(!c.length)return null;return `How many positive whole numbers divide ${pick(c)} with no remainder?`;}},
  {lv:[6,7],f:n=>{const a=ri(3,9),b=ri(2,20);return `When a number is multiplied by ${a} and then ${b} is subtracted, the result is ${a*n-b}. What is the number?`;}},
  {lv:[6,7],f:n=>{if(n<2)return null;let a,b;do{a=ri(2,9);b=ri(2,9);}while(a===b||gcd(a,b)!==1);return `What is the greatest common factor of ${n*a} and ${n*b}?`;}},
  {lv:[6,7],f:n=>{for(let t=0;t<20;t++){const k=ri(6,9),d=pick([-3,-2,2,3,4]),a=n-(k-1)*d;if(a>0&&a<40)return `In the arithmetic sequence ${a}, ${a+d}, ${a+2*d}, …, what is term number ${k}?`;}return null;}},
  {lv:[6,7],f:n=>{const b=ri(2,8);const g=gcd(n,n+b);return `A bag holds some red marbles and ${b} blue marbles. The chance of drawing a red one is ${n/g}/${(n+b)/g}. How many red marbles are there?`;}},
  {lv:[6,7],f:n=>{const k=[2,5,9,14].indexOf(n);if(k<0)return null;return `How many diagonals does a convex polygon with ${k+4} sides have?`;}},
  {lv:[6,7],f:n=>{const T={3:[4,5],4:[3,5],5:[3,4,"h"],6:[8,10],8:[6,10],10:[6,8,"h"],12:[5,13],13:[5,12,"h"],15:[8,17]}[n];if(!T)return null;
    return T[2]?`A right triangle has legs ${T[0]} and ${T[1]}. How long is the longest side?`:`A right triangle has a leg of ${T[0]} and a longest side of ${T[1]}. How long is the other leg?`;}},
  {lv:[6,7],f:n=>{const k=ri(2,4),y=ri(2,6);return `${pick(GIRLS)} is ${k} times as old as her brother. In ${y} years she will be ${k*n+y}. How old is her brother now?`;}},
  // ----- Grades 7-8 (MATHCOUNTS chapter): factorials, powers, systems, absolute value, triangles
  {lv:[7,8],f:n=>{const ks=[];for(let k=5;k<=60;k++)if(zeros(k)===n)ks.push(k);if(!ks.length)return null;return `How many zeros are at the end of ${pick(ks)}! (that is, 1 × 2 × 3 × … × the number)?`;}},
  {lv:[7,8],f:n=>{if(n>9)return null;const c=[];for(let a=2;a<=9;a++)for(let k=11;k<=40;k++)if(powmod(a,k,10)===n)c.push([a,k]);if(!c.length)return null;const [a,k]=pick(c);return `What is the units digit of ${a}^${k}?`;}},
  {lv:[7,8],f:n=>{const d=ri(1,n+4);const s=2*n-d;if(s<=d)return null;return `x + y = ${s} and x − y = ${d}. What is x?`;}},
  {lv:[7,8],f:n=>{if(n%2===0)return null;const b=(n+1)/2,a=ri(-9,20);return `How many integers x satisfy |x − ${a}| < ${b}?`;}},
  {lv:[7,8],f:n=>{const ps=[];for(let p=5;p<=30;p++)if(tri(p)===n)ps.push(p);if(!ps.length)return null;return `How many different triangles (not counting turned or flipped copies) have whole-number sides and a perimeter of ${pick(ps)}?`;}},
  {lv:[7,8],f:n=>{const b=pick([2,3,5]);return `If ${b}^(x + 2) = ${b**(n+2)}, what is x?`;}},
  // ----- Contest (MATHCOUNTS state / AMC 8 last problems)
  {lv:[8],f:n=>{const c=[];for(let m=20;m<=300;m++)if(ndiv(m)===n)c.push(m);if(!c.length)return null;return `How many ordered pairs of positive integers (a, b) satisfy a × b = ${pick(c)}?`;}},
  {lv:[8],f:n=>{const ps=[];for(let p=2;p<40;p++)if(isPrime(p))ps.push(p);if(n>ps.length)return null;const lo=ps[n-1]**2+1,hi=n<ps.length?ps[n]**2:lo+50;if(hi<=lo)return null;return `How many positive integers less than ${ri(lo,hi)} have exactly 3 positive divisors?`;}},
  {lv:[8],f:n=>{for(let t=0;t<60;t++){const m=ri(n+1,13),k=ri(10,60);if((k*(k+1)/2)%m===n)return `What is the remainder when 1 + 2 + 3 + … + ${k} is divided by ${m}?`;}return null;}},
  {lv:[8],f:n=>{for(let t=0;t<60;t++){const m=pick([7,11,13,17]),k=ri(10,60);if(powmod(2,k,m)===n)return `What is the remainder when 2^${k} is divided by ${m}?`;}return null;}},
  {lv:[8],f:n=>n>=1&&n<=6?`Two fair six-sided dice are rolled. Of the 36 equally likely outcomes, how many give a sum of ${pick(n===6?[7]:[n+1,13-n])}?`:null},
  {lv:[8],f:n=>{const c=[];for(let m=3;m<=40;m++)if(phi(m)===n)c.push(m);if(!c.length)return null;const m=pick(c);return `How many of the integers 1, 2, 3, …, ${m} share no common factor greater than 1 with ${m}?`;}},
  {lv:[8],f:n=>[1,3,6].includes(n)?`How many three-digit numbers have digits that add up to ${[1,3,6].indexOf(n)+1}?`:null},
  {lv:[8],f:n=>{if(n<2)return null;return `The product of two consecutive positive integers is ${n*(n+1)}. What is the smaller one?`;}},
];
// ----- China standard (义务教育数学课程标准): the same answer-n problems, but following what Chinese schools teach in each grade,
// written in English the way Chinese textbook word problems read (Xiaoming, yuan and jiao, 鸡兔同笼, 植树问题, 找次品, 盈亏问题 …).
// Level 1–6 = Grade 1–6 (primary), 7 = Grades 7–8 (junior middle), 8 = Grade 9.
const CNN=["Xiaoming","Xiaohong","Xiaogang","Lili","Xiaoli","Dongdong","Fangfang","Xiaojun"];
const CN=[
  // Grade 1: adding and taking away within 20, comparing, lining up, yuan and jiao, the clock
  {lv:[1],f:n=>{if(n<2)return null;const a=ri(1,Math.min(9,19-n));return `☐ + ${a} = ${n+a}. What number goes in the box?`;}},
  {lv:[1],f:n=>{const a=ri(1,6),[x,y]=[...CNN].sort(()=>R()-.5);return `${x} folded ${n+a} paper cranes. ${y} folded ${a} fewer than ${x}. How many paper cranes did ${y} fold?`;}},
  {lv:[1,2],f:n=>{if(n<3)return null;const a=ri(2,n-1),b=n-a+1;return `Children stand in a line. ${pick(CNN)} is number ${a} counting from the front and number ${b} counting from the back. How many children are in the line?`;}},
  {lv:[1],f:n=>n>=1&&n<=12?`The short hand of the clock points to ${n} and the long hand points to 12. What o'clock is it?`:null},
  {lv:[1,2],f:n=>n>=11&&n<=19?`1 yuan = 10 jiao. A pencil costs 1 yuan ${n-10} jiao. How many jiao is that?`:null},
  // Grade 2: times tables, sharing, division with remainders, metres and centimetres, two-step problems
  {lv:[2],f:n=>{const k=ri(2,9);return `${k*n} peaches are shared equally onto ${k} plates. How many peaches are on each plate?`;}},
  {lv:[2,3],f:n=>{const k=pick([4,5,6]);if(n<2)return null;const s=k*(n-1)+ri(1,k);return `${s} students go boating. Each boat holds ${k} students. How many boats do they need at least?`;}},
  {lv:[2],f:n=>{const b=ri(10,40),c=ri(2,9),a=n+b-c;if(a<=b)return null;return `The class library had ${a} books. ${b} books were lent out and ${c} were returned. How many books are in the library now?`;}},
  {lv:[2],f:n=>{const a=ri(2,9);return `There are ${a} groups of children with the same number in each group, ${a*n} children in all. How many children are in each group?`;}},
  // Grade 3: perimeter and area, outfits (搭配), dates, fractions of a number, multiplying by one digit
  {lv:[3],f:n=>`The perimeter of a square is ${4*n} cm. How long is each side, in cm?`},
  {lv:[3,4],f:n=>{const w=ri(2,9);return `A rectangular blackboard has an area of ${w*n} square decimetres and a width of ${w} decimetres. How long is it, in decimetres?`;}},
  {lv:[3],f:n=>{const f=[];for(let a=2;a<=n;a++)if(n%a===0&&n/a>=2)f.push(a);if(!f.length)return null;const a=pick(f);return `${pick(CNN)} has ${a} shirts and ${n/a} pairs of trousers. One shirt and one pair of trousers make an outfit. How many different outfits are there?`;}},
  {lv:[3],f:n=>{const k=pick([2,3,4,5,6]);return `There are ${k*n} apples. 1/${k} of them are given to Grandma. How many apples does Grandma get?`;}},
  {lv:[3,4],f:n=>{const a=ri(12,40);return `${a} × ☐ = ${a*n}. What number goes in the box?`;}},
  // Grade 4: laws of operations, tenths, chickens and rabbits in one cage (鸡兔同笼), averages
  {lv:[4],f:n=>{const a=pick([25,125]),b=a===25?4:8;return `Use the laws of multiplication: ${a} × ☐ × ${b} = ${a*b*n}. What number goes in the box?`;}},
  {lv:[4],f:n=>{const a=ri(11,49),b=100-a;return `${a} × ☐ + ${b} × ☐ = ${100*n}. The same number goes in both boxes. What is it?`;}},
  {lv:[4],f:n=>n>=1&&n<=9?`0.${n} is made of how many 0.1s?`:null},
  {lv:[4,5],f:n=>{const c=ri(2,9);const H=n+c,L=2*c+4*n;return `Chickens and rabbits are in the same cage. There are ${H} heads and ${L} legs. How many rabbits are there?`;}},
  {lv:[4,5],f:n=>{const k=ri(3,4);const xs=[];let need=k*n;for(let i=0;i<k-1;i++){const v=ri(1,Math.max(1,2*n-1));xs.push(v);need-=v;}xs.push(need);if(xs.some(v=>v<1))return null;return `${pick(CNN)} read ${xs.join(", ")} pages of a storybook on ${k} days. On average, how many pages a day is that?`;}},
  // Grade 5: simple equations, planting trees along a road (植树问题), common factors, area of a triangle, finding the fake (找次品)
  {lv:[5],f:n=>{const a=ri(2,9),b=ri(3,30);return `Solve the equation: ${a}x + ${b} = ${a*n+b}. What is x?`;}},
  {lv:[5,6],f:n=>{if(n<3)return null;const d=pick([2,3,4,5,6]),v=pick(["both ends","neither end","one end"]);const gaps=v==="both ends"?n-1:v==="neither end"?n+1:n;return `Along a road ${gaps*d} m long, a tree is planted every ${d} m, with trees at ${v}. How many trees are planted?`;}},
  {lv:[5],f:n=>{if(n<2)return null;let a,b;do{a=ri(2,7);b=ri(2,7);}while(a===b||gcd(a,b)!==1);return `What is the greatest common factor of ${n*a} and ${n*b}?`;}},
  {lv:[5],f:n=>{const b=ri(2,12);if((2*n*b)%b)return null;return `A triangle has an area of ${n*b/2} square cm and a base of ${b} cm. What is its height, in cm?`;}},
  {lv:[5,6],f:n=>{if(n<2||n>5)return null;const m=ri(3**(n-1)+1,Math.min(3**n,200));return `${m} parts look the same, but one is a lighter fake. Using a balance scale, what is the smallest number of weighings that is sure to find the fake?`;}},
  // Grade 6: ratios, percents, the pigeonhole principle (鸽巢原理), map scales, fractions of an unknown number
  {lv:[6],f:n=>{const a=pick([1,2,3].filter(a=>n%a===0));const k=n/a,b=ri(1,4);if(a===b)return null;return `In a group, the ratio of boys to girls is ${a} : ${b}. There are ${(a+b)*k} children in all. How many boys are there?`;}},
  {lv:[6],f:n=>{const ps=[10,20,25,40,50].filter(p=>(n*100)%p===0);if(!ps.length)return null;const p=pick(ps);return `A class has ${n*100/p} students, and ${p}% of them wear glasses. How many students wear glasses?`;}},
  {lv:[6,7],f:n=>{if(n<2)return null;const d=ri(3,8),A=d*(n-1)+ri(1,d);return `${A} apples are put into ${d} drawers. No matter how they are put in, at least one drawer must hold at least how many apples?`;}},
  {lv:[6],f:n=>`On a map with a scale of 1 : 100 000, two villages are ${n} cm apart. How many km apart are they really?`},
  {lv:[6],f:n=>{const q=pick([3,4,5]),p=pick([1,2].filter(p=>p<q));if(n%q)return null;return `${p}/${q} of a number is ${n*p/q}. What is the number?`;}},
  // Grades 7–8: rational numbers, equations from stories (盈亏问题), inequalities, square roots, linear functions
  {lv:[7],f:n=>{const a=ri(2,9),c=ri(2,9),b=n+a-c;if(b<1)return null;return `Calculate: (−${a}) + ${b} − (−${c})`;}},
  {lv:[7,8],f:n=>{if(n<3)return null;const a=ri(2,4),b=a+ri(1,3),r=ri(2,9),T=a*n+r,s=b*n-T;if(s<1)return null;return `A teacher hands out sweets. If each child gets ${a}, there are ${r} left over. If each child gets ${b}, there are ${s} too few. How many children are there?`;}},
  {lv:[7],f:n=>{const a=ri(2,6),b=ri(1,9);const c=a*n-b+ri(1,a);return `What is the largest whole number x with ${a}x − ${b} < ${c}?`;}},
  {lv:[7],f:n=>{for(let t=0;t<30;t++){const a=ri(1,n-1);if(n-a<1)continue;return `Calculate: √${a*a} + √${(n-a)*(n-a)}`;}return null;}},
  {lv:[7,8],f:n=>{const k=ri(2,5),b=ri(-6,6),x=ri(2,6);const sg=v=>v<0?`−${-v}`:`${v}`;return `The line y = kx + b passes through (1, ${sg(k+b)}) and (2, ${sg(2*k+b)}). When y = ${sg(k*n+b)}, what is x?`;}},
  // Grade 9: quadratic equations, similar triangles (shadows), vertex of a parabola, sum of roots
  {lv:[8],f:n=>{const m=ri(1,9),b=n-m;const mid=b>0?` − ${b===1?"":b}x`:b<0?` + ${-b===1?"":-b}x`:"";return `What is the positive root of x²${mid} − ${n*m} = 0?`;}},
  {lv:[8],f:n=>{const h=pick([1,2]),s=pick([2,3,4]);if((n*s)%h)return null;return `At the same moment, a pole ${h} m tall casts a shadow ${s} m long, and a tree casts a shadow ${n*s/h} m long. How tall is the tree, in m?`;}},
  {lv:[8],f:n=>{const c=ri(1,30);return `The parabola y = x² − ${2*n}x + ${c} has its vertex at x = ?`;}},
  {lv:[8],f:n=>{for(let t=0;t<30;t++){const a=ri(1,n-1),b=n-a;if(a<1||b<1)continue;return `The two roots of x² − ${n}x + ${a*b} = 0 are added together. What is their sum?`;}return null;}},
  {lv:[8],f:n=>{const T={5:[3,4],10:[6,8],13:[5,12]}[n];if(!T)return null;return `In a circle, a chord is ${2*T[1]} cm long and is ${T[0]} cm from the centre. What is the radius, in cm?`;}},
];
let STYLE="us";
const LEVELS_CN=["","China Grade 1","China Grade 2","China Grade 3","China Grade 4","China Grade 5","China Grade 6","China Grades 7–8","China Grade 9"];
const levelName=lv=>(STYLE==="china"?LEVELS_CN:LEVELS)[lv];
function problem(n,lv){const B=STYLE==="china"?CN:G;const opts=B.filter(g=>g.lv.includes(lv)).sort(()=>R()-.5);for(const g of opts){const q=g.f(n);if(q)return q;}
  for(const g of B.filter(g=>g.lv.some(l=>Math.abs(l-lv)<=1)).sort(()=>R()-.5)){const q=g.f(n);if(q)return q;}return `What is ${n*7} ÷ 7?`;}
// higher levels chain two problems (A − B, A + B), the contest level chains harder ones more often
function amount(n,lv){const two=lv>=8?.75:lv>=6?.45:lv>=5?.25:0;
  if(R()<two&&n>=2){if(R()<.6){const b=ri(1,6),a=n+b;return {steps:[problem(a,lv),problem(b,lv)],how:"A − B"};}if(n>=3){const b=ri(1,n-1);return {steps:[problem(n-b,lv),problem(b,lv)],how:"A + B"};}}
  return {steps:[problem(n,lv)],how:null};}
// which crystal: every core has a number (2, 3, 5, 7, 11); the clue gets harder with the level
const KID={2:["the number of wheels on a bicycle","the number of eyes on your face"],3:["the number of sides of a triangle","the number of wheels on a tricycle"],5:["the number of fingers on one hand","the number of sides of a pentagon"],7:["the number of days in a week","the number of colors in a rainbow"],11:["the number of players a soccer team has on the field","ten plus one"]};
const PRIME=[
  {lv:[1,2,3],f:p=>pick(KID[p])},
  {lv:[3,4],f:p=>{const a=ri(1,p-1);return `${a} + ${p-a}`;}},
  {lv:[3,4,5],f:p=>{const k=ri(2,5);return `${p*k} ÷ ${k}`;}},
  {lv:[5,6],f:p=>{const q=pick([13,17,19,23]);return `the smallest prime factor of ${p*q}`;}},
  {lv:[5,6],f:p=>{const m={2:[8,16,32,64],3:[18,54,72,96],5:[60,75,90,100],7:[84,98,140,126],11:[66,88,110,132]}[p];return `the largest prime factor of ${pick(m)}`;}},
  {lv:[6,7],f:p=>{const x={2:[4,5],3:[6,7],5:[12,13],7:[18,19],11:[32,33,34,35,36,37]}[p];return `the number of primes less than ${pick(x)}`;}},
  {lv:[6,7],f:p=>{const m=pick([4,6,8,9,10,12].filter(m=>m>p));return `the remainder when ${m*ri(3,9)+p} is divided by ${m}`;}},
  {lv:[7,8],f:p=>{const m={2:[97,101,89,83],3:[49,121,169],5:[16,81,625],7:[64,729],11:[1024]}[p];return `the number of positive divisors of ${pick(m)}`;}},
  {lv:[8],f:p=>{const c=[];for(let k=20;k<=90;k++)for(const a of [2,3,7])if(powmod(a,k,10)===p)c.push([a,k]);if(!c.length)return null;const [a,k]=pick(c);return `the units digit of ${a}^${k}`;}},
  {lv:[8],f:p=>{const c=[];for(let k=10;k<=80;k++)for(const m of [13,17,19,23])if(powmod(2,k,m)===p)c.push([k,m]);if(!c.length)return null;const [k,m]=pick(c);return `the remainder when 2^${k} is divided by ${m}`;}},
];
function coreClue(p,lv){for(const g of PRIME.filter(g=>g.lv.includes(lv)).sort(()=>R()-.5)){const q=g.f(p);if(q)return q;}return `the number ${p}`;}
function pairClue(a,b,lv){const x=MATERIALS[a].num,y=MATERIALS[b].num;
  if(lv<=3)return `Their numbers add up to ${x+y}.`;if(lv<=6)return `Both numbers are prime, and they add up to ${x+y}.`;
  return R()<.5?`The squares of their two numbers add up to ${x*x+y*y}.`:`The difference of the squares of their two numbers is ${Math.abs(x*x-y*y)}.`;}
const coreByNum=p=>CORES.find(c=>MATERIALS[c].num===p);
function draw(rec,lv){lv=Math.max(1,Math.min(8,lv||5));const parts=[],need={};
  rec.parts.forEach(pt=>{
    if(pt.m){const hi=lv<=2?Math.min(pt.hi,6):pt.hi;const n=ri(pt.lo,hi);need[pt.m]=(need[pt.m]||0)+n;parts.push({kind:"amount",m:pt.m,...amount(n,lv)});}
    else if(pt.core===1){const c=pick(CORES);need[c]=(need[c]||0)+1;parts.push({kind:"core",text:`Put in ONE crystal core whose number is ${coreClue(MATERIALS[c].num,lv)}.`});}
    else{let a,b;do{a=pick(CORES);b=pick(CORES);}while(a===b);need[a]=1;need[b]=1;parts.push({kind:"core2",text:`Put in TWO different crystal cores, one of each. ${pairClue(a,b,lv)}`});}});
  return {need,parts,lv};}
function check(need,tray){let right=0,total=0;const keys=new Set([...Object.keys(need),...Object.keys(tray).filter(k=>tray[k]>0)]);
  keys.forEach(k=>{total++;if((need[k]||0)===(tray[k]||0))right++;});return {ok:right===total,right,total};}
// ---------- the market: haggling. Mercator names a deal, you work out the price (dir −1: off what you buy, +1: on top of what you sell) ----------
// percents that keep every step a whole number of coins
const pctOk=(P,p)=>(P*p)%100===0;
const pcts=(P,list)=>list.filter(p=>pctOk(P,p));
const DEAL=[
  {lv:[1],f:(P,d)=>{const k=ri(1,Math.min(5,P-1));return d<0?{t:`I'll take ${k} coins off the ${P}.`,pay:P-k}:{t:`It's worth ${P}, and I'll add ${k} more coins.`,pay:P+k};}},
  {lv:[2],f:(P,d)=>{const a=ri(2,6),b=ri(1,4);if(a+b>=P)return null;return d<0?{t:`${a} coins off the ${P}, and ${b} more coins off because I like you.`,pay:P-a-b}:{t:`It's worth ${P}. I'll add ${a} coins, and ${b} more because I like you.`,pay:P+a+b};}},
  {lv:[2,3],f:(P,d)=>{if(P%2)return null;return d<0?{t:`Half price! It's normally ${P}.`,pay:P/2}:{t:`It's worth ${P}, and I'll pay half of that again on top.`,pay:P*3/2};}},
  {lv:[3,4],f:(P,d)=>{const fr=[[4,"a quarter"],[3,"a third"],[5,"a fifth"],[10,"a tenth"]].filter(([q])=>P%q===0);if(!fr.length)return null;const [q,w]=pick(fr);
    return d<0?{t:`I'll take ${w} off the price. It's normally ${P}.`,pay:P-P/q}:{t:`It's worth ${P}, and I'll add ${w} of that on top.`,pay:P+P/q};}},
  {lv:[4,5],f:(P,d)=>{const ps=pcts(P,[10,50]);if(!ps.length)return null;const p=pick(ps);return d<0?{t:`${p}% off the ${P} coins.`,pay:P-P*p/100}:{t:`It's worth ${P}. I'll pay ${p}% more than that.`,pay:P+P*p/100};}},
  {lv:[5,6],f:(P,d)=>{const ps=pcts(P,[20,25,30,40,60,75]);if(!ps.length)return null;const p=pick(ps);return d<0?{t:`${p}% off the ${P} coins.`,pay:P-P*p/100}:{t:`It's worth ${P}. I'll pay ${p}% more than that.`,pay:P+P*p/100};}},
  {lv:[6,7],f:(P,d)=>{const ps=pcts(P,[5,15,35,45,55,65,70,80]);if(!ps.length)return null;const p=pick(ps);return d<0?{t:`${p}% off the ${P} coins.`,pay:P-P*p/100}:{t:`It's worth ${P}. I'll pay ${p}% more than that.`,pay:P+P*p/100};}},
  {lv:[6,7],f:(P,d)=>{if(d>0)return null;const ps=pcts(P,[50,60,70,75,80,90]);if(!ps.length)return null;const p=pick(ps);return {t:`It's normally ${P} coins. For you, you pay only ${p}% of the price.`,pay:P*p/100};}},
  {lv:[7,8],f:(P,d)=>{const c=[];for(const a of [10,20,25,50])for(const b of [10,20,25,50]){if(!pctOk(P,a))continue;const m=P+d*P*a/100;if(pctOk(m,b))c.push([a,b,m+d*m*b/100]);}
    if(!c.length)return null;const [a,b,pay]=pick(c);return d<0?{t:`${a}% off the ${P} coins — and then another ${b}% off the new price.`,pay}:{t:`It's worth ${P}. I'll add ${a}%, and then another ${b}% on top of that.`,pay};}},
  {lv:[8],f:(P,d)=>{if(d>0)return null;const c=[];for(let S=Math.ceil(P*.6);S<=Math.floor(P*1.4);S++)for(const a of [10,20,25,50])for(const b of [20,25,30,40,50]){
      if(!pctOk(S,a))continue;const m=S+S*a/100;if(!pctOk(m,b))continue;const pay=m-m*b/100;if(pay<P&&pay>=P*.45&&a!==b)c.push([S,a,b,pay]);}
    if(!c.length)return null;const [S,a,b,pay]=pick(c);return {t:`Yesterday this cost ${S} coins. This morning I raised the price by ${a}%. But for you: ${b}% off today's price.`,pay};}},
  {lv:[8],f:(P,d)=>{if(d<0)return null;const c=[];for(const a of [20,25,50])for(const b of [10,20,25])if(pctOk(P,a)){const m=P+P*a/100;if(pctOk(m,b)){const pay=m-m*b/100;if(pay>P)c.push([a,b,pay]);}}
    if(!c.length)return null;const [a,b,pay]=pick(c);return {t:`It's worth ${P}. I'll pay ${a}% more than that… minus my ${b}% stall fee on the new amount.`,pay};}},
];
function deal(P,lv,dir){lv=Math.max(1,Math.min(8,lv||5));const good=r=>r&&Number.isInteger(r.pay)&&(dir<0?r.pay>=1&&r.pay<P:r.pay>P);
  for(const g of DEAL.filter(g=>g.lv.includes(lv)).sort(()=>R()-.5)){const r=g.f(P,dir);if(good(r))return r;}
  for(const g of DEAL.filter(g=>g.lv.some(l=>l<lv)).sort((a,b)=>Math.max(...b.lv)-Math.max(...a.lv))){const r=g.f(P,dir);if(good(r))return r;}
  const k=Math.max(1,Math.min(3,P-1));return dir<0?{t:`I'll take ${k} coins off the ${P}.`,pay:P-k}:{t:`It's worth ${P}, and I'll add ${k} more coins.`,pay:P+k};}

// ---------- jobs for the villagers: fix a roof (planks), patch a wall (iron plates), build a fence (posts). The answer is how many to use ----------
const TRIPLES=[[3,4,5],[6,8,10],[5,12,13],[8,6,10],[4,3,5]];
const facs=x=>{const r=[];for(let a=2;a*a<=x;a++)if(x%a===0)r.push([a,x/a]);return r;};
const JOBS={
  roof:{m:"lignum",unit:"plank",lo:2,hi:9,G:[
    {lv:[1],f:n=>{if(n<2)return null;const a=ri(1,n-1);return `The roof has ${a} holes on the front and ${n-a} on the back. One plank fixes one hole. How many planks do you need?`;}},
    {lv:[2],f:n=>{const b=ri(2,6);return `There are ${n+b} holes in the roof, and ${b} of them are already fixed. One plank fixes one hole. How many planks do you need?`;}},
    {lv:[2,3],f:n=>{const ks=[2,3].filter(k=>n%k===0&&n/k>1);if(!ks.length)return null;const k=pick(ks);return `There are ${n/k} holes in the roof, and each hole needs ${k} planks. How many planks do you need?`;}},
    {lv:[3],f:n=>{const k=ri(2,4),h=Math.floor(n/k)+ri(1,2);const done=k*h-n;if(done<1)return null;return `There are ${h} holes, and each needs ${k} planks. ${done} planks are already nailed on. How many more planks do you need?`;}},
    {lv:[4,5],f:n=>{const c=ri(1,4);const f=facs(n*c);if(!f.length)return null;const [a,b]=pick(f);return `The hole in the roof is a rectangle ${a} m by ${b} m. One plank covers ${c} square meter${c>1?"s":""}. How many planks do you need?`;}},
    {lv:[5],f:n=>{for(let t=0;t<40;t++){const e=ri(2,4),T=n*e;const a=ri(2,4),b=ri(2,4);const rest=T-a*b;const f=facs(rest);if(rest>=4&&f.length){const [c,d]=pick(f);return `There are two holes: one is ${a} m by ${b} m, the other is ${c} m by ${d} m. One plank covers ${e} square meters. How many planks do you need?`;}}return null;}},
    {lv:[5,6],f:n=>{for(let t=0;t<40;t++){const q=pick([2,3,4,5,6]),p=ri(1,q-1);if(gcd(p,q)>1)continue;const e=ri(2,6),A=n*e*q;if(A%p)continue;const area=A/p;const f=facs(area).filter(([a,b])=>a>=3&&b<=20);if(!f.length)continue;const [a,b]=pick(f);
      return `The roof is ${a} m by ${b} m, and the storm blew away ${p}/${q} of it. One plank covers ${e} square meters. How many planks do you need?`;}return null;}},
    {lv:[6],f:n=>{for(let t=0;t<40;t++){const pc=pick([10,20,25,40,50,75]),e=ri(2,6);const A=n*e*100/pc;if(!Number.isInteger(A)||A>200)continue;return `The roof covers ${A} square meters, and ${pc}% of it blew away. One plank covers ${e} square meters. How many planks do you need?`;}return null;}},
    {lv:[7],f:n=>{for(let t=0;t<40;t++){const [r,u,s]=pick(TRIPLES),L=ri(2,8),e=ri(2,12);if(L*s!==n*e)continue;return `One side of the roof rises ${r} m over a run of ${u} m, and the roof is ${L} m long. The storm tore that whole side away. One plank covers ${e} square meters. How many planks do you need?`;}return null;}},
    {lv:[7,8],f:n=>{for(let t=0;t<60;t++){const b=ri(2,12),h=ri(2,10),e=ri(1,8);if(b*h%2||b*h/2!==n*e)continue;return `The triangle at the end of the roof (the gable) has a base of ${b} m and a height of ${h} m. It fell in. One plank covers ${e} square meter${e>1?"s":""}. How many planks do you need?`;}return null;}},
    {lv:[8],f:n=>{for(let t=0;t<80;t++){const [hh,half,s]=pick(TRIPLES),L=ri(2,6),e=ri(4,30);if(2*L*s!==n*e)continue;return `The cottage is ${2*half} m wide and ${L} m long, and the ridge of the roof is ${hh} m above the walls. Both sides of the roof must be replaced. One plank covers ${e} square meters. How many planks do you need?`;}return null;}},
  ]},
  patch:{m:"ferrum",unit:"plate",lo:2,hi:7,G:[
    {lv:[1],f:n=>{if(n<2)return null;const a=ri(1,n-1);return `There are ${a} holes in the front wall and ${n-a} in the side wall. One iron plate patches one hole. How many plates do you need?`;}},
    {lv:[2],f:n=>{const b=ri(2,6);return `The wall has ${n+b} cracks. ${b} are tiny and can be filled with mud. Each other crack needs one iron plate. How many plates do you need?`;}},
    {lv:[2,3],f:n=>{const ks=[2,3].filter(k=>n%k===0&&n/k>1);if(!ks.length)return null;const k=pick(ks);return `There are ${n/k} holes in the wall, and each needs ${k} iron plates. How many plates do you need?`;}},
    {lv:[3,4],f:n=>{const k=ri(2,5);return `A blacksmith cut ${n*k} small iron strips. Every ${k} strips make one plate, and one plate patches one hole. How many holes can you patch?`;}},
    {lv:[4,5],f:n=>{const c=ri(1,3);const f=facs(n*c);if(!f.length)return null;const [a,b]=pick(f);return `The hole in the wall is ${a} m by ${b} m. One iron plate covers ${c} square meter${c>1?"s":""}. How many plates do you need?`;}},
    {lv:[5,6],f:n=>{for(let t=0;t<60;t++){const e=ri(1,3),A=n*e,a=ri(3,6),b=ri(3,6),c=ri(1,a-1),d=ri(1,b-1);if(a*b-c*d!==A)continue;return `The hole is shaped like an L: a ${a} m by ${b} m rectangle with a ${c} m by ${d} m corner still standing. One iron plate covers ${e} square meter${e>1?"s":""}. How many plates do you need?`;}return null;}},
    {lv:[6],f:n=>{for(let t=0;t<60;t++){const b=ri(2,10),h=ri(2,10),e=ri(1,5);if(b*h%2||b*h/2!==n*e)continue;return `The hole is a triangle with a base of ${b} m and a height of ${h} m. One iron plate covers ${e} square meter${e>1?"s":""}. How many plates do you need?`;}return null;}},
    {lv:[6,7],f:n=>{for(let t=0;t<60;t++){const a=ri(1,4),b=ri(1,4),s=ri(2,3),e=ri(2,12);if(a*b*s*s!==n*e)continue;return `On the plan the hole is ${a} cm by ${b} cm, and 1 cm on the plan is ${s} m on the real wall. One iron plate covers ${e} square meters. How many plates do you need?`;}return null;}},
    {lv:[7],f:n=>{for(let t=0;t<60;t++){const [a,b,c]=pick(TRIPLES),e=ri(1,12);if(a*b/2!==n*e)continue;return `The hole is a right triangle. Its longest side is ${c} m and one of its other sides is ${a} m. One iron plate covers ${e} square meter${e>1?"s":""}. How many plates do you need?`;}return null;}},
    {lv:[8],f:n=>{for(let t=0;t<80;t++){const a=ri(2,8),b=ri(a+1,12),h=ri(2,6),e=ri(2,12);if((a+b)*h%2||(a+b)*h/2!==n*e)continue;return `The hole is a trapezoid: its parallel sides are ${a} m and ${b} m, and they are ${h} m apart. One iron plate covers ${e} square meters. How many plates do you need?`;}return null;}},
    {lv:[8],f:n=>{const r=pick([7,14]);const A=22*r*r/7;if(A%n)return null;return `The hole is a circle ${2*r} dm across. Use π = 22/7. One iron plate covers ${A/n} square dm. How many plates do you need?`;}},
  ]},
  fence:{m:"lignum",unit:"post",lo:3,hi:10,G:[
    {lv:[1],f:n=>{if(n<2)return null;const a=ri(1,n-1);return `The fence needs ${a} posts on one side of the garden and ${n-a} on the other. How many posts do you need?`;}},
    {lv:[2],f:n=>{const b=ri(2,5);return `The fence plan has ${n+b} posts. ${b} old posts are still good. How many new posts do you need?`;}},
    {lv:[2,3],f:n=>n%4===0?`The garden has 4 sides, and each side needs ${n/4} posts of its own. How many posts do you need?`:null},
    {lv:[3,4],f:n=>{const ks=[2,3,4].filter(k=>n%k===0&&n/k>1);if(!ks.length)return null;const k=pick(ks);return `${n/k} gardens each need ${k} new posts. How many posts do you need?`;}},
    {lv:[4,5],f:n=>{for(let t=0;t<40;t++){const s=ri(1,3),P=n*s;if(P%2)continue;const half=P/2/s;const a=ri(1,half-1)*s,b=P/2-a;if(a<1||b<1)continue;return `A fence goes all the way around a garden ${a} m by ${b} m. There is a post every ${s} m, with a post at every corner. How many posts do you need?`;}return null;}},
    {lv:[5,6],f:n=>{if(n<2)return null;const s=ri(2,4);return `A straight fence is ${(n-1)*s} m long. It has a post at each end and one every ${s} m. How many posts do you need?`;}},
    {lv:[6],f:n=>{for(let t=0;t<40;t++){const s=ri(1,3),L=(n-1)*s,b=ri(Math.ceil(2/s),4)*s,a=L-2*b;if(a<2||a<s)continue;return `The fence runs along three sides of a garden ${a} m wide and ${b} m deep — the cottage wall is the fourth side. It has a post at each end and one every ${s} m. How many posts do you need?`;}return null;}},
    {lv:[7],f:n=>{for(let t=0;t<40;t++){const [a,b,c]=pick(TRIPLES),k=ri(1,2),s=pick([1,2,3,4,6]);const P=(a+b+c)*k;if(P%s||P/s!==n)continue;if(a*k%s||b*k%s||c*k%s)continue;return `The garden is a right triangle with sides ${a*k} m and ${b*k} m around the square corner. A fence goes all the way around it, with a post every ${s} m and one at every corner. How many posts do you need?`;}return null;}},
    {lv:[8],f:n=>{for(let t=0;t<60;t++){const s=ri(1,3),P=n*s;if(P%2)continue;const half=P/2;const a=ri(2,half-2),b=half-a;if(b<2||a%s||b%s||a===b)continue;return `A rectangular garden has an area of ${a*b} square meters and is ${Math.max(a,b)} m long. A fence goes all the way around it, with a post every ${s} m and one at every corner. How many posts do you need?`;}return null;}},
    {lv:[8],f:n=>{for(let t=0;t<60;t++){const s=ri(1,2),side=n*s/4;if(!Number.isInteger(side)||side<2||side%s)continue;return `A square garden has an area of ${side*side} square meters. A fence goes all the way around it, with a post every ${s} m and one at every corner. How many posts do you need?`;}return null;}},
  ]},
};
function job(kind,lv){lv=Math.max(1,Math.min(8,lv||5));const J=JOBS[kind];
  for(let t=0;t<30;t++){const n=ri(J.lo,J.hi);for(const g of J.G.filter(g=>g.lv.includes(lv)).sort(()=>R()-.5)){const q=g.f(n);if(q)return {kind,m:J.m,unit:J.unit,n,text:q,lv};}}
  for(let t=0;t<30;t++){const n=ri(J.lo,J.hi);for(const g of J.G.filter(g=>g.lv.some(l=>Math.abs(l-lv)<=1)).sort(()=>R()-.5)){const q=g.f(n);if(q)return {kind,m:J.m,unit:J.unit,n,text:q,lv};}}
  const n=ri(J.lo,J.hi);return {kind,m:J.m,unit:J.unit,n,text:`You need ${n*2} ÷ 2 ${J.unit}s. How many is that?`,lv};}
// ---------- the contest board: "Try your hardest" problems in the style of real math contests ----------
// New problems written the way the Hardest Math Problem contest (story problems + writing, grades 5–8), AMC 8 and MATHCOUNTS write theirs —
// the real contests' problems belong to them, so these are our own, in the same spirit.
// Every answer is worked out by the code itself (counting, trying every case), never typed in by hand. Each comes with a hint and a short why.
const fact=k=>k<2?1:k*fact(k-1);const C2=(n,k)=>k<0||k>n?0:fact(n)/(fact(k)*fact(n-k));
const digs=x=>String(x).split("").map(Number);const dsum=x=>digs(x).reduce((a,b)=>a+b,0);
const count=(a,b,ok)=>{let c=0;for(let x=a;x<=b;x++)if(ok(x))c++;return c;};
const GIRLS=["Livia","Julia","Aurelia","Octavia"];
const TIERS={story:{name:"Try Your Hardest story problem",icon:"✍️",who:"grades 5–8",pay:20},amc8:{name:"AMC 8 style",icon:"🥇",who:"grades 5–8",pay:25},mathcounts:{name:"MATHCOUNTS style",icon:"🏆",who:"the hardest",pay:40}};
const CONTEST={story:[
  ()=>{for(;;){const p=pick([2,3,4]),c=pick([0.5,1,1.5]),F=pick([10,15,20,25]),G=pick([40,50,60,80,100]);const k=Math.ceil((G+F)/(p-c));if(p<=c)continue;return {q:`The Roman school is raising money for a trip. They will sell honey cakes for ${p} denarii each. Each cake costs ${c} denarii to bake, and the market charges ${F} denarii to rent a stall for the day. They want to make a profit of at least ${G} denarii. What is the smallest number of cakes they must sell?`,a:k,hint:"Each cake sold earns (price − cost). The stall rent has to be paid back first.",why:`Each cake earns ${p} − ${c} = ${p-c}. They need ${G} + ${F} = ${G+F}, and ${G+F} ÷ ${p-c} rounded UP is ${k}.`};}},
  ()=>{const S=ri(5,30),w=pick([4,5,6,8]),X=pick([60,80,100,120]),t=pick([10,20,25]);const total=X+X*t/100;const k=Math.ceil((total-S)/w);return {q:`${pick(GIRLS)} wants a new pair of boots that costs ${X} denarii, plus a ${t}% market tax. She already has ${S} denarii saved and saves ${w} more every week. After how many weeks will she first have enough?`,a:k,hint:"Find the price with tax first. Then how much more does she need?",why:`With tax the boots cost ${total}. She needs ${total-S} more, and ${total-S} ÷ ${w} rounded UP is ${k} weeks.`};},
  ()=>{for(;;){const a=pick([5,10,15]),m=pick([2,3,4]),b=pick([25,30,40,45,50]);if(b<=a)continue;const k=Math.floor((b-a)/m)+1;return {q:`Two message-runner plans: Plan A costs ${a} denarii a month plus ${m} denarii for every message. Plan B costs ${b} denarii a month with as many messages as you like. What is the smallest number of messages in a month that makes Plan B the cheaper plan?`,a:k,hint:"Write the cost of Plan A for m messages, then find when it goes above Plan B.",why:`Plan A costs ${a} + ${m}×messages. That is more than ${b} once messages > ${(b-a)/m}, so the smallest is ${k}.`};}},
  ()=>{const kids=ri(12,30),ad=ri(3,8),sl=8;const need=kids*3+ad*2;const k=Math.ceil(need/sl);return {q:`For a party, each pizza is cut into ${sl} slices. ${kids} children will each eat 3 slices and ${ad} adults will each eat 2 slices. What is the smallest number of whole pizzas to order?`,a:k,hint:"Count all the slices needed, then think about leftovers.",why:`${kids}×3 + ${ad}×2 = ${need} slices; ${need} ÷ ${sl} rounded UP is ${k}.`};},
  ()=>{const B=pick([200,300,400,600]),k=pick([4,5,10,20]),fee=pick([10,15,20,25]);const exp=B/k;const a=exp-fee;if(a<=0)return null;return {q:`An actuary studies risk. A bike costs ${B} denarii. Each year, 1 out of every ${k} bikes like it is stolen. A bike protection plan costs ${fee} denarii a year and pays for a new bike if it is stolen. On average, how many denarii per year does a bike owner save by buying the plan?`,a,hint:`If ${k} owners each lose a bike 1 time in ${k}, what is the average loss per owner?`,why:`Average loss = ${B} ÷ ${k} = ${exp} a year. The plan costs ${fee}, so on average it saves ${exp} − ${fee} = ${a}.`};},
  ()=>{const p=pick([8,12,16,20,24]);const A=3*p*3/4,Bc=2*p;const a=A-Bc;return {q:`Three scrolls cost ${p} denarii each. Shop A gives 25% off everything. Shop B says "buy 2, get the 3rd free". How many more denarii do the three scrolls cost at Shop A than at Shop B?`,a,hint:"Work out the full total at each shop, then subtract.",why:`Shop A: ${3*p} − 25% = ${A}. Shop B: you pay for 2 = ${Bc}. Difference: ${a}.`};},
  ()=>{const n=ri(50,130);let best=1e9;for(let b=0;b<=4;b++)for(let v=0;v<=12;v++)if(b*40+v*12>=n)best=Math.min(best,b*150+v*50);return {q:`${n} students are going on a field trip. A big wagon holds 40 students and costs 150 denarii. A small cart holds 12 students and costs 50 denarii. Everyone needs a seat. What is the lowest total cost?`,a:best,hint:"Compare the cost per seat, then check what to do with the students left over.",why:`Trying every mix of wagons and carts, the cheapest is ${best} denarii.`};},
  ()=>{const a=pick([8,10,12,15]),c=pick([4,5,6]);for(;;){const T=ri(20,40),k=ri(5,T-5);const R=a*(T-k)+c*k;const sol=[];for(let x=0;x<=T;x++)if(a*(T-x)+c*x===R)sol.push(x);if(sol.length===1)return {q:`The theatre sold ${T} tickets for ${R} denarii. Adult tickets cost ${a} denarii and child tickets cost ${c} denarii. How many child tickets were sold?`,a:sol[0],hint:"Pretend every ticket was an adult ticket. How much too much is that?",why:`All adult would be ${a*T}. Each child ticket is ${a-c} less: (${a*T} − ${R}) ÷ ${a-c} = ${sol[0]}.`};}},
  ()=>{const P=pick([100,200,400,500,1000]),r=pick([10,20]);const y1=P+P*r/100,y2=y1+y1*r/100;return {q:`${pick(NAMES)} puts ${P} denarii in a bank that adds ${r}% interest at the end of every year, and the interest also earns interest. How many denarii are in the account after 2 years?`,a:y2,hint:"The second year's interest is figured on the new, bigger amount.",why:`After 1 year: ${y1}. After 2 years: ${y1} + ${r}% of ${y1} = ${y2}.`};},
  ()=>{const k=pick([8,10,12,15]),D=pick([60,90,120,150]),f=pick([2,3,4]);if((2*D)%k)return null;const L=2*D/k;return {q:`A cart needs 1 jar of oil for every ${k} km. A round trip to the next town is ${D} km each way. Oil costs ${f} denarii a jar. How many denarii does the oil for the round trip cost?`,a:L*f,hint:"Don't forget to come back!",why:`${2*D} km ÷ ${k} = ${L} jars, and ${L} × ${f} = ${L*f}.`};},
  ()=>{const w=ri(4,12),l=w+ri(2,10),c=pick([3,4,5]),g=pick([1,2]);const per=2*(l+w)-g*2;return {q:`A garden is ${l} m long and ${w} m wide. A fence goes all the way around, except for a gate ${g*2} m wide. Fencing costs ${c} denarii per metre. How much does the fencing cost?`,a:per*c,hint:"Find the perimeter, take away the gate, then multiply by the price.",why:`Perimeter ${2*(l+w)} − ${g*2} = ${per} m, and ${per} × ${c} = ${per*c}.`};},
  ()=>{const cost=pick([12,15,18,24,30]),pc=pick([25,30,40,50]),cups=pick([2,3]);const per=cups;const days=Math.ceil(cost/per);return {q:`${pick(GIRLS)} spends ${cost} denarii on lemons and honey for a lemonade stand. She makes ${per} denarii of profit each day. After how many days has she earned back what she spent?`,a:days,hint:"This point is called breaking even.",why:`${cost} ÷ ${per} rounded UP is ${days} days.`};},
],amc8:[
  ()=>{const n=ri(6,10);const w=[1,1];for(let i=2;i<=n;i++)w[i]=w[i-1]+w[i-2];return {q:`A frog hops up a staircase of ${n} steps. Each hop goes up 1 step or 2 steps. In how many different ways can it reach the top?`,a:w[n],hint:"To land on the top step, the last hop came from one step below or two steps below.",why:`Ways(n) = Ways(n−1) + Ways(n−2): 1, 2, 3, 5, 8, … gives ${w[n]} for ${n} steps.`};},
  ()=>{const A=ri(1,30),B=A+ri(60,150);const a=count(A,B,x=>x%3===0||x%5===0);return {q:`How many whole numbers from ${A} to ${B} (including both) are multiples of 3 or of 5?`,a,hint:"Count multiples of 3, add multiples of 5, then take away the multiples of 15 you counted twice.",why:`Counting carefully gives ${a}.`};},
  ()=>{const S=ri(4,12);const a=count(100,999,x=>dsum(x)===S);return {q:`How many three-digit numbers have digits that add up to ${S}?`,a,hint:"Choose the hundreds digit first (it can't be 0), then count what's left.",why:`Going through every hundreds digit gives ${a}.`};},
  ()=>{const a5=ri(70,85),b=a5+ri(1,3);const x=6*b-5*a5;if(x>100)return null;return {q:`The average of ${pick(GIRLS)}'s first five test scores is ${a5}. After the sixth test, the average of all six is ${b}. What did she score on the sixth test?`,a:x,hint:"Turn each average into a total.",why:`6 × ${b} − 5 × ${a5} = ${6*b} − ${5*a5} = ${x}.`};},
  ()=>{const m=ri(2,4),n=ri(3,5);const a=C2(m+1,2)*C2(n+1,2);return {q:`How many rectangles of any size are there in a ${m} × ${n} grid of little squares? (Squares count as rectangles.)`,a,hint:"A rectangle is chosen by picking 2 of the vertical lines and 2 of the horizontal lines.",why:`${m+1} lines choose 2 is ${C2(m+1,2)}, ${n+1} lines choose 2 is ${C2(n+1,2)}, and ${C2(m+1,2)} × ${C2(n+1,2)} = ${a}.`};},
  ()=>{const m=ri(3,5),n=ri(2,4);const a=C2(m+n,m);return {q:`A Roman street map is a grid. You walk from one corner to the opposite corner, ${m} blocks east and ${n} blocks north, never going west or south. How many different routes are there?`,a,hint:`Every route is a list of ${m} E's and ${n} N's in some order.`,why:`Choose which ${n} of the ${m+n} moves are N: ${a}.`};},
  ()=>{const A=ri(100,400),B=A+ri(100,300);const a=count(A,B,x=>{const t=String(x);return t===t.split("").reverse().join("");});return {q:`A palindrome reads the same forwards and backwards, like 353. How many palindromes are there from ${A} to ${B}?`,a,hint:"A three-digit palindrome is fixed once you choose its first two digits.",why:`Listing them gives ${a}.`};},
  ()=>{const [w,d,w2]=pick([[3,12,4],[4,9,6],[6,10,5],[5,12,6],[8,6,12],[2,15,3]]);const a=w*d/w2;return {q:`${w} builders can build a wall in ${d} days. How many days would ${w2} builders take, working at the same speed?`,a,hint:"First find how many builder-days the wall takes.",why:`${w} × ${d} = ${w*d} builder-days, and ${w*d} ÷ ${w2} = ${a}.`};},
  ()=>{const k=pick([4,6,8,9,10,12]);let a=1;while((()=>{let c=0;for(let i=1;i<=a;i++)if(a%i===0)c++;return c;})()!==k)a++;return {q:`What is the smallest positive whole number that has exactly ${k} divisors?`,a,hint:"Try small numbers that are products of small primes.",why:`Checking numbers in order, ${a} is the first with ${k} divisors.`};},
  ()=>{const [x,y]=pick([[3,6],[4,12],[6,12],[10,15],[12,24],[6,30]]);const a=2*x*y/(x+y);return {q:`${pick(NAMES)} rides to the market at ${x} km per hour and rides back home the same way at ${y} km per hour. What is the average speed for the whole trip, in km per hour?`,a,hint:`It is NOT ${(x+y)/2}! Pick a distance and find the total time.`,why:`For a trip of ${x*y} km each way: ${y} h there, ${x} h back, ${2*x*y} km in ${x+y} hours = ${a} km/h.`};},
  ()=>{const S=ri(11,25);let best=0;for(let a=1;a<S;a++)best=Math.max(best,a*(S-a));return {q:`Two positive whole numbers add up to ${S}. What is the largest their product can be?`,a:best,hint:"Make the two numbers as close together as you can.",why:`${Math.floor(S/2)} × ${Math.ceil(S/2)} = ${best}.`};},
],mathcounts:[
  ()=>{for(;;){const a=ri(2,5),b=ri(a+1,7),N=ri(30,60);const c=[];for(let x=1;a*x<N;x++)if((N-a*x)%b===0)c.push(x);if(c.length>=2)return {q:`How many pairs of positive whole numbers (x, y) make ${a}x + ${b}y = ${N} true?`,a:c.length,hint:`Try each x and see whether ${N} − ${a}x is a multiple of ${b}.`,why:`x = ${c.join(", ")} work, so there are ${c.length}.`};}},
  ()=>{const N=pick([60,90,100,120,150,200]);const a=count(1,N,x=>x%2&&x%3&&x%5);return {q:`How many of the whole numbers from 1 to ${N} are divisible by none of 2, 3 and 5?`,a,hint:"In every block of 30 numbers, the pattern repeats.",why:`Counting gives ${a}.`};},
  ()=>{const N=pick([24,30,36,48,60,72,84,90,96,100]);let a=0;for(let i=1;i<=N;i++)if(N%i===0)a+=i;return {q:`What is the sum of all the positive divisors of ${N}, including 1 and ${N}?`,a,hint:"List the divisors in pairs that multiply to the number.",why:`The divisors add up to ${a}.`};},
  ()=>{const N=pick([20,25,30,35,40,45,50]);let a=0;for(let d=0;10*d<=N;d++)for(let f=0;10*d+5*f<=N;f++)a++;return {q:`How many ways can you make ${N} cents using any number of 1-cent, 5-cent and 10-cent coins?`,a,hint:"Choose how many 10s, then how many 5s — the 1s fill the rest.",why:`Counting every choice of 10s and 5s gives ${a}.`};},
  ()=>{const N=pick([50,60,80,100,120]);const a=count(1,N,n=>(n*n+1)%5===0);return {q:`For how many whole numbers n from 1 to ${N} is n² + 1 a multiple of 5?`,a,hint:"Only the last digit of n matters. Which last digits work?",why:`n must end in 2, 3, 7 or 8; that gives ${a}.`};},
  ()=>{const w=pick(["ROMA","LEGIO","AMICA","MARCUS","ITALIA","CASTRA","OPPIDUM"]);const c={};for(const ch of w)c[ch]=(c[ch]||0)+1;const a=Object.values(c).reduce((t,k)=>t/fact(k),fact(w.length));return {q:`How many different arrangements are there of the letters in the word ${w}?`,a,hint:"Count as if every letter were different, then divide for the letters that repeat.",why:`${w.length}! = ${fact(w.length)}${Object.values(c).some(k=>k>1)?`, divided for the repeated letters,`:""} gives ${a}.`};},
  ()=>{const r=ri(2,4);let a=0;for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)if(x*x+y*y<=r*r)a++;return {q:`How many points (x, y) with both x and y whole numbers (they can be negative or zero) lie inside or on the circle x² + y² = ${r*r}?`,a,hint:"Go row by row: for each y, which x work?",why:`Row by row the count is ${a}.`};},
  ()=>{const N=ri(20,60);const a=powmod(3,N,100);return {q:`What are the last two digits of 3^${N}? (Answer as a number; for example, 07 means 7.)`,a,hint:"Watch the last two digits of 3, 9, 27, 81, 43, … — they repeat after 20 steps.",why:`The last two digits repeat every 20 powers; 3^${N} ends in ${String(a).padStart(2,"0")}.`};},
  ()=>{const N=pick([20,25,30,40,50,99]);let a=0;for(let x=1;x<=N;x++)a+=dsum(x);return {q:`Write down every whole number from 1 to ${N}. What is the sum of all the digits you wrote?`,a,hint:"Add the ones digits and the tens digits separately.",why:`Adding every digit gives ${a}.`};},
  ()=>{const n=ri(5,9);let a=0;for(let m=0;m<(1<<n);m++)if(!(m&(m>>1)))a++;return {q:`How many subsets of {1, 2, 3, …, ${n}} have no two numbers that are next to each other? (The empty set counts.)`,a,hint:"Either n is in the set or it isn't — each case looks like a smaller problem.",why:`The counts follow 2, 3, 5, 8, …; for ${n} it is ${a}.`};},
  ()=>{const k=ri(2,5);const a=C2(9,k);return {q:`How many ${k}-digit numbers have digits that get strictly bigger from left to right (like 1 3 7)?`,a,hint:"0 can't be used. Once you choose which digits, the order is forced.",why:`Choose ${k} of the digits 1–9: ${a}.`};},
  ()=>{const N=pick([200,300,500,1000]);const a=count(1,N,x=>{const r=Math.round(Math.sqrt(x));const q=Math.round(Math.cbrt(x));return r*r===x||q*q*q===x;});return {q:`How many whole numbers from 1 to ${N} are perfect squares or perfect cubes (or both)?`,a,hint:"Squares + cubes − the ones that are both (sixth powers).",why:`Counting gives ${a}.`};},
]};
function contest(tier){const L=CONTEST[tier]||CONTEST.amc8;for(let t=0;t<40;t++){const r=pick(L)();if(r&&Number.isInteger(r.a)&&r.a>=0)return {tier,...r};}return null;}
const tierFor=lv=>lv<=6?"story":lv<=7?"amc8":"mathcounts";
return {MATERIALS,CORES,RECIPES,LEVELS,draw,check,problem,amount,coreClue,coreByNum,pairClue,deal,job,JOBS,TIERS,CONTEST,contest,tierFor,CN,levelName,get style(){return STYLE;},set style(v){STYLE=v==="china"?"china":"us";}};
})();
if(typeof module!=="undefined")module.exports=CRAFT;
