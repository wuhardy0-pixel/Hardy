"use client";
import { useEffect } from "react";
import { cart } from "../lib/cart";

// Empties the cart once the buyer is back from a finished Stripe payment.
export default function ClearCart() {
  useEffect(() => { cart.clear(); }, []);
  return null;
}
