import React, { useState } from "react";
import { TRIP } from "./config";
import { signIn } from "./api";

export default function Gate() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pin) { setError("Enter the PIN."); return; }
    setBusy(true);
    setError("");
    try {
      await signIn(pin);
      /* App picks up the session and swaps this screen out */
    } catch (e) {
      setError(e.message);
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pd-gate">
      <div className="pd-cover">
        <div className="pd-crest">✦</div>
        <div className="pd-covertop">Itinerary of travel</div>
        <h1 className="pd-covertitle">{TRIP.name}</h1>
        <div className="pd-covercode">{TRIP.code}</div>

        <label className="pd-pinlabel">
          PIN
          <input
            className="pd-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            autoComplete="current-password"
            maxLength={24}
            value={pin}
            placeholder="••••••"
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
        </label>

        <button className="pd-open" onClick={submit} disabled={busy}>
          {busy ? "Checking…" : "Open itinerary"}
        </button>

        {error && <div className="pd-error">{error}</div>}
      </div>
    </div>
  );
}
