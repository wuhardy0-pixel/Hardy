# TESTING — Acceptance tests

Manual, plain-language test scripts. Run all of them on the DEPLOYED site in
Stripe **test mode** before launch (Phase 7), and record the result column.
T16 runs at launch with a real card. Demo-mode versions of T1–T12 passed
locally on 2026-08-17; they must be re-run on the live link.

**Stripe test cards:** success `4242 4242 4242 4242`, declined `4000 0000 0000 0002`
(any future expiry, any CVC, any ZIP).

| # | Test | Steps | Pass when | Result |
|---|------|-------|-----------|--------|
| T1 | Site loads | Open the public link in a normal browser | Homepage shows the 3 products with photos and prices; pictures appear quickly (shimmer while loading, no long blanks) | |
| T2 | Mobile | Open the link on a real phone | Everything readable and tappable; no sideways scrolling; live preview drags smoothly by finger | |
| T3 | Part colors | On the lunchbox, pick different colors for Box and Lid; leave others on "Same" | Preview recolors each part instantly; "Same" parts follow the main color; only the first color is required | |
| T4 | Rotate & flip | Drag the live preview; on ruler/crab press "Show back" | Preview spins through angles with colors kept; back view appears for ruler/crab | |
| T5 | Transparent | Pick Transparent (checkerboard swatch) | Selectable like any color; order summary says "Transparent (clear)" | |
| T6 | Custom text | Type a name (e.g., "Sofia ♥") on any product | Live preview shows the text where it will print (lunchbox lid / ruler & crab BACK); 31+ characters blocked | |
| T7 | Text color | With text typed, a "Text color" row appears; pick a different color | Text recolors in the preview; +$2 appears; without text no Text color row and no charge | |
| T8 | Image upload | Upload a JPG/PNG/HEIC photo on each product | Appears instantly in preview & thumbnail (no waiting); on ruler/crab it sits on the BACK; small-print warning shows | |
| T9 | Bad upload | Try a PDF, then a >10 MB image | Both rejected with a clear message | |
| T10 | Add-on pricing | Lunchbox: 3 different colors + text + picture | Summary itemizes: +$2 per extra color, +$2 text, +$2 picture; total = $30 + $4 + $2 + $2 + $5 shipping = $43 | |
| T11 | Required checks | Try to check out with no color; (if a product has a required image) without it | Friendly message; cannot reach payment | |
| T12 | Successful order | Full customization, pay with test card 4242… | Stripe page shows correct total; confirmation page appears | |
| T13 | **Order email** | Within ~2 min of T12, check barbaratao@gmail.com | Email contains: order #, product, EVERY part color (e.g., "Body: Blue · Text: Black"), color request note, exact text, working picture link, total paid, customer name/email/phone/shipping address — enough to print with zero follow-up questions | |
| T14 | Upload link | Open the email's picture link from a different device | Full-size image opens | |
| T15 | Declined & cancel | Pay with 4000…0002; also start checkout then hit back | Clear failure message / choices preserved on return; NO order email in either case | |
| T16 | **Live order (launch day)** | With live keys: place one real small order with a real card, then refund it in Stripe | Real charge appears in Stripe; order email arrives; refund succeeds | |

## Definition of done

T1–T15 pass on the deployed site in test mode, then T16 passes live. That makes
the PRD §2 success sentence true:

> Enter the link → customize (colors per part, text, picture — seeing it live)
> → pay → order with every detail lands in barbaratao@gmail.com → Barbara can
> print it.
