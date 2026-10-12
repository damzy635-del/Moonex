export const MODEL_PROFILES = [
{id:"moonex-lite-1.5",label:"Lite",description:"Quick everyday help",tier:"Everyday"},
{id:"moonex-fast-1.5",label:"Fast",description:"Speed for simple tasks",tier:"Everyday"},
{id:"moonex-pro-1.5",label:"Pro",description:"Balanced capability",tier:"Advanced"},
{id:"moonex-pro-max-1.5",label:"Pro Max",description:"More depth for complex work",tier:"Advanced"},
{id:"moonex-ultra-1.5",label:"Ultra",description:"Maximum general capability",tier:"Advanced"},
{id:"moonex-reasoning-1.5",label:"Reasoning",description:"Structured multi-step thinking",tier:"Specialist"},
{id:"moonex-code-1.5",label:"Code",description:"Software engineering",tier:"Specialist"},
{id:"moonex-vision-1.5",label:"Vision",description:"Image understanding",tier:"Specialist"},
{id:"moonex-research-1.5",label:"Research",description:"Synthesis and source-led work",tier:"Specialist"}
] as const;
export type ModelProfileId=typeof MODEL_PROFILES[number]["id"];