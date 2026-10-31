# SubLoop demo runbook

This runbook uses the frontend's clearly labeled sample-data mode. It is a UI walkthrough, not evidence that billing, authentication, payment processing, or API persistence is implemented.

## Before the demo

1. Start the app using the instructions in the repository README.
2. Open `http://localhost:3000` and confirm the **Demo workspace** banner is visible.
3. Keep the dashboard and customer portal open in separate tabs.
4. If using the Docker setup, confirm the web app is healthy at port 3000. Mailpit is available at `http://localhost:8025` when an API/email service is added.

## Three-minute walkthrough

### 0:00–0:40 — Finance overview

- Start on the finance dashboard.
- Explain the active subscription, monthly revenue, outstanding balance, and overdue invoice summary cards.
- Point out the six-month revenue chart and payment-method breakdown.

### 0:40–1:20 — Overdue follow-up

- Filter the invoice table by due-date range, status, customer, or plan.
- Export the currently visible invoice page as CSV and show the downloaded file.
- Mention that live filter and pagination requests use the documented invoice API contract; server-side sorting and API performance still need backend support.

### 1:20–2:30 — Customer experience

- Open **Customer portal** from the navigation.
- Review the sample customer's plans and upcoming renewal.
- Switch to **Invoices**, show paid and unpaid invoice statuses, then use **Print / PDF** and choose **Save as PDF** in the browser print dialog.
- Try a subscription action and point out the notice that demo actions are not persisted.

### 2:30–3:00 — Close

- Explain the boundary: the screens are ready for API integration; customer ownership, payments, billing, and durable actions must be enforced by the API before production.
- Do not present sample amounts or performance figures as live system results.
