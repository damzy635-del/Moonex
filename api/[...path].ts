import app from "../src/.vercel/server.cjs";

// Catch-all Vercel function for the Express API.
// The build step creates the bundled server module before Vercel packages this function.
export const config = {
  maxDuration: 300,
};

export default app;
