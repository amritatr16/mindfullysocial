import json
from js import window, document
from pyodide.ffi import create_proxy

# Constants
CATEGORIES = ['Politics', 'News', 'Memes/Comedy', 'Lifestyle', 'Food', 'Sports', 'Art', 'Advertisements']
FEELINGS = ['Inspired', 'Anxious', 'Energized', 'Drained', 'Calm', 'Distracted', 'Connected']

POST_TEMPLATES = [
    {"cat": "Politics", "author": "Global Insight", "avatar": "🏛️", "text": "New policy debate erupts in parliament regarding digital privacy rights and algorithms.", "tagColor": "bg-red-500/20 text-red-300 border-red-500/30"},
    {"cat": "News", "author": "Daily Brief", "avatar": "📰", "text": "Breakthrough in renewable energy efficiency announced by international research team.", "tagColor": "bg-blue-500/20 text-blue-300 border-blue-500/30"},
    {"cat": "Memes/Comedy", "author": "CyberLaughs", "avatar": "🤖", "text": "Me attempting to explain why I bought another gadget I don’t need 😭", "tagColor": "bg-amber-500/20 text-amber-300 border-amber-500/30"},
    {"cat": "Lifestyle", "author": "Mindful Spaces", "avatar": "🌿", "text": "5 simple morning habits to reduce screen fatigue before starting your workday.", "tagColor": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"},
    {"cat": "Food", "author": "Culinary Craft", "avatar": "🍜", "text": "Slow-cooked ramen with homemade miso broth. Perfect comfort food for chilly evenings.", "tagColor": "bg-orange-500/20 text-orange-300 border-orange-500/30"},
    {"cat": "Sports", "author": "Arena Pulse", "avatar": "⚽", "text": "Unbelievable last-minute goal seals the victory in tonight’s championship clash!", "tagColor": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"},
    {"cat": "Art", "author": "Creative Corner", "avatar": "🎨", "text": "Generative light installation exploring human connection in urban environments.", "tagColor": "bg-purple-500/20 text-purple-300 border-purple-500/30"},
    {"cat": "Advertisements", "author": "Sponsor: CloudFit", "avatar": "📢", "text": "Upgrade your workflow with AI smart task management. Try 14 days free today!", "tagColor": "bg-slate-500/20 text-slate-300 border-slate-500/30"}
]

ACTIVE_CHIP = "chip active bg-cyan-600/30 text-cyan-300 border border-cyan-500/50 px-2.5 py-0.5 rounded-full text-[11px]"
INACTIVE_CHIP = "chip bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full text-[11px]"

# State Tracker
app_state = {
    "seen_posts": 0,
    "engagement_count": 0,
    "feelings_count": 0,
    "posts_since_pause": 0,
    "post_counter": 0,
    "category_counts": {c: 0 for c in CATEGORIES},
    "category_engagements": {c: 0 for c in CATEGORIES},
    "feeling_counts": {f: 0 for f in FEELINGS},
    "active_filter": "ALL"
}


def sync_state_to_js():
    """ Sends python state metrics directly to Javascript for p5.js rendering """
    js_data = {
        "categoryCounts": app_state["category_counts"],
        "categoryEngagements": app_state["category_engagements"],
        "feelingCounts": app_state["feeling_counts"]
    }
    window.updateP5Data(json.dumps(js_data))


def update_ui_headers():
    document.getElementById("stat-seen-count").innerText = str(app_state["seen_posts"])
    document.getElementById("stat-engagement-count").innerText = str(app_state["engagement_count"])
    document.getElementById("stat-feelings-count").innerText = str(app_state["feelings_count"])


def render_post_html(post_data, idx):
    cat = post_data["cat"]
    feel_buttons = "".join([
        f'<button class="text-[11px] px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-indigo-300" data-action="feeling" data-cat="{cat}" data-value="{f}">{f}</button>'
        for f in FEELINGS
    ])

    display_style = "" if (app_state["active_filter"] == "ALL" or app_state["active_filter"] == cat) else 'style="display: none;"'

    return f'''
    <div class="post-card bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm" data-category="{cat}" {display_style}>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">{post_data["avatar"]}</div>
          <div>
            <h4 class="font-semibold text-xs text-slate-200">{post_data["author"]}</h4>
            <span class="text-[10px] text-slate-500">Just now</span>
          </div>
        </div>
        <span class="text-[10px] px-2.5 py-0.5 rounded-full border {post_data["tagColor"]} font-medium">{cat}</span>
      </div>
      <p class="text-xs text-slate-300 mb-4">{post_data["text"]}</p>
      <div class="flex items-center gap-4 py-2 border-y border-slate-800/80 mb-3 text-slate-400 text-xs">
        <button class="hover:text-rose-400 flex items-center gap-1.5" data-action="interact" data-cat="{cat}"><i class="fa-regular fa-heart"></i> Like</button>
        <button class="hover:text-cyan-400 flex items-center gap-1.5" data-action="interact" data-cat="{cat}"><i class="fa-solid fa-share"></i> Share</button>
      </div>
      <div>
        <p class="text-[10px] text-slate-400 mb-1.5">How does this post make you feel?</p>
        <div class="flex flex-wrap gap-1.5">{feel_buttons}</div>
      </div>
    </div>
    '''


def append_posts(count=3):
    container = document.getElementById("feed-container")
    for _ in range(count):
        template = POST_TEMPLATES[app_state["post_counter"] % len(POST_TEMPLATES)]
        post_html = render_post_html(template, app_state["post_counter"])
        container.insertAdjacentHTML("beforeend", post_html)
        app_state["category_counts"][template["cat"]] += 1
        app_state["seen_posts"] += 1
        app_state["posts_since_pause"] += 1
        app_state["post_counter"] += 1

    update_ui_headers()
    sync_state_to_js()

    if app_state["posts_since_pause"] >= 4:
        document.getElementById("mindful-modal").classList.remove("hidden")
        app_state["posts_since_pause"] = 0


def on_scroll(event):
    """ Infinite scroll handler listening for near-bottom scroll events """
    container = document.getElementById("feed-container")
    # Check if scrolled near bottom (within 100px)
    if container.scrollHeight - container.scrollTop <= container.clientHeight + 100:
        # Prevent loading more if mindful modal is open
        if document.getElementById("mindful-modal").classList.contains("hidden"):
            append_posts(2)


def interact(category):
    app_state["category_engagements"][category] += 1
    app_state["engagement_count"] += 1
    update_ui_headers()
    sync_state_to_js()


def log_feeling(category, feeling):
    app_state["feeling_counts"][feeling] += 1
    app_state["feelings_count"] += 1
    update_ui_headers()
    sync_state_to_js()


def log_modal_feeling(feeling):
    log_feeling("Lifestyle", feeling)
    close_modal()


def close_modal():
    document.getElementById("mindful-modal").classList.add("hidden")


def filter_category(cat):
    app_state["active_filter"] = cat
    for card in document.querySelectorAll(".post-card"):
        if cat == "ALL" or card.getAttribute("data-category") == cat:
            card.style.display = "block"
        else:
            card.style.display = "none"
    # Highlight the active chip
    for chip in document.querySelectorAll("#category-filter-chips .chip"):
        chip.className = ACTIVE_CHIP if chip.getAttribute("data-value") == cat else INACTIVE_CHIP


def on_click(event):
    """ One delegated click handler for every button (static and dynamic) """
    el = event.target.closest("[data-action]")
    if el is None:
        return
    action = el.getAttribute("data-action")
    value = el.getAttribute("data-value")
    cat = el.getAttribute("data-cat")

    if action == "filter":
        filter_category(value)
    elif action == "interact":
        interact(cat)
    elif action == "feeling":
        log_feeling(cat, value)
    elif action == "modal-feeling":
        log_modal_feeling(value)
    elif action == "close-modal":
        close_modal()


# Attach listeners
scroll_proxy = create_proxy(on_scroll)
document.getElementById("feed-container").addEventListener("scroll", scroll_proxy)

click_proxy = create_proxy(on_click)
document.addEventListener("click", click_proxy)

# Initial load (don't trigger the mindful modal on page load)
append_posts(4)
app_state["posts_since_pause"] = 0
document.getElementById("mindful-modal").classList.add("hidden")
