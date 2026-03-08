// Server-only — never import this file from src/ (client bundle)
export const ESB = `${process.env.ESB_BASE_URL}/${process.env.ESB_API_KEY}`;
export const MSSTATS_BASE = process.env.MSSTATS_BASE_URL || "https://msstats.optimalwayconsulting.com/v1/fcbq";
