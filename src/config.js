/* Filled in at startup from config.json — see main.jsx */

export const TRIP = { name: "", from: "", to: "", code: "" };
export const AUTH = { travellerId: "" };

export function applyConfig(json) {
  Object.assign(TRIP, json.trip || {});
  AUTH.travellerId = json.travellerId || "";
}

export const KINDS = {
  flight:   { label: "Flight",   ink: "#14213B" },
  stay:     { label: "Stay",     ink: "#1F6F63" },
  transfer: { label: "Transfer", ink: "#8A6A2F" },
  plan:     { label: "Plan",     ink: "#7A2E3B" },
};
