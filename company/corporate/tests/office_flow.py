"""Office (office.hardywu.com): staff list, roles, staff sign-in rules and Google sign-in.
Runs in-process on a COPY of the database, so nothing real changes:
    .venv/bin/python tests/office_flow.py        (from corporate/)
Pass = no FAIL lines."""
import os, sys, shutil, tempfile, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
tmp = tempfile.mkdtemp(); shutil.copy(os.path.join(ROOT, "data", "bookkeep_v13.db"), tmp)
os.environ.update(BOOKKEEP_DATA_DIR=tmp, GOOGLE_CLIENT_ID="test-client", GOOGLE_CLIENT_SECRET="x")
sys.path.insert(0, ROOT); os.chdir(ROOT)
import server
app = server.app
EB = {"REMOTE_ADDR": "203.0.113.5"}                     # a visitor from the internet, not this Mac
OFF, BK, SITE = "https://office.hardywu.com", "https://bookkeep.hardywu.com", "https://hardywu.com"
fails = 0
def ok(cond, label):
    global fails; fails += not cond; print(("PASS " if cond else "FAIL ") + label)
def client(**sess):
    c = app.test_client()
    if sess:
        with c.session_transaction(base_url=OFF) as s: s.update(sess)
    return c
def who(name, email, **extra):
    d = dict(authed=True, name=name, email=email, v_name=name, v_email=email, signed_at=time.time(), staff_epoch=0); d.update(extra); return d
def get(c, path, base=OFF): return c.get(path, base_url=base, environ_base=EB)
def post(c, path, body, base=OFF): return c.post(path, json=body, base_url=base, environ_base=EB)
cust = lambda: client(**who("Some Customer", "cust@example.com", staff_epoch=None))

r = get(client(), "/"); ok("Email me a code" in r.text and "Continue with Google" in r.text, "signed out → sign-in page")
r = get(cust(), "/"); ok("isn't on the staff list" in r.text and "Every order" not in r.text, "customer → 'staff only'")
r = get(client(**who("Hardy Wu", "stranger@example.com", staff_epoch=None)), "/"); ok("isn't on the staff list" in r.text, "typing Hardy's name is not enough")
hardy = client(**who("Hardy Wu", "wuhardy0@gmail.com"))
r = get(hardy, "/"); ok("Every order" in r.text and 'id="staff"' in r.text, "owner → all tools + staff list")
r = get(client(**who("Hardy Wu", "wuhardy0@gmail.com", signed_at=time.time() - 8 * 86400)), "/"); ok("Email me a code" in r.text, "staff sign-in older than 7 days → signed out")
r = get(cust(), "/api/staff"); ok(r.status_code == 403, "customer can't read the staff list")
r = get(cust(), "/orders", SITE); ok(r.status_code == 403, "customer can't open the orders page")
ok(post(hardy, "/api/staff", {"email": "helper@example.com", "name": "Helper", "role": "printer"}).status_code == 200, "owner adds a printer")
helper = client(**who("Helper", "helper@example.com"))
r = get(helper, "/"); ok("Print queue" in r.text and "Every order" not in r.text and "Costs" not in r.text, "printer sees only the print queue and store")
ok(get(helper, "/api/print-jobs", BK).status_code == 200 and get(helper, "/api/orders", BK).status_code == 403, "printer: queue yes, orders no")
post(hardy, "/api/staff", {"email": "helper@example.com", "role": "manager"})
ok(get(helper, "/api/orders", BK).status_code == 200 and get(helper, "/api/staff").status_code == 403, "manager: orders yes, staff list no")
post(hardy, "/api/staff/signout-all", {"email": "helper@example.com"})
ok("Email me a code" in get(helper, "/").text, "owner signs a helper out everywhere")
ok(post(hardy, "/api/staff/remove", {"email": "wuhardy0@gmail.com"}).status_code == 400, "can't remove yourself")
barb = client(**who("Jun Tao", "barbaratao@gmail.com"))
post(barb, "/api/staff", {"email": "wuhardy0@gmail.com", "role": "manager"})
ok(post(barb, "/api/staff", {"email": "barbaratao@gmail.com", "role": "manager"}).status_code == 400, "the last owner can't step down")
post(barb, "/api/staff", {"email": "wuhardy0@gmail.com", "role": "owner"}); post(barb, "/api/staff/remove", {"email": "helper@example.com"})
post(hardy, "/api/staff/signout-all", {})
ok("Every order" in get(hardy, "/").text, "'sign out other devices' keeps this one")
ok("Email me a code" in get(client(**who("Hardy Wu", "wuhardy0@gmail.com")), "/").text, "…and ends the others")
ok("signed out everywhere" in get(hardy, "/").text, "staff actions are listed")
c = client(trusted=["wuhardy0@gmail.com"])
ok(post(c, "/api/visitor", {"name": "Hardy Wu", "email": "wuhardy0@gmail.com"}).json.get("verify") is True, "staff always get a code, even on a trusted browser")
LOGH = "https://log.hardywu.com"
def google(email, nxt=OFF + "/"):
    g = client(); r = get(g, "/auth/google?next=" + nxt, LOGH)
    assert "accounts.google.com" in r.headers.get("Location", "")
    with g.session_transaction(base_url=LOGH) as s: st, nonce = s["g_state"], s["g_nonce"]
    server._google_claims = lambda code: dict(aud="test-client", iss="https://accounts.google.com", nonce=nonce, email_verified=True, exp=time.time() + 300, email=email, name="Google Name")
    return g, get(g, f"/auth/google/callback?state={st}&code=x", LOGH)
g, r = google("wuhardy0@gmail.com"); ok(r.status_code == 302 and r.headers["Location"] == OFF + "/" and "Every order" in get(g, "/").text, "Google sign-in for staff → back to the office")
g, r = google("cust@example.com", "https://log3d.hardywu.com/?p=crab-gauge"); ok(r.status_code == 302 and r.headers["Location"].startswith("https://log3d.hardywu.com/"), "Google sign-in for a customer → back to the store sign-in, now signed in")
ok("isn't on the staff list" in get(g, "/").text, "…and the customer still can't use the office")
g, r = google("cust@example.com", "https://evil.example/"); ok(r.headers["Location"] == "https://hardywu.com/", "next must be a hardywu.com page")
g = client(); get(g, "/auth/google", LOGH); ok(get(g, "/auth/google/callback?state=wrong&code=x", LOGH).status_code == 400, "wrong Google state refused")
for h, path in (("https://log3d.hardywu.com", "/"), ("https://logbook.hardywu.com", "/")):
    ok("Continue with Google" in get(client(), path, h).text, f"Google button on {h}")
con = server.db(); con.execute("DELETE FROM members WHERE email='cust@example.com'"); con.commit()
shutil.rmtree(tmp)
print("ALL PASS" if not fails else f"{fails} FAIL")
