import React, { useEffect, useState } from "react";
import { getSession, onAuthChange } from "./api";
import Gate from "./Gate";
import Desk from "./Desk";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  return (
    <div className="pd">
      {session === undefined ? null : session ? <Desk /> : <Gate />}
    </div>
  );
}
