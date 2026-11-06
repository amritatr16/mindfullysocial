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
        f'<button id="feel-btn-{idx}-{f.replace("/", "-")}" class="feel-tag-btn text-[11px] px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-indigo-300 transition-colors" py-click="log_feeling(\'{cat}\', \'{f}\', \'{idx}\')">{f}</button>'
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
        <button id="like-btn-{idx}" class="hover:text-rose-400 flex items-center gap-1.5 transition-colors" py-click="toggle_like(\'{cat}\', \'{idx}\')">
          <i class="fa-regular fa-heart"></i> <span>Like</span>
        </button>
        <button class="hover:text-cyan-400 flex items-center gap-1.5" py-click="interact(\'{cat}\')"><i class="fa-solid fa-share"></i> Share</button>
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

    # Trigger mindful intervention after every 10 posts
    if app_state["posts_since_pause"] >= 10:
        document.getElementById("mindful-modal").classList.remove("hidden")
        app_state["posts_since_pause"] = 0

def on_scroll(event):
def toggle_like(category, idx):
    btn = document.getElementById(f"like-btn-{idx}")
    if not btn:
        return
        
    is_liked = btn.getAttribute("data-liked") == "true"
    
    if is_liked:
        btn.setAttribute("data-liked", "false")
        btn.className = "hover:text-rose-400 flex items-center gap-1.5 transition-colors text-slate-400"
        btn.querySelector("i").className = "fa-regular fa-heart"
        app_state["category_engagements"][category] = max(0, app_state["category_engagements"][category] - 1)
        app_state["engagement_count"] = max(0, app_state["engagement_count"] - 1)
    else:
        btn.setAttribute("data-liked", "true")
        btn.className = "text-rose-500 font-semibold flex items-center gap-1.5 transition-colors"
        btn.querySelector("i").className = "fa-solid fa-heart text-rose-500"
        app_state["category_engagements"][category] += 1
        app_state["engagement_count"] += 1

    update_ui_headers()
    sync_state_to_js()

def interact(category):
    app_state["category_engagements"][category] += 1
    app_state["engagement_count"] += 1
    update_ui_headers()
    sync_state_to_js()

def log_feeling(category, feeling, idx):
    safe_feeling = feeling.replace("/", "-")
    btn = document.getElementById(f"feel-btn-{idx}-{safe_feeling}")
    if not btn:
        return
        
    is_selected = btn.getAttribute("data-selected") == "true"
    
    if is_selected:
        btn.setAttribute("data-selected", "false")
        btn.className = "feel-tag-btn text-[11px] px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-indigo-300 transition-colors"
        app_state["feeling_counts"][feeling] = max(0, app_state["feeling_counts"][feeling] - 1)
        app_state["feelings_count"] = max(0, app_state["feelings_count"] - 1)
    else:
        btn.setAttribute("data-selected", "true")
        btn.className = "feel-tag-btn text-[11px] px-2 py-0.5 rounded-lg bg-indigo-600 text-white border border-indigo-400 font-medium transition-colors shadow-sm"
        app_state["feeling_counts"][feeling] += 1
        app_state["feelings_count"] += 1

    update_ui_headers()
    sync_state_to_js()

def toggle_engagement_radar(event):
    is_checked = document.getElementById("engagement-radar-toggle").checked
    window.showEngagementRadar = is_checked

def log_modal_feeling(feeling):
    log_feeling("Lifestyle", feeling, "modal")
    close_modal()

def close_modal():
    document.getElementById("mindful-modal").classList.add("hidden")

def filter_category(cat):
    app_state["active_filter"] = cat
    cards = document.querySelectorAll(".post-card")
    for card in cards:
        if cat == "ALL" or card.getAttribute("data-category") == cat:
            card.style.display = "block"
        else:
            card.style.display = "none"

# Attach infinite scroll listener to container
scroll_proxy = create_proxy(on_scroll)
document.getElementById("feed-container").addEventListener("scroll", scroll_proxy)

# Initial load
append_posts(4)
