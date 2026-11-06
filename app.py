import json
import random
from collections import Counter

from js import window, document
from pyodide.ffi import create_proxy

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
PAUSE_EVERY = 10  # mindful pause after every N posts

CATEGORIES = ['Politics', 'News', 'Memes/Comedy', 'Lifestyle', 'Food', 'Sports', 'Art', 'Advertisements']
FEELINGS = ['Inspired', 'Anxious', 'Energized', 'Drained', 'Calm', 'Distracted', 'Connected']

CAT_COLORS = {
    'Politics': '#f87171', 'News': '#60a5fa', 'Memes/Comedy': '#fbbf24', 'Lifestyle': '#34d399',
    'Food': '#fb923c', 'Sports': '#22d3ee', 'Art': '#a78bfa', 'Advertisements': '#94a3b8',
}
FEELING_COLORS = {
    'Inspired': '#34d399', 'Anxious': '#f87171', 'Energized': '#fbbf24', 'Drained': '#94a3b8',
    'Calm': '#38bdf8', 'Distracted': '#c084fc', 'Connected': '#f472b6',
}
FEELING_EMOJI = {
    'Inspired': '✨', 'Anxious': '😰', 'Energized': '⚡', 'Drained': '🔋',
    'Calm': '🌿', 'Distracted': '🌀', 'Connected': '💞',
}

POST_TEMPLATES = [
    {"cat": "Politics", "author": "Global Insight", "avatar": "🏛️", "text": "New policy debate erupts in parliament regarding digital privacy rights and algorithms."},
    {"cat": "Politics", "author": "Civic Pulse", "avatar": "🗳️", "text": "Government and opposition trade sharp words over the new data-protection bill."},
    {"cat": "News", "author": "Daily Brief", "avatar": "📰", "text": "Breakthrough in renewable energy efficiency announced by international research team."},
    {"cat": "News", "author": "World Wire", "avatar": "🌍", "text": "Heatwave warnings extended across three regions as temperatures hit seasonal highs."},
    {"cat": "Memes/Comedy", "author": "CyberLaughs", "avatar": "🤖", "text": "Me attempting to explain why I bought another gadget I don’t need 😭"},
    {"cat": "Memes/Comedy", "author": "Doomscroll Daily", "avatar": "😂", "text": "POV: you said “just five more minutes” two hours ago."},
    {"cat": "Lifestyle", "author": "Mindful Spaces", "avatar": "🌿", "text": "5 simple morning habits to reduce screen fatigue before starting your workday."},
    {"cat": "Lifestyle", "author": "Slow Living", "avatar": "🕯️", "text": "Sunday reset: tidy desk, open window, one long walk. That’s the whole plan."},
    {"cat": "Food", "author": "Culinary Craft", "avatar": "🍜", "text": "Slow-cooked ramen with homemade miso broth. Perfect comfort food for chilly evenings."},
    {"cat": "Food", "author": "Street Bites", "avatar": "🌮", "text": "Crispy street-style tacos with charred pineapple salsa, ready in 20 minutes."},
    {"cat": "Sports", "author": "Arena Pulse", "avatar": "⚽", "text": "Unbelievable last-minute goal seals the victory in tonight’s championship clash!"},
    {"cat": "Sports", "author": "Court Side", "avatar": "🏀", "text": "Rookie drops 38 points in a stunning overtime comeback."},
    {"cat": "Art", "author": "Creative Corner", "avatar": "🎨", "text": "Generative light installation exploring human connection in urban environments."},
    {"cat": "Art", "author": "Studio Hours", "avatar": "🖼️", "text": "Time-lapse of a mural taking shape across a twelve-storey wall."},
    {"cat": "Advertisements", "author": "Sponsor: CloudFit", "avatar": "📢", "text": "Upgrade your workflow with AI smart task management. Try 14 days free today!"},
    {"cat": "Advertisements", "author": "Sponsor: StreamPlus", "avatar": "📺", "text": "Your next binge is waiting. First month free, cancel anytime."},
]


def rgba(hex_color, alpha):
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r},{g},{b},{alpha})"


def new_state():
    return {
        "seen_posts": 0,
        "engagement_count": 0,
        "feelings_count": 0,
        "posts_since_pause": 0,
        "post_counter": 0,
        "pauses": 0,
        "category_counts": {c: 0 for c in CATEGORIES},
        "category_engagements": {c: 0 for c in CATEGORIES},
        "feeling_counts": {f: 0 for f in FEELINGS},
        # content type -> feeling link weights (drives the web map)
        "link_counts": {c: {f: 0 for f in FEELINGS} for c in CATEGORIES},
        "active_filter": "ALL",
        "batch_cats": [],      # categories of posts since the last pause
        "pause_batch": [],     # categories of the round shown in the open pause
        "engaged": set(),      # "postId:like" / "postId:share"
        "post_feelings": {},   # postId -> feeling chosen on that post
        "last_text": None,
    }


app_state = new_state()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def el(element_id):
    return document.getElementById(element_id)


def is_modal_open():
    return el("mindful-modal").classList.contains("open")


def sync_state_to_js():
    """Send Python state to JavaScript for p5.js rendering."""
    js_data = {
        "categoryCounts": app_state["category_counts"],
        "categoryEngagements": app_state["category_engagements"],
        "feelingCounts": app_state["feeling_counts"],
        "linkCounts": app_state["link_counts"],
    }
    window.updateP5Data(json.dumps(js_data))


def top_key(d):
    key, val = max(d.items(), key=lambda kv: kv[1])
    return key if val > 0 else "—"


def update_ui_headers():
    el("stat-seen-count").innerText = str(app_state["seen_posts"])
    el("stat-engagement-count").innerText = str(app_state["engagement_count"])
    el("stat-feelings-count").innerText = str(app_state["feelings_count"])

    done = app_state["posts_since_pause"]
    left = PAUSE_EVERY - done
    el("pause-bar").style.width = f"{done / PAUSE_EVERY * 100}%"
    el("pause-label").innerText = f"Next pause in {left} post{'s' if left != 1 else ''}"
    el("pause-count").innerText = f"{done} / {PAUSE_EVERY}"

    el("insight-seen").innerText = top_key(app_state["category_counts"])
    el("insight-engaged").innerText = top_key(app_state["category_engagements"])
    el("insight-feeling").innerText = top_key(app_state["feeling_counts"])


# ---------------------------------------------------------------------------
# Feed rendering
# ---------------------------------------------------------------------------
def render_post_html(post_data, post_id):
    cat = post_data["cat"]
    color = CAT_COLORS[cat]
    feel_buttons = "".join(
        f'<button class="feel-btn" style="--c:{FEELING_COLORS[f]}" data-action="feeling" '
        f'data-cat="{cat}" data-value="{f}" aria-pressed="false">{FEELING_EMOJI[f]} {f}</button>'
        for f in FEELINGS
    )
    return f'''
    <article class="post-card" data-category="{cat}" data-post-id="{post_id}">
      <div class="post-head">
        <div class="post-who">
          <div class="avatar" style="background:{rgba(color, 0.14)};border-color:{rgba(color, 0.35)}">{post_data["avatar"]}</div>
          <div>
            <h4>{post_data["author"]}</h4>
            <span>Just now</span>
          </div>
        </div>
        <span class="tag" style="color:{color};background:{rgba(color, 0.1)};border-color:{rgba(color, 0.3)}">{cat}</span>
      </div>
      <p class="post-text">{post_data["text"]}</p>
      <div class="post-actions">
        <button class="act-btn like" data-action="interact" data-kind="like" aria-label="Like"><i class="fa-regular fa-heart"></i> Like</button>
        <button class="act-btn share" data-action="interact" data-kind="share" aria-label="Share"><i class="fa-solid fa-share"></i> Share</button>
      </div>
      <div class="feel-block">
        <p>How does this post make you feel?</p>
        <div class="feel-row">{feel_buttons}</div>
      </div>
    </article>
    '''


def pick_template():
    flt = app_state["active_filter"]
    pool = [t for t in POST_TEMPLATES if flt == "ALL" or t["cat"] == flt]
    fresh = [t for t in pool if t["text"] != app_state["last_text"]] or pool
    template = random.choice(fresh)
    app_state["last_text"] = template["text"]
    return template


def append_posts(count=3):
    container = el("feed-container")
    for _ in range(count):
        if app_state["posts_since_pause"] >= PAUSE_EVERY:
            break
        template = pick_template()
        container.insertAdjacentHTML("beforeend", render_post_html(template, app_state["post_counter"]))
        app_state["category_counts"][template["cat"]] += 1
        app_state["seen_posts"] += 1
        app_state["posts_since_pause"] += 1
        app_state["post_counter"] += 1
        app_state["batch_cats"].append(template["cat"])

    if app_state["posts_since_pause"] >= PAUSE_EVERY:
        open_pause()

    update_ui_headers()
    sync_state_to_js()


def ensure_fill(allow_pause=True):
    """Keep the feed scrollable (e.g. after filtering to a rarer category)."""
    container = el("feed-container")
    if container.clientHeight == 0:  # pane is hidden (mobile insights tab)
        return
    guard = 0
    while guard < 8 and not is_modal_open() and container.scrollHeight <= container.clientHeight + 120:
        if not allow_pause and app_state["posts_since_pause"] >= PAUSE_EVERY - 1:
            break
        append_posts(1)
        guard += 1


def on_scroll(event):
    """Infinite scroll: load more when near the bottom."""
    container = el("feed-container")
    if container.scrollHeight - container.scrollTop <= container.clientHeight + 100:
        if not is_modal_open():
            append_posts(2)


# ---------------------------------------------------------------------------
# Mindful pause
# ---------------------------------------------------------------------------
def open_pause():
    app_state["pause_batch"] = list(app_state["batch_cats"])
    app_state["batch_cats"] = []
    app_state["posts_since_pause"] = 0
    app_state["pauses"] += 1

    top = Counter(app_state["pause_batch"]).most_common(3)
    summary = "  ·  ".join(f"{c} ×{n}" for c, n in top)
    el("modal-kicker").innerText = f"Pause {app_state['pauses']}"
    el("modal-text").innerText = (
        f"You’ve scrolled through {PAUSE_EVERY} more posts. "
        "Take a breath and notice how you feel before continuing."
    )
    el("modal-round").innerText = f"This round: {summary}" if summary else ""
    el("mindful-modal").classList.add("open")


def close_modal():
    el("mindful-modal").classList.remove("open")
    app_state["pause_batch"] = []
    update_ui_headers()
    ensure_fill()


def log_modal_feeling(feeling):
    """A check-in counts as one feeling, shared across the content in the last round."""
    batch = app_state["pause_batch"]
    app_state["feeling_counts"][feeling] += 1
    app_state["feelings_count"] += 1
    if batch:
        for cat, n in Counter(batch).items():
            app_state["link_counts"][cat][feeling] += n / len(batch)
    sync_state_to_js()
    window.showToast(f"Check-in saved: {feeling}")
    close_modal()


# ---------------------------------------------------------------------------
# Engagement + feelings on individual posts
# ---------------------------------------------------------------------------
def interact(btn):
    card = btn.closest(".post-card")
    pid = card.getAttribute("data-post-id")
    cat = card.getAttribute("data-category")
    kind = btn.getAttribute("data-kind")
    key = f"{pid}:{kind}"

    if key in app_state["engaged"]:
        app_state["engaged"].discard(key)
        delta = -1
        btn.classList.remove("active")
    else:
        app_state["engaged"].add(key)
        delta = 1
        btn.classList.add("active")

    if kind == "like":
        icon = btn.querySelector("i")
        icon.classList.toggle("fa-solid", delta == 1)
        icon.classList.toggle("fa-regular", delta == -1)

    app_state["category_engagements"][cat] += delta
    app_state["engagement_count"] += delta
    card.classList.toggle("engaged", any(k.startswith(pid + ":") for k in app_state["engaged"]))

    update_ui_headers()
    sync_state_to_js()


def apply_feeling(cat, feeling, delta):
    app_state["feeling_counts"][feeling] += delta
    app_state["link_counts"][cat][feeling] += delta
    app_state["feelings_count"] += delta


def log_post_feeling(btn):
    """One feeling per post; click again to remove it, click another to switch."""
    card = btn.closest(".post-card")
    pid = card.getAttribute("data-post-id")
    cat = card.getAttribute("data-category")
    feeling = btn.getAttribute("data-value")
    prev = app_state["post_feelings"].get(pid)

    if prev:
        apply_feeling(cat, prev, -1)

    for b in card.querySelectorAll(".feel-btn"):
        b.classList.remove("selected")
        b.setAttribute("aria-pressed", "false")

    if prev == feeling:
        del app_state["post_feelings"][pid]
    else:
        apply_feeling(cat, feeling, 1)
        app_state["post_feelings"][pid] = feeling
        btn.classList.add("selected")
        btn.setAttribute("aria-pressed", "true")

    update_ui_headers()
    sync_state_to_js()


# ---------------------------------------------------------------------------
# Filter + reset
# ---------------------------------------------------------------------------
def filter_category(cat):
    app_state["active_filter"] = cat
    for card in document.querySelectorAll(".post-card"):
        card.style.display = "" if (cat == "ALL" or card.getAttribute("data-category") == cat) else "none"
    for chip in document.querySelectorAll("#category-filter-chips .chip"):
        chip.classList.toggle("active", chip.getAttribute("data-value") == cat)
    ensure_fill()


def seed_feed():
    append_posts(4)
    ensure_fill(allow_pause=False)


def reset_session():
    app_state.clear()
    app_state.update(new_state())

    container = el("feed-container")
    container.innerHTML = ""
    container.scrollTop = 0
    el("mindful-modal").classList.remove("open")
    for chip in document.querySelectorAll("#category-filter-chips .chip"):
        chip.classList.toggle("active", chip.getAttribute("data-value") == "ALL")

    seed_feed()
    window.showToast("Session reset. Fresh feed, empty charts.")


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
def on_click(event):
    """One delegated click handler for every button (static and dynamic)."""
    target = event.target.closest("[data-action]")
    if target is None:
        return
    action = target.getAttribute("data-action")
    value = target.getAttribute("data-value")

    if action == "filter":
        filter_category(value)
    elif action == "interact":
        interact(target)
    elif action == "feeling":
        log_post_feeling(target)
    elif action == "modal-feeling":
        log_modal_feeling(value)
    elif action == "close-modal":
        close_modal()
    elif action == "reset":
        reset_session()


scroll_proxy = create_proxy(on_scroll)
el("feed-container").addEventListener("scroll", scroll_proxy)

click_proxy = create_proxy(on_click)
document.addEventListener("click", click_proxy)

# Initial load
seed_feed()
