export function buildCheckoutUrl(role: "Brand" | "Influencer", planId: string) {
  const r = role.toLowerCase(); // brand | influencer
  return `/${r}/subscriptions?checkout=1&planId=${encodeURIComponent(planId)}`;
}
