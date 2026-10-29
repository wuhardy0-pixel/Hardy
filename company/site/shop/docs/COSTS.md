# What a piece costs and how the price is set (2026-10-28)

Hardy asked for the price to cover material, electricity, time, design and shipping (free for the buyer) with a
gross margin of at least 30 %. The numbers live in `data/catalog.json` (`costing` for the shop-wide rates, `cost`
on each product) and Hardy's dashboard shows the live sheet at https://play.hardywu.com/costs (owner only).

| Rate | Value | Why |
| --- | --- | --- |
| Filament | $22 / kg | typical PLA spool price |
| Printer power | 120 W average | a desktop FDM printer while printing |
| Electricity | $0.17 / kWh | Maryland residential rate |
| Labour | $15 / hour | setup, filament changes, removing supports, cleaning, packing |
| Design | $20 / hour, spread over the first 40 units | time Hardy spent modelling the product |
| Shipping we pay | $6.50 lunchbox · $4.50 small items | USPS Ground Advantage, US |
| Packaging | $0.60 lunchbox · $0.30 small items | box or mailer, tape |

Per product (estimates; Hardy can correct any of them in the catalog):

| Product | Filament | Print time | Labour | Design | Cost | Min price (30 %) | Price (30 %) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Customizable Lunchbox | 260 g | 14 h | 0.6 h | 10 h | $27.11 | $38.72 | **$38.99** | 30 % |
| Blue Crab Gauge | 22 g | 1.5 h | 0.2 h | 3 h | $9.81 | $14.02 | **$14.99** | 35 % |
| Dual Ruler | 30 g | 1.2 h | 0.2 h | 2 h | $9.48 | $13.55 | **$13.99** | 32 % |
| Paw Fidget Spinner | 25 g | 2 h | 0.4 h | 2 h | $12.39 | $17.70 | **$17.99** | 31 % |
| Flexi Caterpillar | 35 g | 3 h | 0.4 h | 2 h | $12.63 | $18.04 | **$18.99** | 33 % |
| Flexi Skeleton | 30 g | 2.5 h | 0.25 h | 3 h | $10.76 | $15.37 | **$15.99** | 33 % |
| Finger Skateboard | 18 g | 1.5 h | 0.35 h | 3 h | $11.98 | $17.11 | **$17.99** | 33 % |

Add-ons: a name +$2.99, a picture +$3.99, each extra colour +$3.99 (a picture or an extra colour means a filament change,
about ten minutes of Hardy's time, so $2 lost money).

Price = cost ÷ 0.7, rounded up to the cent, so every product earns exactly 30 % (Hardy: '30% on the dot'). This replaced the earlier .99 rounding.
The old prices ($30 / $5 / $5 plus $5 shipping) did not cover the cost of the two small items.

## 2026-10-28 — prices Hardy set

Crab gauge $10, lunchbox $27, ruler $10, paw fidget spinner $15 for a pack of 3 (cost of a pack ≈ $19.67: 75 g, 6 h printing, 0.8 h labour, one parcel). Flexi skeleton stays at the 30 % rule ($15.38). Add-ons are cost ÷ 0.7: name $1.82 (5 min), picture $3.73 and extra colour $3.73 (10 min + 5 g purge each). The biggest cost on the small items is postage (free shipping) and labour at $15/h — lowering either is how these prices reach 30 %.

## 2026-10-28 — 20 % floor, priced against the market

Hardy: "do 20 % but think about the customer and what price he'll buy at; there are a lot of competitors." Rule now: the
smallest price ending in .99 that leaves at least 20 %. Postage corrected to USPS Ground Advantage after the July 2026
change (≈ $5.50 small parcel, ≈ $7.50 lunchbox) — free shipping is the biggest single cost on the small items.

| Product | Cost | Price | Margin | What competitors charge |
| --- | --- | --- | --- | --- |
| Customizable Lunchbox | $28.11 | $35.99 | 22 % | personalised lunch/bento boxes $20–28 (not 3D-printed, no picture) |
| Blue Crab Gauge | $10.81 | $13.99 | 23 % | Etsy gauges $6–22, store gauges $3–10 |
| Dual Ruler | $10.48 | $13.99 | 25 % | plain rulers $1–5 — hard to sell at this price |
| Paw Fidget Spinner, 3-pack | $20.67 | $25.99 | 21 % | 3D-printed 3-packs $20–35 |
| Flexi Skeleton | $11.76 | $14.99 | 22 % | Etsy flexi skeletons mostly $5–15 |

Add-ons: name $1.99 (36 %), picture $3.49 (25 %), extra colour $3.49 (25 %).

Where the price sits above the market (lunchbox, ruler), the levers are cost, not margin: charge shipping under a free-shipping
threshold (one $5.50 label covers several small items), sell small items as kits or packs, or count less of Hardy's time per piece.
