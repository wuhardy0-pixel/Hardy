# corporate — what it must do

Owner: Barbara (business), Hardy Wu (creator). Last updated 2026-09-10.

## Purpose
Run the company behind hardywu.com: one account for every customer, every order in one place, a print queue for the 3D printer, and a view for Hardy of who visited and what sold.

## Must have (in place)
- One sign-in used by the site, the games, the shop, BookKeep and the office pages. Signing out anywhere signs out everywhere.
- Sign-in proves the email: a 6-digit code is emailed and must be typed back (10 minutes, 5 tries). A browser that has proved an email once is not asked again for that email. Needs a mail sender in `.env` (Gmail app password or Resend); without one the code step is skipped on the real site.
- Every order (site or shop) is saved with product, quantity, colour, custom text, buyer, the signed-in person, and source.
- Order status follows the real journey: ordered → printed → shipped → returned, or cancelled. Booking as an invoice is a separate tick.
- Every new order automatically creates a print job. Finishing the job moves the order to printed.
- Hardy sees all orders and the print queue (BookKeep → Orders, and hardywu.com/orders) and all visitors (hardywu.com/activity).
- Each login has its own BookKeep book; nobody can read another person's book.
- Test data never stays in real data.

## Should have (next)
- Office pages at office.hardywu.com replacing the Orders tab inside BookKeep.
- Inventory (filament, parts, finished stock) once there is stock to track.
- Sending a finished print file to the printer automatically (needs the printer model).

## Out of scope for now
CRM conversations, payroll, accounting beyond BookKeep, recommendations.

## Decisions made
- No passwords; email verification by code instead (Barbara, 2026-09-15).
- One server, one database; modules are folders, not separate systems (2026-09-10).
- Robotics and 3D printing are one store; products are product lines, not technologies (2026-09-10).
