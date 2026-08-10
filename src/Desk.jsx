import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { TRIP, KINDS } from "./config";
import {
  fetchEntries, createEntry, updateEntry, deleteEntry,
  uploadDocument, documentUrl, deleteDocument, signOut, analyzeDocument,
} from "./api";

/* ---------------------------- date helpers ------------------------- */
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

function monthMatrix(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ------------------------------- desk ------------------------------ */
export default function Desk() {
  const todayIso = iso(new Date());
  const start = parse(TRIP.from);
  const end = parse(TRIP.to);
  const tripLength = Math.round((end - start) / 86400000) + 1;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(
    todayIso >= TRIP.from && todayIso <= TRIP.to ? todayIso : TRIP.from
  );
  const [cursor, setCursor] = useState(() => ({ y: start.getFullYear(), m: start.getMonth() }));
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const fileRefs = useRef({});
  const scanRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setEntries(await fetchEntries());
      setNotice("");
    } catch {
      setNotice("Couldn't load the itinerary. Check the connection and reload.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [load]);

  const cells = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);
  const byDate = useMemo(() => {
    const m = {};
    entries.forEach((e) => { (m[e.on_date] ||= []).push(e); });
    return m;
  }, [entries]);

  const dayEntries = byDate[selected] || [];
  const selDate = parse(selected);
  const dayNo = Math.round((selDate - start) / 86400000) + 1;
  const inTrip = (d) => d >= start && d <= end;
  const docCount = dayEntries.reduce((n, e) => n + (e.documents?.length || 0), 0);

  const pad = (s, n) => (s + "<".repeat(n)).slice(0, n).replace(/ /g, "<");
  const mrz1 = pad(`ITN<<${TRIP.name.replace(/[^A-Za-z]+/g, "<").toUpperCase()}`, 44);
  const mrz2 = pad(
    `${TRIP.from.replace(/-/g, "")}<${TRIP.to.replace(/-/g, "")}` +
    `<DAY${String(Math.max(dayNo, 0)).padStart(2, "0")}` +
    `<ENT${String(dayEntries.length).padStart(2, "0")}` +
    `<DOC${String(docCount).padStart(2, "0")}`, 44
  );

  /* ------------------------------ actions -------------------------- */
  const openNew = () =>
    setDraft({ id: null, on_date: selected, at_time: "09:00", kind: "plan", title: "", place: "", reference: "" });

  const save = async () => {
    if (!draft.title.trim()) { setNotice("Give the entry a name before saving."); return; }
    setSaving(true);
    try {
      if (draft.id) {
        await updateEntry(draft.id, draft);
      } else {
        const newId = await createEntry(draft);
        if (draft.pendingFile && newId) await uploadDocument(newId, draft.pendingFile);
      }
      setSelected(draft.on_date);
      setDraft(null);
      await load();
    } catch {
      setNotice("That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this entry and its documents?")) return;
    setSaving(true);
    try { await deleteEntry(id); setDraft(null); await load(); }
    catch { setNotice("Couldn't delete that entry."); }
    finally { setSaving(false); }
  };

  const attach = async (entryId, file) => {
    if (!file) return;
    setNotice("Uploading…");
    try { await uploadDocument(entryId, file); setNotice(""); await load(); }
    catch (e) { setNotice(e.message); }
  };

  const openDoc = async (doc) => {
    const tab = window.open("", "_blank");
    try {
      const url = await documentUrl(doc.path);
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch (e) { tab?.close(); setNotice(e.message); }
  };

  const dropDoc = async (doc) => {
    if (!window.confirm(`Remove ${doc.name}?`)) return;
    try { await deleteDocument(doc); await load(); }
    catch { setNotice("Couldn't remove that document."); }
  };

  /* ---------------------- single document scan --------------------- */
  const scan = async (file) => {
    if (!file) return;
    setReading(true);
    setNotice("Reading the document\u2026");
    try {
      const r = await analyzeDocument(file, selected);
      setDraft({
        id: null,
        on_date: r.on_date || selected,
        at_time: r.at_time || "09:00",
        kind: r.kind || "plan",
        title: r.title || "",
        place: r.place || "",
        reference: r.reference || "",
        pendingFile: file,
      });
      setNotice("Check the details below, then save.");
    } catch (e) {
      setNotice(e.message);
    } finally {
      setReading(false);
    }
  };

  /* ----------------------- multi document queue -------------------- */
  const scanMany = async (files) => {
    if (!files?.length) return;
    if (files.length === 1) { scan(files[0]); return; }
    const items = Array.from(files).map(f => ({ file: f, status: "pending", result: null, error: null }));
    setQueue(items);
    setQueueOpen(true);
    setDraft(null);
    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: "reading" };
      setQueue([...updated]);
      try {
        const r = await analyzeDocument(updated[i].file, selected);
        updated[i] = {
          ...updated[i], status: "done",
          result: {
            on_date: r.on_date || selected,
            at_time: r.at_time || "09:00",
            kind: r.kind || "plan",
            title: r.title || "",
            place: r.place || "",
            reference: r.reference || "",
          },
        };
      } catch (e) {
        updated[i] = { ...updated[i], status: "error", error: e.message };
      }
      setQueue([...updated]);
      if (i < updated.length - 1) await new Promise(r => setTimeout(r, 1200));
    }
  };

  const updateQueueItem = (i, field, value) =>
    setQueue(q => q.map((item, idx) => idx === i ? { ...item, result: { ...item.result, [field]: value } } : item));

  const discardQueueItem = (i) =>
    setQueue(q => q.filter((_, idx) => idx !== i));

  const saveAll = async () => {
    const ready = queue.filter(item => item.status === "done" && item.result?.title);
    if (!ready.length) { setNotice("Nothing to save — fix the errors or add titles first."); return; }
    setSaving(true);
    let saved = 0;
    for (const item of ready) {
      try {
        const newId = await createEntry(item.result);
        if (newId) await uploadDocument(newId, item.file);
        saved++;
      } catch { /* keep going on individual failure */ }
    }
    setQueueOpen(false);
    setQueue([]);
    setNotice(`${saved} of ${ready.length} entries saved.`);
    await load();
    setSaving(false);
  };

  /* ------------------------------ render --------------------------- */
  return (
    <>
      <header className="pd-head">
        <div>
          <div className="pd-eyebrow">Itinerary of travel · {TRIP.code}</div>
          <h1 className="pd-title">{TRIP.name}</h1>
          <div className="pd-sub">
            {start.getDate()} {MONTHS[start.getMonth()].slice(0, 3)} — {end.getDate()}{" "}
            {MONTHS[end.getMonth()].slice(0, 3)} {end.getFullYear()} · {tripLength} days
          </div>
        </div>
        <button className="pd-lock" onClick={signOut}>Lock</button>
      </header>

      {notice && (
        <div className="pd-notice" onClick={() => setNotice("")} role="status">{notice}</div>
      )}

      <div className="pd-body">
        {/* --------------------------- calendar --------------------- */}
        <aside className="pd-cal">
          <div className="pd-calhead">
            <button className="pd-nav" aria-label="Previous month"
              onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))}>‹</button>
            <span>{MONTHS[cursor.m]} {cursor.y}</span>
            <button className="pd-nav" aria-label="Next month"
              onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))}>›</button>
          </div>

          <div className="pd-grid">
            {DOW.map((d, i) => <div key={i} className="pd-dow">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="pd-cell pd-empty" />;
              const k = iso(d);
              const list = byDate[k] || [];
              return (
                <button key={i}
                  className={`pd-cell ${inTrip(d) ? "in" : "out"} ${k === selected ? "sel" : ""} ${k === todayIso ? "today" : ""}`}
                  onClick={() => setSelected(k)}>
                  <span className="pd-num">{d.getDate()}</span>
                  <span className="pd-dots">
                    {list.slice(0, 4).map((e) => <i key={e.id} style={{ background: KINDS[e.kind]?.ink }} />)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pd-legend">
            {Object.entries(KINDS).map(([k, v]) => (
              <span key={k}><i style={{ background: v.ink }} />{v.label}</span>
            ))}
          </div>
        </aside>

        {/* ----------------------------- day ------------------------ */}
        <section className="pd-day">
          <div className="pd-dayhead">
            <div>
              <div className="pd-eyebrow">
                {inTrip(selDate) ? `Day ${dayNo} of ${tripLength}` : "Outside trip dates"}
              </div>
              <h2 className="pd-dayttl">
                {selDate.getDate()} {MONTHS[selDate.getMonth()]}
                <span className="pd-dayyr">{selDate.getFullYear()}</span>
              </h2>
            </div>
            <div className="pd-actions">
              <button className="pd-scan" onClick={() => scanRef.current?.click()} disabled={reading}>
                {reading ? "Reading\u2026" : "Read documents"}
              </button>
              <button className="pd-add" onClick={openNew}>Add entry</button>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple style={{ display: "none" }}
                ref={scanRef}
                onChange={(ev) => { scanMany(ev.target.files); ev.target.value = ""; }} />
            </div>
          </div>

          <div className="pd-list" key={selected}>
            {loading && <div className="pd-blank">Loading the itinerary\u2026</div>}

            {!loading && dayEntries.length === 0 && !draft && !queueOpen && (
              <div className="pd-blank">Nothing recorded for this date. Add a flight, a stay, or a plan.</div>
            )}

            {dayEntries.map((e) => (
              <article className="pd-entry" key={e.id} style={{ "--ink": KINDS[e.kind]?.ink }}>
                <div className="pd-time">{e.at_time}</div>
                <div className="pd-main">
                  <div className="pd-kind">{KINDS[e.kind]?.label}</div>
                  <h3 className="pd-etitle">{e.title}</h3>
                  {e.place && <div className="pd-place">{e.place}</div>}
                  {e.reference && <div className="pd-ref">{e.reference}</div>}

                  <div className="pd-docs">
                    {(e.documents || []).map((d) => (
                      <span key={d.id} className="pd-stampwrap">
                        <button className="pd-stamp" onClick={() => openDoc(d)} title={`Open ${d.name}`}>
                          <span className="pd-stampk">{KINDS[e.kind]?.label}</span>
                          <span className="pd-stampn">{d.name}</span>
                        </button>
                        <button className="pd-x" onClick={() => dropDoc(d)} aria-label={`Remove ${d.name}`}>×</button>
                      </span>
                    ))}
                    <button className="pd-clip" onClick={() => fileRefs.current[e.id]?.click()}>
                      + Attach document
                    </button>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{ display: "none" }}
                      ref={(el) => (fileRefs.current[e.id] = el)}
                      onChange={(ev) => { attach(e.id, ev.target.files[0]); ev.target.value = ""; }} />
                  </div>
                </div>
                <div className="pd-side">
                  <button className="pd-edit" onClick={() => setDraft({ ...e })}>Edit</button>
                </div>
              </article>
            ))}

            {/* -------------------- multi-doc queue ----------------- */}
            {queueOpen && queue.length > 0 && (
              <div className="pd-queue">
                <div className="pd-qhead">
                  <span>
                    {queue.filter(i => i.status === "done").length} of {queue.length} read
                    {queue.some(i => i.status === "reading") && " \u2014 working\u2026"}
                  </span>
                  <button className="pd-qclose" onClick={() => { setQueueOpen(false); setQueue([]); }}>Discard all</button>
                </div>

                {queue.map((item, i) => (
                  <div key={i} className={`pd-qrow pd-qrow--${item.status}`}>
                    <div className="pd-qfile">{item.file.name}</div>

                    {item.status === "reading" && <div className="pd-qstate">Reading\u2026</div>}
                    {item.status === "error" && <div className="pd-qstate pd-qerr">{item.error}</div>}

                    {item.status === "done" && item.result && (
                      <div className="pd-qfields">
                        <div className="pd-qrow2">
                          <label>Date
                            <input type="date" value={item.result.on_date}
                              onChange={e => updateQueueItem(i, "on_date", e.target.value)} />
                          </label>
                          <label>Time
                            <input type="time" value={item.result.at_time}
                              onChange={e => updateQueueItem(i, "at_time", e.target.value)} />
                          </label>
                          <label>Type
                            <select value={item.result.kind}
                              onChange={e => updateQueueItem(i, "kind", e.target.value)}>
                              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </label>
                        </div>
                        <label className="pd-qfull">What is it
                          <input value={item.result.title}
                            onChange={e => updateQueueItem(i, "title", e.target.value)} />
                        </label>
                        <div className="pd-qrow2">
                          <label>Where
                            <input value={item.result.place}
                              onChange={e => updateQueueItem(i, "place", e.target.value)} />
                          </label>
                          <label>Reference
                            <input value={item.result.reference}
                              onChange={e => updateQueueItem(i, "reference", e.target.value)} />
                          </label>
                        </div>
                      </div>
                    )}

                    <button className="pd-qdiscard" onClick={() => discardQueueItem(i)} title="Remove">×</button>
                  </div>
                ))}

                {queue.every(i => i.status !== "reading") && (
                  <div className="pd-qbar">
                    <button className="pd-save" onClick={saveAll} disabled={saving}>
                      {saving ? "Saving\u2026" : `Save ${queue.filter(i => i.status === "done" && i.result?.title).length} entries`}
                    </button>
                    <button className="pd-cancel" onClick={() => { setQueueOpen(false); setQueue([]); }}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {/* ----------------------- editor ----------------------- */}
            {draft && (
              <div className="pd-editor">
                <div className="pd-editrow">
                  <label>Date
                    <input type="date" value={draft.on_date}
                      onChange={(e) => setDraft({ ...draft, on_date: e.target.value })} />
                  </label>
                  <label>Time
                    <input type="time" value={draft.at_time}
                      onChange={(e) => setDraft({ ...draft, at_time: e.target.value })} />
                  </label>
                  <label>Type
                    <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                      {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="pd-full">What is it
                  <input value={draft.title} placeholder="BLR \u2192 HND, or Hotel Kanra check in"
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <div className="pd-editrow">
                  <label>Where
                    <input value={draft.place} placeholder="Terminal, address, station"
                      onChange={(e) => setDraft({ ...draft, place: e.target.value })} />
                  </label>
                  <label>Reference
                    <input value={draft.reference} placeholder="PNR, booking no."
                      onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
                  </label>
                </div>
                {draft.pendingFile && (
                  <div className="pd-pending">Will attach {draft.pendingFile.name}</div>
                )}
                <div className="pd-editbar">
                  <button className="pd-save" onClick={save} disabled={saving}>
                    {saving ? "Saving\u2026" : draft.id ? "Save changes" : "Add entry"}
                  </button>
                  <button className="pd-cancel" onClick={() => setDraft(null)}>Cancel</button>
                  {draft.id && <button className="pd-del" onClick={() => remove(draft.id)}>Delete</button>}
                </div>
              </div>
            )}
          </div>

          <div className="pd-mrz" aria-hidden="true">
            <div>{mrz1}</div>
            <div>{mrz2}</div>
          </div>
        </section>
      </div>
    </>
  );
}
