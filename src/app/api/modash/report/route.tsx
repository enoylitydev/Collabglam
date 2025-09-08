// ================================
// /app/api/modash/report/route.ts (Minor polish; endpoint unchanged)
// Server route: fetches Modash reports for Instagram/YouTube/TikTok
// ================================
import { NextRequest, NextResponse } from "next/server";


const API_BASE = process.env.MODASH_BASE_URL || "https://api.modash.io/v1";


function toCalcMethod(input?: string): "median" | "average" {
return input?.toLowerCase() === "average" ? "average" : "median";
}


export async function GET(req: NextRequest) {
try {
const token = process.env.MODASH_API_KEY;
if (!token) {
return NextResponse.json(
{ error: "Server is missing MODASH_API_KEY" },
{ status: 500 }
);
}


const { searchParams } = new URL(req.url);
const platform = (searchParams.get("platform") || "").toLowerCase();
const userId = searchParams.get("userId") || ""; // handle or numeric id
const calculationMethod = toCalcMethod(searchParams.get("calculationMethod") || undefined);


if (!platform || !["instagram", "tiktok", "youtube"].includes(platform)) {
return NextResponse.json(
{ error: "platform must be instagram|tiktok|youtube" },
{ status: 400 }
);
}
if (!userId) {
return NextResponse.json({ error: "userId is required" }, { status: 400 });
}


const url = `${API_BASE}/${platform}/profile/${encodeURIComponent(
userId
)}/report?calculationMethod=${encodeURIComponent(calculationMethod)}`;


const upstream = await fetch(url, {
method: "GET",
headers: {
Authorization: `Bearer ${token}`,
Accept: "application/json",
},
cache: "no-store",
});


const text = await upstream.text();
const contentType = upstream.headers.get("content-type") || "application/json";


return new NextResponse(text, {
status: upstream.status,
headers: { "content-type": contentType },
});
} catch (err: any) {
console.error("/api/modash/report error", err);
return NextResponse.json(
{ error: err?.message || "Internal error" },
{ status: 500 }
);
}
}