// The room page. Deliberately small and dependency-free: it knows how to list files, add files,
// rename/retag them and remove them, and nothing else. It keeps nothing of its own -- no
// localStorage, no service worker; the only cookie is the server's proof that the PIN was typed,
// and that one dies when the browser closes. So an open room leaves nothing behind on a shared
// or borrowed machine, and the room id lives only in the URL.
//
// Every name and tag here is typed by somebody else, so every one of them is written with
// textContent, never innerHTML. The server defends itself too (lib/rooms.js), but a page that
// builds markup out of other people's filenames is a page waiting to be handed a <script>.

// Where the files live. Two cases, one file:
//
//   served next to the API   -- the id comes out of the path (.../room/<id>) and the API is a
//                               sibling. Nothing is hard-coded, so reading this tells you
//                               nothing about where else the page might be mounted.
//   served somewhere else    -- a static host that cannot accept an upload, so the page is
//                               published there and the API is elsewhere. That host sets
//                               window.ROOM = { api, id } before loading this.
//
// In the second case proof of the PIN CANNOT be a cookie: it would be a cross-site cookie, which
// iOS and Safari drop outright and which would hand any other page ambient authority over the
// room. It is a bearer token instead, kept in the variable below and nowhere else -- not in
// localStorage, not in sessionStorage. Closing the tab forgets it.
const cfg = window.ROOM || {};
const parts = location.pathname.split("/room/");
const roomId = cfg.id || (parts[1] || "").split("/")[0];
const api = cfg.api ? `${cfg.api.replace(/\/$/, "")}/api/room/${roomId}` : `${parts[0] || ""}/api/room/${roomId}`;
let key = "";

const $ = (id) => document.getElementById(id);
const titleEl = $("title"), subEl = $("sub"), zone = $("zone"), picker = $("picker");
const tagbox = $("tagbox"), filtersEl = $("filters"), listEl = $("list"), errEl = $("err"), noteEl = $("note");
const lockEl = $("lock"), roomEl = $("room"), pinEl = $("pin"), unlockEl = $("unlock"), lockErrEl = $("lockerr");

let state = { files: [], closed: false, maxFileBytes: 0, closesAt: null, name: "Files" };
let filter = null;
let busy = false;

function say(message) {
  errEl.textContent = message || "";
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

function humanWhen(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// The server decides what may be shown inline (lib/rooms.js servingHeaders). The page only
// decides what to ask for a thumbnail of, and images are the only thing worth one.
const isImage = (type) => /^image\/(?:jpeg|png|gif|webp|bmp|avif)$/.test(type || "");

function extOf(name) {
  const bits = (name || "").split(".");
  return bits.length > 1 ? bits.pop().slice(0, 4) : "file";
}

async function ask(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(path, { ...options, headers });
  let body = {};
  try { body = await res.json(); } catch { /* a non-JSON error page is still an error */ }
  if (!res.ok) throw new Error(body.locked ? "locked" : body.error || `http_${res.status}`);
  return body;
}

const MESSAGES = {
  not_found: "That file is gone — somebody removed it.",
  wrong_pin: "Wrong PIN.",
  too_many_attempts: "Too many tries. Wait a few minutes.",
  locked: "Locked.",
  room_closed: "This room is archived. Files stay downloadable, but nothing can be added or changed.",
  room_full: "The room is full. Remove something first.",
  file_too_large: "That file is too big.",
  empty_file: "That file is empty.",
  too_many_requests: "Too many uploads at once. Wait a moment and try again.",
};
const explain = (error) => MESSAGES[error] || "Something went wrong. Try again.";

// Three outcomes: open it, ask for the PIN, or say there is nothing here. A locked room answers
// 401 {locked:true} to every route including the files, so there is nothing to show until the
// PIN is in -- the lock screen is not a curtain drawn over data the page already has.
async function load() {
  try {
    state = await ask(api);
  } catch (error) {
    if (error.message === "locked") return showLock();
    document.querySelector("main").textContent =
      error.message === "not_found"
        ? "No room here. Check the link."
        : "Could not open this room.";
    return;
  }
  lockEl.hidden = true;
  roomEl.hidden = false;
  titleEl.textContent = state.name;
  document.title = state.name;
  render();
}

function showLock() {
  roomEl.hidden = true;
  lockEl.hidden = false;
  document.title = "Locked";
  pinEl.focus();
}

lockEl.onsubmit = async (event) => {
  event.preventDefault();
  const pin = pinEl.value.trim();
  if (!pin) return;
  unlockEl.disabled = true;
  lockErrEl.textContent = "";
  try {
    const opened = await ask(`${api}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    key = opened.key || "";    // memory only; gone when the tab closes
    pinEl.value = "";          // not left sitting in the field behind the page
    await load();
  } catch (error) {
    lockErrEl.textContent = explain(error.message);
    pinEl.select();
  } finally {
    unlockEl.disabled = false;
  }
};

function describe() {
  const count = state.files.length;
  const bytes = state.files.reduce((sum, f) => sum + f.file_size, 0);
  const head = `${count} file${count === 1 ? "" : "s"} · ${humanSize(bytes)}`;
  if (state.closed) return `${head} · archived`;
  if (state.closesAt) {
    const when = new Date(state.closesAt).toLocaleDateString(undefined, { day: "numeric", month: "long" });
    return `${head} · open until ${when}`;
  }
  return head;
}

function render() {
  subEl.textContent = describe();
  zone.classList.toggle("hide", state.closed);
  tagbox.hidden = state.closed;
  noteEl.textContent = state.closed
    ? "This room is archived. Everything here can still be downloaded."
    : `Anyone with this link can add, rename and remove files. Up to ${humanSize(state.maxFileBytes)} each.`;

  const tags = [...new Set(state.files.map((f) => f.tag).filter(Boolean))].sort();
  filtersEl.replaceChildren();
  if (tags.length) {
    for (const tag of [null, ...tags]) {
      const button = document.createElement("button");
      button.textContent = tag === null ? "all" : tag;
      button.className = filter === tag ? "on" : "";
      button.onclick = () => { filter = tag; render(); };
      filtersEl.append(button);
    }
  }

  const shown = state.files.filter((f) => filter === null || f.tag === filter);
  listEl.replaceChildren();
  if (!shown.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.style.display = "block";
    empty.textContent = state.files.length ? "Nothing with that tag." : "Empty so far.";
    listEl.append(empty);
    return;
  }
  for (const file of shown) listEl.append(row(file));
}

function row(file) {
  const li = document.createElement("li");
  // A header cannot be attached to <img src> or to a download link, so the token travels as a
  // query parameter on these two. Same token, same signature check, same expiry.
  const href = `${api}/file/${file.id}${key ? `?k=${encodeURIComponent(key)}` : ""}`;

  if (isImage(file.file_type)) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = href;
    img.alt = "";
    img.loading = "lazy";
    li.append(img);
  } else {
    const box = document.createElement("div");
    box.className = "thumb ext";
    box.textContent = extOf(file.file_name);
    li.append(box);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const link = document.createElement("a");
  link.className = "name";
  link.href = href;
  link.textContent = file.file_name;          // never innerHTML: somebody else chose this
  const small = document.createElement("div");
  small.className = "small";
  if (file.tag) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = file.tag;
    small.append(tag);
  }
  small.append(document.createTextNode(`${humanSize(file.file_size)} · ${humanWhen(file.created_at)}`));
  meta.append(link, small);
  li.append(meta);

  if (!state.closed) {
    const acts = document.createElement("div");
    acts.className = "acts";
    acts.append(
      action("✎", "Rename or retag", () => edit(file, li)),
      action("✕", "Remove", () => remove(file, li), "rm"),
    );
    li.append(acts);
  }
  return li;
}

function action(glyph, label, onClick, extra = "") {
  const button = document.createElement("button");
  button.textContent = glyph;
  button.title = label;
  button.setAttribute("aria-label", `${label} this file`);
  if (extra) button.className = extra;
  button.onclick = onClick;
  return button;
}

async function edit(file, li) {
  const name = prompt("Name:", file.file_name);
  if (name === null) return;
  const tag = prompt("Tag (blank for none):", file.tag || "");
  if (tag === null) return;
  li.classList.add("busy");
  try {
    await ask(`${api}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: file.id, name, tag }),
    });
    say("");
    await load();
  } catch (error) {
    li.classList.remove("busy");
    say(explain(error.message));
  }
}

async function remove(file, li) {
  if (!confirm(`Remove ${file.file_name}?`)) return;
  li.classList.add("busy");
  try {
    await ask(`${api}/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: file.id }),
    });
    say("");
    await load();
  } catch (error) {
    li.classList.remove("busy");
    say(explain(error.message));
  }
}

// One at a time, in the order they were chosen: it keeps the list in a predictable order and
// keeps a dropped folder from spending the room's whole write allowance in one second.
async function upload(files) {
  if (busy || state.closed || !files.length) return;
  busy = true;
  const tag = tagbox.value.trim();
  let done = 0;
  const failures = [];
  for (const file of files) {
    subEl.textContent = `uploading ${done + 1} of ${files.length} — ${file.name}`;
    const form = new FormData();
    form.append("file", file);
    if (tag) form.append("tag", tag);
    try {
      await ask(`${api}/upload`, { method: "POST", body: form });
      done += 1;
    } catch (error) {
      failures.push(`${file.name}: ${explain(error.message)}`);
    }
  }
  busy = false;
  say(failures.join("  "));
  await load();
}

zone.onclick = () => picker.click();
zone.onkeydown = (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); picker.click(); }
};
picker.onchange = () => { const files = [...picker.files]; picker.value = ""; upload(files); };

for (const name of ["dragenter", "dragover"]) {
  zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.add("over"); });
}
for (const name of ["dragleave", "drop"]) {
  zone.addEventListener(name, () => zone.classList.remove("over"));
}
zone.addEventListener("drop", (event) => {
  event.preventDefault();
  upload([...event.dataTransfer.files]);
});
// Without these the browser helpfully navigates away to display the file you just dropped
// slightly off target, losing the page.
for (const name of ["dragover", "drop"]) {
  window.addEventListener(name, (event) => event.preventDefault());
}

load();
