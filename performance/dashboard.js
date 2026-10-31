import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.API_URL;
if (!baseUrl) {
  throw new Error("Set API_URL to the deployed API base URL, for example https://api.example.com/api/v1.");
}

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
  scenarios: {
    dashboard_reads: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || "1m",
    },
  },
};

export default function () {
  const headers = { Accept: "application/json" };
  if (__ENV.API_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.API_TOKEN}`;
  }
  const response = http.get(`${baseUrl.replace(/\/$/, "")}/reports/summary`, {
    headers,
    tags: { endpoint: "reports-summary" },
  });

  check(response, {
    "summary endpoint returns 200": (result) => result.status === 200,
    "summary endpoint responds with JSON": (result) =>
      result.headers["Content-Type"]?.includes("application/json") ?? false,
  });
  sleep(1);
}
