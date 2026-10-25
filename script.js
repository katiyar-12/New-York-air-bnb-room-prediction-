const API_URL = "http://localhost:8000/predict";

const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");
const btnLabel = submitBtn.querySelector(".label");
const banner = document.getElementById("banner");
const bannerText = document.getElementById("banner-text");
const emptyState = document.getElementById("empty");
const output = document.getElementById("output");
const categoryEl = document.getElementById("category");
const confidenceEl = document.getElementById("confidence");
const probsEl = document.getElementById("probs");

const INT_FIELDS = ["minimum_nights", "number_of_reviews", "calculated_host_listings_count", "availability_365", "price"];
const FLOAT_FIELDS = ["latitude", "longitude", "reviews_per_month"];

const SAMPLE = {
  neighbourhood_group: "Brooklyn",
  neighbourhood: "Kensington",
  latitude: 40.6465,
  longitude: -73.9733,
  minimum_nights: 3,
  number_of_reviews: 42,
  reviews_per_month: 1.4,
  calculated_host_listings_count: 1,
  availability_365: 180,
  price: 120,
};

// Pick a stable colour per class; fall back to position for unknown class names.
const COLOR_HINTS = [
  [/budget|low|cheap|economy/i, "var(--c0)"],
  [/standard|mid|medium|moderate/i, "var(--c1)"],
  [/luxury|high|premium|expensive/i, "var(--c2)"],
];
const FALLBACK = ["var(--c0)", "var(--c1)", "var(--c2)"];

function colorFor(name, index) {
  const hit = COLOR_HINTS.find(([re]) => re.test(name));
  return hit ? hit[1] : FALLBACK[index % FALLBACK.length];
}

function showBanner(message) {
  bannerText.textContent = message;
  banner.hidden = false;
}

function hideBanner() {
  banner.hidden = true;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
  btnLabel.textContent = isLoading ? "Predicting" : "Predict category";
}

function collectPayload() {
  const data = new FormData(form);
  const payload = {
    neighbourhood_group: data.get("neighbourhood_group"),
    neighbourhood: String(data.get("neighbourhood")).trim(),
  };
  FLOAT_FIELDS.forEach((key) => (payload[key] = parseFloat(data.get(key))));
  INT_FIELDS.forEach((key) => (payload[key] = parseInt(data.get(key), 10)));
  return payload;
}

// FastAPI returns { detail: [{ loc, msg }] } for 422 validation errors.
function describeApiError(status, body) {
  if (body && Array.isArray(body.detail)) {
    const lines = body.detail.map((d) => `${d.loc.slice(1).join(".")}: ${d.msg}`);
    return `The server rejected the input. ${lines.join("; ")}`;
  }
  if (body && typeof body.detail === "string") return body.detail;
  return `The server responded with an error (${status}).`;
}

function renderResult({ category, probs }) {
  const entries = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const topName = entries.length ? entries[0][0] : category;
  const topValue = entries.length ? entries[0][1] : null;

  categoryEl.textContent = category;
  const names = Object.keys(probs);
  categoryEl.style.setProperty("--accent", colorFor(category, Math.max(names.indexOf(category), 0)));
  confidenceEl.innerHTML = "";
  if (topValue !== null) {
    const strong = document.createElement("strong");
    strong.textContent = `${topValue.toFixed(1)}%`;
    confidenceEl.append("The model is ", strong, " confident in ", topName === category ? "this call." : `${topName}.`);
  }

  probsEl.innerHTML = "";
  entries.forEach(([name, value]) => {
    const li = document.createElement("li");
    li.style.setProperty("--accent", colorFor(name, names.indexOf(name)));
    if (name === category) li.classList.add("top");

    const row = document.createElement("div");
    row.className = "row";
    const left = document.createElement("span");
    left.textContent = name;
    const right = document.createElement("span");
    right.textContent = `${value.toFixed(1)}%`;
    row.append(left, right);

    const track = document.createElement("div");
    track.className = "track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", value);
    track.setAttribute("aria-label", `${name} probability`);
    const fill = document.createElement("div");
    fill.className = "fill";
    track.append(fill);

    li.append(row, track);
    probsEl.append(li);

    // Next frame so the width transition animates from 0.
    requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = `${Math.min(value, 100)}%`)));
  });

  emptyState.hidden = true;
  output.hidden = false;
  if (window.matchMedia("(max-width: 900px)").matches) {
    output.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideBanner();

  form.classList.add("was-validated");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(collectPayload()),
    });

    let body = null;
    try {
      body = await response.json();
    } catch (_) {
      /* non-JSON response */
    }

    if (!response.ok) throw new Error(describeApiError(response.status, body));
    if (!body || typeof body.category !== "string" || typeof body.probs !== "object") {
      throw new Error("The server returned an unexpected response format.");
    }
    renderResult(body);
  } catch (err) {
    const offline = err instanceof TypeError;
    showBanner(
      offline
        ? "Cannot reach the prediction server. Check that FastAPI is running at http://localhost:8000 and try again."
        : err.message
    );
  } finally {
    setLoading(false);
  }
});

document.getElementById("sample-btn").addEventListener("click", () => {
  Object.entries(SAMPLE).forEach(([key, value]) => {
    form.elements[key].value = value;
  });
  form.classList.remove("was-validated");
  hideBanner();
});

form.addEventListener("reset", () => {
  form.classList.remove("was-validated");
  hideBanner();
  output.hidden = true;
  emptyState.hidden = false;
});

document.getElementById("banner-close").addEventListener("click", hideBanner);
