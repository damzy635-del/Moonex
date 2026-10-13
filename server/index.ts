import "dotenv/config";
import express from "express";
import {MODEL_PROFILES} from "../packages/model-catalog/index";
import chatHandler from "./chat-handler";

const app = express();
app.disable("x-powered-by");
app.use(express.json({limit: "1mb"}));

app.get("/api/v1/health", (_req, res) => res.json({status: "ok", service: "moonex-api"}));
app.get("/api/v1/models", (_req, res) => res.json({models: MODEL_PROFILES}));

app.post("/api/v1/chat", (req, res) => {
  // Express 4 does not automatically forward rejected async handler promises.
  // Keep unexpected failures from becoming unhandled rejections or hanging requests.
  void Promise.resolve(chatHandler(req, res)).catch((error: unknown) => {
    console.error("Unhandled chat handler failure", error);

    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }

    res.status(500).json({error: "Internal server error"});
  });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.info(`Moonex API listening on :${port}`));
