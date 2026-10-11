import app from "../server";

// Catch-all Vercel function for the Express API.
export const config = {
  maxDuration: 300,
};

export default app;
