"""UCP end-to-end: MCP tools → cart (add/remove) → checkout → buyer approval page → order. Cleans up after itself.
Run from corporate/: .venv/bin/python tests/ucp_flow.py   (server on 127.0.0.1:5000)"""
import json, os, urllib.request, urllib.error, sqlite3, http.cookiejar
B="http://127.0.0.1:5000"; DB=os.path.join(os.path.dirname(__file__),"..","data","bookkeep_v13.db")
HP={"Host":"play.hardywu.com","X-Forwarded-Proto":"https","Content-Type":"application/json"}
ok=lambda c,m: print(("PASS" if c else "FAIL")+" — "+m)
def http(m,path,body=None,headers=HP,opener=None):
    r=urllib.request.Request(B+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=m)
    try: resp=(opener or urllib.request).urlopen(r) if opener is None else opener.open(r); return resp.status, resp.read()
    except urllib.error.HTTPError as e: return e.code, e.read()
n=[0]
def rpc(method,params=None):
    n[0]+=1; c,raw=http("POST","/ucp/mcp",{"jsonrpc":"2.0","id":n[0],"method":method,"params":params or {}}); return json.loads(raw) if raw else None
def tool(name,args): r=rpc("tools/call",{"name":name,"arguments":{"meta":{"ucp-agent":{"profile":"https://muse.ai/profile"}},**args}}); return r["result"]["structuredContent"]
# profile
c,raw=http("GET","/.well-known/ucp"); prof=json.loads(raw)["ucp"]
ok([s["transport"] for s in prof["services"]["dev.ucp.shopping"]]==["rest","mcp"] and "dev.ucp.shopping.cart" in prof["capabilities"],"profile advertises REST + MCP and the cart capability")
# MCP handshake
init=rpc("initialize",{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test"}}); ok(init["result"]["serverInfo"]["name"].startswith("Hardy"),"MCP initialize")
c,raw=http("POST","/ucp/mcp",{"jsonrpc":"2.0","method":"notifications/initialized"}); ok(c==202,"MCP initialized notification → 202")
tools=rpc("tools/list")["result"]["tools"]; ok(len(tools)==13 and any(t["name"]=="update_cart" for t in tools),f"tools/list has {len(tools)} tools")
# search + cart add/remove via MCP
s=tool("search_catalog",{"catalog":{"query":"ruler"}}); ok([p["id"] for p in s["products"]]==["dual-ruler"],"search_catalog 'ruler' → dual-ruler")
cart=tool("create_cart",{"cart":{"line_items":[{"item":{"id":"crab-gauge__black"},"quantity":2},{"item":{"id":"dual-ruler__blue"},"quantity":1}]}})
ok(cart["id"].startswith("cart_") and cart["totals"][-1]["amount"]==2000,"create_cart with 2 items → estimated total 2000 (incl. shipping)")
cart=tool("update_cart",{"id":cart["id"],"cart":{"line_items":[{"id":"li_1","item":{"id":"crab-gauge__black"},"quantity":3}]}})
ok(len(cart["line_items"])==1 and cart["line_items"][0]["quantity"]==3,"update_cart: ruler removed, crab gauge now 3")
c2=tool("update_cart",{"id":cart["id"],"cart":{"line_items":[{"id":"li_1","item":{"id":"crab-gauge__black"},"quantity":3},{"item":{"id":"customizable-lunchbox__red"},"quantity":1}]}})
ok(any(m["code"]=="out_of_stock" for m in c2["messages"]) and len(c2["line_items"])==1,"adding the sold-out lunchbox is refused with out_of_stock")
# checkout from the cart
chk=tool("create_checkout",{"checkout":{"cart_id":cart["id"],"buyer":{"first_name":"Jane","last_name":"Doe","email":"jane@example.com","phone_number":"+16175550100"},
      "fulfillment":{"methods":[{"type":"shipping","destinations":[{"street_address":"1 Main St","address_locality":"Boston","address_region":"MA","postal_code":"02101","address_country":"US"}]}]}}})
ok(chk["status"]=="requires_escalation" and ("/approve/"+chk["id"]+"?code=") in chk["continue_url"] and any(m.get("severity")=="requires_buyer_review" for m in chk["messages"]),
   "create_checkout from cart → requires_escalation with continue_url (buyer must approve)")
ok(chk["line_items"][0]["quantity"]==3 and chk["totals"][-1]["amount"]==2000,"checkout took the cart's lines: 3 × crab gauge + shipping = 2000")
same=tool("create_checkout",{"checkout":{"cart_id":cart["id"]}}); ok(same["id"]==chk["id"],"second create_checkout for the same cart returns the same session")
done=tool("complete_checkout",{"id":chk["id"]}); ok(done["status"]=="requires_escalation" and not done.get("order"),"complete_checkout does NOT place the order by itself")
# the human side. The link carries a private code (lives with the checkout); the buyer must also be signed in with the buyer email.
HA={"Host":"play.hardywu.com","X-Forwarded-Proto":"https"}
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
_nr=urllib.request.build_opener(_NoRedirect)
def get(path,cookie=""):
    try: r=_nr.open(urllib.request.Request(B+path,headers={**HA,**({"Cookie":cookie} if cookie else {})})); return r.status,r.headers,r.read()
    except urllib.error.HTTPError as e: return e.code,e.headers,e.read()
ok("?code=" in chk["continue_url"],"continue_url carries a code")
c,h,raw=get("/approve/"+chk["id"]); ok(c==403 and b"expired" in raw,"link without the code shows nothing (403, 'expired')")
fresh=tool("get_checkout",{"id":chk["id"]}); ok(fresh["continue_url"]==chk["continue_url"],"get_checkout returns the same private link")
c,h,raw=get(fresh["continue_url"].replace("https://play.hardywu.com","")); setc="; ".join(x.split(";")[0] for x in (h.get_all("Set-Cookie") or []))
ok(c==302 and "next=/approve/" in h.get("Location",""),"fresh link, not signed in → sent to sign in, unlock remembered")
HL={"Host":"logbook.hardywu.com","X-Forwarded-Proto":"https","Content-Type":"application/json"}
def login(cookie):
    r=urllib.request.Request(B+"/api/visitor",data=json.dumps({"name":"Jane Doe","email":"jane@example.com","next":"/"}).encode(),headers={**HL,"Cookie":cookie},method="POST")
    resp=urllib.request.urlopen(r); ck="; ".join(x.split(";")[0] for x in (resp.headers.get_all("Set-Cookie") or [])) or cookie; j=json.loads(resp.read())
    if j.get("code"):
        r=urllib.request.Request(B+"/api/verify",data=json.dumps({"code":j["code"]}).encode(),headers={**HL,"Cookie":ck},method="POST")
        resp=urllib.request.urlopen(r); ck="; ".join(x.split(";")[0] for x in (resp.headers.get_all("Set-Cookie") or [])) or ck
    return ck
COOKIE=login(setc)
c,h,raw=get("/approve/"+chk["id"],COOKIE); ok(c==200 and b"Approve and order" in raw and "3 × Blue Crab Gauge".encode() in raw,"signed-in buyer, unlocked earlier → sees summary + Approve (no code needed now)")
# an expired code must not unlock a different browser
import time; con0=sqlite3.connect(DB); d0=json.loads(con0.execute("select data from ucp_sessions where id=?",(chk["id"],)).fetchone()[0]); d0["_code"]["exp"]=time.time()-1
con0.execute("update ucp_sessions set data=? where id=?",(json.dumps(d0),chk["id"])); con0.commit(); con0.close()
c,h,raw=get("/approve/%s?code=%s"%(chk["id"],d0["_code"]["code"])); ok(c==403,"an expired code is refused")
r=urllib.request.Request(B+"/approve/"+chk["id"],data=b"decision=approve",headers={**HA,"Cookie":COOKIE,"Content-Type":"application/x-www-form-urlencoded"},method="POST")
try: resp=urllib.request.urlopen(r); raw=resp.read()
except urllib.error.HTTPError as e: raw=e.read(); print("   approve POST failed:",e.code,raw[:200])
ok(b"Approved" in raw,"buyer presses Approve → order placed")
fin=tool("get_checkout",{"id":chk["id"]}); ok(fin["status"]=="completed" and fin.get("order",{}).get("id","").startswith("O_"),"agent polls get_checkout → completed with order "+str(fin.get("order",{}).get("id")))
oid=fin["order"]["id"]; o=tool("get_order",{"id":oid}); ok(o["status"]=="ordered","get_order → ordered")
con=sqlite3.connect(DB); row=con.execute("select buyer,buyer_email,agent,ship_to,total,custom_text from orders where id=?",(oid,)).fetchone(); print("   DB:",row)
ok(row and row[2]=="https://muse.ai/profile" and "approved by jane@example.com" in row[5],"order records the agent and who approved")
# REST cart still works
c,raw=http("POST","/ucp/carts",{"line_items":[{"item":{"id":"dual-ruler__red"},"quantity":1}]}); ok(c==201,"REST POST /ucp/carts → 201")
# cleanup
ids=[r[0] for r in con.execute("select id from orders where buyer_email='jane@example.com'")]
for i in ids: con.execute("delete from print_jobs where order_id=?",(i,)); con.execute("delete from orders where id=?",(i,))
con.execute("delete from ucp_sessions"); con.execute("delete from ucp_carts"); con.execute("delete from members where email='jane@example.com'"); con.commit()
act=os.path.join(os.path.dirname(DB),"activity.json")
try: d=json.load(open(act)); d["people"].pop("jane@example.com",None); json.dump(d,open(act,"w"))
except Exception: pass
print("   cleaned:",len(ids),"test order(s), sessions, carts, test person")
