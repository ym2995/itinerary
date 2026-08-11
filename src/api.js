import { createClient } from "@supabase/supabase-js";
import { AUTH } from "./config";

export let supabase = null;

export function initSupabase(url, anonKey) {
  supabase = createClient(url, anonKey);
}

const BUCKET = "docs";
const EMAIL_DOMAIN = "trip.local";

/* ----------------------------- auth ------------------------------ */

export async function signIn(pin) {
  const account = AUTH.loginEmail
    ? AUTH.loginEmail.trim().toLowerCase()
    : `${AUTH.travellerId.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
  const email = account.includes("@") ? account : `${account}@${EMAIL_DOMAIN}`;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
  if (error) throw new Error("That PIN isn't right. Try again.");
}

export function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/* ---------------------------- entries ---------------------------- */

export async function fetchEntries() {
  const { data, error } = await supabase
    .from("entries")
    .select("id, on_date, at_time, kind, title, place, reference, documents(id, name, path)")
    .order("on_date", { ascending: true })
    .order("at_time", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({ ...e, at_time: (e.at_time || "09:00").slice(0, 5) }));
}

export async function createEntry(entry) {
  const { data, error } = await supabase
    .from("entries")
    .insert({
      on_date: entry.on_date,
      at_time: entry.at_time,
      kind: entry.kind,
      title: entry.title.trim(),
      place: entry.place || "",
      reference: entry.reference || "",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id;
}

export async function updateEntry(id, entry) {
  const { error } = await supabase
    .from("entries")
    .update({
      on_date: entry.on_date,
      at_time: entry.at_time,
      kind: entry.kind,
      title: entry.title.trim(),
      place: entry.place || "",
      reference: entry.reference || "",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEntry(id) {
  const { data: docs } = await supabase.from("documents").select("path").eq("entry_id", id);
  if (docs?.length) await supabase.storage.from(BUCKET).remove(docs.map((d) => d.path));
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------- documents --------------------------- */

const MAX_BYTES = 20 * 1024 * 1024;

export async function uploadDocument(entryId, file) {
  if (file.size > MAX_BYTES) throw new Error("That file is over 20 MB. Try a smaller scan or a PDF.");
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${entryId}/${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) throw new Error("Upload failed. Check the connection and try again.");
  const { error } = await supabase.from("documents").insert({
    entry_id: entryId,
    name: file.name,
    path,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function documentUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw new Error("Couldn't open that document.");
  return data.signedUrl;
}

export async function deleteDocument(doc) {
  await supabase.storage.from(BUCKET).remove([doc.path]);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}

/* ------------------- read a document with Gemini ----------------- */

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}

export async function analyzeDocument(file, contextDate) {
  if (file.size > MAX_BYTES) throw new Error("That file is over 20 MB.");
  const b64 = await toBase64(file);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const { data, error } = await supabase.functions.invoke("extract-document", {
    body: {
      data: b64,
      mimeType: file.type || "application/pdf",
      fallbackDate: contextDate,
    },
  });

  if (error) {
    let msg = "Couldn't read that document. Add the details by hand.";
    try {
      const body = await error.context?.json();
      if (body?.error) msg = body.error;
    } catch { /* keep the generic message */ }
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  return data;
}
