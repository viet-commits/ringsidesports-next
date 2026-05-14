import express from "express";

const app = express();
const PORT = parseInt(process.env.PORT || "9000", 10);

// Health endpoint — must return {"status":"ok"} per Phase 1 acceptance
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Medusa v2 will mount its full router here in later phases.
// For now, this placeholder satisfies the Phase 1 infrastructure verification.

app.listen(PORT, () => {
  console.log(`[ringsidesports-backend] listening on :${PORT}`);
});

export default app;
