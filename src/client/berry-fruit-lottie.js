const FRUIT_RULES = [
  { slug: "guava", lottie: "pear", match: ["consulting-cora", "0002-consulting-cora", "ổi đào", "oi dao", "guava", "pear"] },
  { slug: "mangosteen", lottie: "cherry", match: ["developer-dana", "000m-developer-dana", "măng cụt", "mang cut", "mangosteen", "cherry"] },
  { slug: "durian", lottie: "pineapple", match: ["executive-ellis", "004j-office-otis", "sầu riêng", "sau rieng", "durian", "pineapple"] },
  { slug: "dragon-fruit", lottie: "watermelon", match: ["marketing-martin", "0012-marketing-martin", "thanh long", "dragon-fruit", "watermelon"] },
  { slug: "melon", lottie: "kiwi", match: ["operations-olivia", "000e-operations-olivia", "bưởi da xanh", "buoi da xanh", "melon", "kiwi"] },
  { slug: "peach", lottie: "apple", match: ["research-rosa", "0017-research-rosa", "vú sữa", "vu sua", "peach", "apple"] },
  { slug: "mango", lottie: "mango", match: ["sales-sally", "0002-pipeline-pia", "xoài cát", "xoai cat", "mango"] },
  { slug: "raspberry", lottie: "rambutan", match: ["support-sofia", "001u-support-saga", "chôm chôm", "chom chom", "raspberry", "rambutan"] },
  { slug: "lychee", lottie: "delicious", match: ["talent-theo", "005y-talent-tove", "vải thiều", "vai thieu", "lychee", "delicious"] },
  { slug: "starfruit", lottie: "banana", match: ["starfruit", "banana"] }
];

function injectFruit3dStyles() {
  if (typeof document === "undefined" || document.getElementById("oi-fruit-3d-styles")) return;
  const style = document.createElement("style");
  style.id = "oi-fruit-3d-styles";
  style.textContent = `
    @keyframes oi-float-3d {
      0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
      50% { transform: translateY(-4px) rotate(2.5deg) scale(1.04); }
    }
    .oi-fruit-3d-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      filter: drop-shadow(0 8px 16px rgba(24, 24, 27, 0.14));
      animation: oi-float-3d 3.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      will-change: transform;
    }
  `;
  document.head.appendChild(style);
}

export function resolveFruitRule(rawKey) {
  const norm = String(rawKey || "").toLowerCase();
  for (const rule of FRUIT_RULES) {
    if (rule.match.some((token) => norm.includes(token))) return rule;
  }
  let hash = 0;
  for (let i = 0; i < norm.length; i += 1) hash = (hash * 31 + norm.charCodeAt(i)) >>> 0;
  return FRUIT_RULES[hash % FRUIT_RULES.length] || FRUIT_RULES[0];
}

export function resolveFruitSlug(rawKey) {
  return resolveFruitRule(rawKey).slug;
}

export function getFruitImageUrl(rawKey) {
  return `/fruits-3d/${resolveFruitSlug(rawKey)}.png`;
}

export function getFruitLottieUrl(rawKey) {
  return `/fruits/${resolveFruitRule(rawKey).lottie}.json`;
}

export async function preloadFruitLotties() {
  injectFruit3dStyles();
}

export function mountFruitLottie(el, rawKey, size = 64, onReady = null) {
  if (!el) return;
  injectFruit3dStyles();
  const rule = resolveFruitRule(rawKey);
  if (el.__oiFruitSlug === rule.slug && el.__oiMounted) {
    if (typeof onReady === "function") queueMicrotask(() => onReady());
    return;
  }
  el.__oiFruitSlug = rule.slug;
  el.__oiMounted = true;
  el.innerHTML = "";
  const img = document.createElement("img");
  img.src = `/fruits-3d/${rule.slug}.png`;
  img.alt = rule.slug;
  img.className = "oi-fruit-3d-img";
  img.style.animationDelay = `${(rule.slug.charCodeAt(0) % 7) * -0.35}s`;
  el.appendChild(img);
  if (typeof onReady === "function") queueMicrotask(() => onReady());
}

if (typeof window !== "undefined") {
  injectFruit3dStyles();
  window.__oiMountFruitLottie = mountFruitLottie;
  window.__oiResolveFruitGif = getFruitImageUrl;
  window.__oiResolveFruitSlug = resolveFruitSlug;
}
