(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const form = $("noteForm");
  const idInput = $("noteId");
  const titleInput = $("title");
  const bodyInput = $("body");
  const tagsInput = $("tags");
  const saveBtn = $("saveBtn");
  const cancelBtn = $("cancelBtn");
  const searchInput = $("search");
  const notesEl = $("notes");
  const tagListEl = $("tagList");
  const statusEl = $("status");

  let notes = [];
  let tags = [];
  let totalNotes = 0;
  let activeTag = null;
  let searchTimer = null;

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed (" + res.status + ")");
    return data;
  }

  async function refresh() {
    try {
      const params = new URLSearchParams();
      if (activeTag) params.set("tag", activeTag);
      if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
      const [n, t, all] = await Promise.all([
        api("GET", "/api/notes?" + params),
        api("GET", "/api/tags"),
        api("GET", "/api/notes"),
      ]);
      notes = n;
      tags = t;
      totalNotes = all.length;
      if (activeTag && !tags.some((x) => x.name === activeTag)) {
        activeTag = null;
        return refresh();
      }
      render();
    } catch (e) {
      statusEl.textContent = "Could not load notes: " + e.message;
    }
  }

  function renderTags() {
    tagListEl.innerHTML = "";
    const make = (label, count, tag) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = activeTag === tag ? "active" : "";
      const name = document.createElement("span");
      name.textContent = label;
      const c = document.createElement("span");
      c.className = "count";
      c.textContent = count;
      btn.append(name, c);
      btn.addEventListener("click", () => {
        activeTag = tag;
        refresh();
      });
      li.appendChild(btn);
      tagListEl.appendChild(li);
    };
    make("All notes", totalNotes, null);
    tags.forEach((t) => make("#" + t.name, t.count, t.name));
  }

  function renderNotes() {
    notesEl.innerHTML = "";
    statusEl.textContent = totalNotes
      ? notes.length + " note" + (notes.length === 1 ? "" : "s") + (activeTag ? " tagged #" + activeTag : "")
      : "No notes yet. Add your first one above!";

    notes.forEach((n) => {
      const card = document.createElement("article");
      card.className = "note";

      const h = document.createElement("h3");
      h.textContent = n.title;
      const p = document.createElement("p");
      p.textContent = n.body;

      const tagsWrap = document.createElement("div");
      tagsWrap.className = "note-tags";
      n.tags.forEach((t) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = "#" + t;
        chip.addEventListener("click", () => {
          activeTag = t;
          refresh();
        });
        tagsWrap.appendChild(chip);
      });

      const time = document.createElement("time");
      time.textContent = new Date(n.updated).toLocaleString();

      const actions = document.createElement("div");
      actions.className = "note-actions";
      const edit = document.createElement("button");
      edit.className = "link";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => startEdit(n));
      const del = document.createElement("button");
      del.className = "danger";
      del.textContent = "Delete";
      del.addEventListener("click", () => removeNote(n.id));
      actions.append(edit, del);

      card.append(h, p, tagsWrap, time, actions);
      notesEl.appendChild(card);
    });
  }

  function render() {
    renderTags();
    renderNotes();
  }

  function resetForm() {
    form.reset();
    idInput.value = "";
    saveBtn.textContent = "Add note";
    cancelBtn.hidden = true;
  }

  function startEdit(n) {
    idInput.value = n.id;
    titleInput.value = n.title;
    bodyInput.value = n.body;
    tagsInput.value = n.tags.join(", ");
    saveBtn.textContent = "Update note";
    cancelBtn.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    titleInput.focus();
  }

  async function removeNote(id) {
    if (!confirm("Delete this note?")) return;
    try {
      await api("DELETE", "/api/notes/" + id);
      if (idInput.value === String(id)) resetForm();
      refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      title: titleInput.value,
      body: bodyInput.value,
      tags: tagsInput.value.split(","),
    };
    saveBtn.disabled = true;
    try {
      if (idInput.value) await api("PUT", "/api/notes/" + idInput.value, payload);
      else await api("POST", "/api/notes", payload);
      resetForm();
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener("click", resetForm);
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 250);
  });

  refresh();
})();
