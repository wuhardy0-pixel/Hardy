// CARD_PAYMENTS is baked into the pages at build time: "1" once Stripe keys are in .env.local.
export default { env: { CARD_PAYMENTS: process.env.STRIPE_SECRET_KEY ? "1" : "" } };
