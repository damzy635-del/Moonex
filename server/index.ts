import "dotenv/config";
import express from "express";
import {MODEL_PROFILES} from "../packages/model-catalog/index";
const app=express();app.disable("x-powered-by");app.use(express.json({limit:"1mb"}));
app.get("/api/v1/health",(_req,res)=>res.json({status:"ok",service:"moonex-api"}));
app.get("/api/v1/models",(_req,res)=>res.json({models:MODEL_PROFILES}));
app.post("/api/v1/chat",(_req,res)=>res.status(501).json({error:{code:"AI_ROUTING_NOT_CONFIGURED",message:"AI provider routing is not configured yet."}}));
const port=Number(process.env.PORT??3001);app.listen(port,()=>console.info(`Moonex API listening on :${port}`));