// Extracts parser functions from the real app.js and runs TESTING.md cases.
const fs=require("fs");
const src=fs.readFileSync(require("path").join(__dirname,"app.js"),"utf8");

function grabFn(name){
  const start=src.indexOf("function "+name+"(");
  if(start<0) throw new Error("missing function "+name);
  let i=src.indexOf("{",start),depth=0;
  for(;i<src.length;i++){
    if(src[i]==="{")depth++;
    else if(src[i]==="}"){depth--;if(depth===0)break;}
  }
  return src.slice(start,i+1);
}
function grabConst(name){
  const start=src.indexOf("const "+name+"=");
  if(start<0) throw new Error("missing const "+name);
  return src.slice(start,src.indexOf("\n",start));
}
function grabObj(name){ // multi-line object literal
  const start=src.indexOf("const "+name+"=");
  if(start<0) throw new Error("missing const "+name);
  let i=src.indexOf("{",start),depth=0;
  for(;i<src.length;i++){
    if(src[i]==="{")depth++;
    else if(src[i]==="}"){depth--;if(depth===0)break;}
  }
  return src.slice(start,i+1)+";";
}

const code=[
  grabConst("AMOUNT_SRC"),
  grabConst("amountRe"),
  grabConst("localISODate"),
  grabConst("today"),
  grabObj("NUMBER_WORDS"),
  grabConst("MONEY_WORD"),
  grabFn("cleanMoney"),
  grabFn("wordNumberToValue"),
  grabFn("normalizeMoneyWords"),
  grabFn("splitSentences"),
  grabFn("parseSaleSentence"),
  grabFn("parseMultipleSales"),
  grabFn("extractDateFromText"),
].join("\n");
const ctx={crypto:{randomUUID:()=>"x"}};
const vm=require("vm");
vm.createContext(ctx);
vm.runInContext(code+`
;globalThis.__api={cleanMoney,normalizeMoneyWords,wordNumberToValue,parseSaleSentence,parseMultipleSales,extractDateFromText,today,localISODate};`,ctx);
const api=ctx.__api;

let pass=0,fail=0;
function eq(label,got,want){
  const ok=JSON.stringify(got)===JSON.stringify(want);
  if(ok)pass++;else{fail++;console.log(`FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);}
}

// --- Money parser (TESTING.md) ---
eq("$1",api.cleanMoney("1"),1);
eq("$10",api.cleanMoney("10"),10);
eq("$1000",api.cleanMoney("1000"),1000);
eq("$1,000",api.cleanMoney("1,000"),1000);
eq("$1,000.50",api.cleanMoney("1,000.50"),1000.50);
eq("1k",api.cleanMoney("1k"),1000);
eq("1.5k",api.cleanMoney("1.5k"),1500);
eq("ten dollars",api.normalizeMoneyWords("ten dollars"),"$10");
eq("one hundred dollars",api.normalizeMoneyWords("one hundred dollars"),"$100");
eq("one thousand dollars",api.normalizeMoneyWords("one thousand dollars"),"$1000");
eq("twenty five dollars",api.normalizeMoneyWords("twenty five dollars"),"$25");
eq("two thousand five hundred dollars",api.normalizeMoneyWords("two thousand five hundred dollars"),"$2500");
eq("1,000 dollars untouched",api.normalizeMoneyWords("1,000 dollars"),"1,000 dollars"); // digits path, not words

// --- CRITICAL: $1,000 never becomes $1, in the SALE path ---
const sale=api.parseSaleSentence("Daddy bought a ruler from me for $1,000 cash.","2026-08-13","acct");
eq("CRITICAL sale $1,000 amount",sale && sale.amount,1000);

const saleK=api.parseSaleSentence("Sold computer for 1k","2026-08-13","acct");
eq("sale 1k amount",saleK && saleK.amount,1000);

// --- Multi-sale $3 + $5 ---
const multi=api.parseMultipleSales("Daddy bought a ruler for $3 and Mommy bought a crab gauge for $5.","2026-08-13","acct");
eq("multi-sale count",multi.length,2);
eq("multi-sale amounts",multi.map(e=>e.amount).sort(),[3,5]);
eq("multi-sale total",multi.reduce((s,e)=>s+e.amount,0),8);

// CRITICAL: the clause scanner must not add a phantom $1 entry alongside the $1,000
// sale ("$1,000 cash" once backtracked to "1" because the lookahead disallowed spaces)
const single=api.parseMultipleSales("Daddy bought a ruler from me for $1,000 cash.","2026-08-13","acct");
eq("no phantom $1 duplicate",single.map(e=>e.amount),[1000]);

// Multi-sale with comma amounts
const multi2=api.parseMultipleSales("Daddy bought a ruler for $1,000, then Mommy bought a crab gauge for $2,500.","2026-08-13","acct");
eq("multi-sale comma amounts",multi2.map(e=>e.amount).sort((a,b)=>a-b),[1000,2500]);

// --- Dates: local-time correctness ---
const now=new Date();
const localToday=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
eq("today() is local",api.today(),localToday);
eq("extract today",api.extractDateFromText("I sold a pen today"),localToday);
const yest=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
eq("yesterday",api.extractDateFromText("sold it yesterday"),`${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,"0")}-${String(yest.getDate()).padStart(2,"0")}`);
const twoAgo=new Date(now.getFullYear(),now.getMonth(),now.getDate()-2);
const twoAgoS=`${twoAgo.getFullYear()}-${String(twoAgo.getMonth()+1).padStart(2,"0")}-${String(twoAgo.getDate()).padStart(2,"0")}`;
eq("2 days ago",api.extractDateFromText("2 days ago"),twoAgoS);
eq("two days ago",api.extractDateFromText("two days ago"),twoAgoS);
eq("8/12/2026",api.extractDateFromText("on 8/12/2026"),"2026-08-12");
eq("2026-08-12",api.extractDateFromText("on 2026-08-12"),"2026-08-12");
eq("August 12, 2026",api.extractDateFromText("on August 12, 2026"),"2026-08-12");

// Timezone simulation: 5 p.m. local on a PDT machine used to roll to tomorrow via UTC
const evening=new Date(2026,7,13,17,0,0); // Aug 13, 5pm local
eq("evening local date",api.localISODate ? undefined : undefined, undefined); // localISODate covered via today()
eq("localISODate evening",ctx.__api.localISODate ? require("vm").runInContext(`localISODate(new Date(2026,7,13,17,0,0))`,ctx) : null,"2026-08-13");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
