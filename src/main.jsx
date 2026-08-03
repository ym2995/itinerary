import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyConfig } from "./config";
import { initSupabase } from "./api";
import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

function fail(message) {
  root.render(
    <div className="pd">
      <div className="pd-gate">
        <div className="pd-cover">
          <div className="pd-crest">✦</div>
          <div className="pd-covertop">Not set up yet</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "#C8CEDA", marginTop: 18 }}>{message}</p>
        </div>
      </div>
    </div>
  );
}

async function start() {
  let cfg;
  try {
    const res = await fetch(new URL("config.json", document.baseURI), { cache: "no-store" });
    cfg = await res.json();
  } catch {
    return fail("Couldn't read config.json. Make sure the file sits next to index.html.");
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseUrl.includes("PASTE")) {
    return fail("Open config.json and paste in your Supabase project URL and anon key.");
  }

  if (!cfg.travellerId) {
    return fail("Open config.json and set travellerId to the name you used before the @ when creating the Supabase user.");
  }

  applyConfig(cfg);
  initSupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}

start();
