import json, urllib.request, sqlite3
B="http://127.0.0.1:5000"; H={"Host":"play.hardywu.com","X-Forwarded-Proto":"https","Content-Type":"application/json","UCP-Agent":'profile="https://muse.ai/profile"'}
def call(m,path,body=None):
    r=urllib.request.Request(B+path,data=json.dumps(body).encode() if body is not None else None,headers=H,method=m)
    try: resp=urllib.request.urlopen(r); raw=resp.read(); code=resp.status
    except urllib.error.HTTPError as e: raw=e.read(); code=e.code
    try: return code, json.loads(raw)
    except Exception as ex:
        i=int(str(ex).split("char ")[-1].rstrip(")")) if "char" in str(ex) else 0
        print("  RAW PROBLEM:", ex, "->", repr(raw[max(0,i-80):i+40])); return code, None
ok=lambda c,m: print(("PASS" if c else "FAIL")+" — "+m)
c,d=call("POST","/ucp/checkout-sessions",{"line_items":[{"item":{"id":"crab-gauge__black"},"quantity":2}]})
ok(c==201 and d and d["status"]=="incomplete","create: 201 incomplete, missing "+str([m.get("path") for m in (d or {}).get("messages",[]) if m["type"]=="error"]))
sid=d["id"]
c,d=call("POST",f"/ucp/checkout-sessions/{sid}/complete"); ok(d["status"]=="incomplete","complete too early stays incomplete")
c,d=call("PUT",f"/ucp/checkout-sessions/{sid}",{"line_items":[{"id":"li_1","item":{"id":"crab-gauge__black"},"quantity":2}],"buyer":{"first_name":"Jane","last_name":"Doe","email":"jane@example.com","phone_number":"+16175550100"},"fulfillment":{"methods":[{"id":"shipping","type":"shipping","selected_destination_id":"dest_1","destinations":[{"id":"dest_1","type":"shipping_address","street_address":"1 Main St","address_locality":"Boston","address_region":"MA","postal_code":"02101","address_country":"US"}]}]}})
ok(d["status"]=="ready_for_complete" and d["totals"][-1]["amount"]==1500,"update → ready_for_complete, total 1500 cents")
c,d=call("POST",f"/ucp/checkout-sessions/{sid}/complete"); ok(d["status"]=="completed" and d.get("order"),"complete → completed with order "+str(d.get("order")))
oid=d["order"]["id"]
c,d=call("GET",f"/ucp/orders/{oid}"); ok(d and d.get("status")=="ordered","GET order → ordered")
c,d=call("GET",f"/ucp/checkout-sessions/{sid}"); ok(d["status"]=="completed","GET session stays completed")
c,d=call("POST",f"/ucp/checkout-sessions",{"line_items":[{"item":{"id":"crab-gauge"},"quantity":1}]}); ok(any("colour" in m["content"] for m in d["messages"]),"no colour → asks for a colour variant")
c,d=call("POST",f"/ucp/checkout-sessions/{sid}/cancel"); ok(d["status"]=="completed","cancel after complete does nothing")
con=sqlite3.connect(__import__("os").path.join(__import__("os").path.dirname(__file__),"..","data","bookkeep_v13.db")); r=con.execute("select buyer,buyer_email,source,agent,ship_to,total,color from orders where id=?",(oid,)).fetchone(); print("   DB row:",r,"| job:",con.execute("select status from print_jobs where order_id=?",(oid,)).fetchone())
ok(r and r[2]=="agent" and "Boston" in r[4] and r[5]==15.0,"order saved with agent, address, total")
con.execute("delete from print_jobs where order_id=?",(oid,)); con.execute("delete from orders where id=?",(oid,)); con.execute("delete from ucp_sessions"); con.commit(); print("   cleaned")
import urllib.request as u
print("   permalink /order/<id> (after delete → 404 expected):", u.urlopen(u.Request(B+"/order/"+oid,headers=H)).status if False else "skipped")
