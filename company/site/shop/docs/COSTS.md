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
