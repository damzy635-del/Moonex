import app from "../server.cjs";

// Catch-all Vercel function for the Express API.
export const config = {
  maxDuration: 300,
};

export default app;
