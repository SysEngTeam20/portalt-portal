import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { generateLLMToken } from "@/lib/tokens";

export async function POST(
  req: NextRequest, 
  { params }: any
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const client = await clientPromise;
    const db = client.db("cluster0");

    const activityId = params.activityId;

    // Verify activity exists and belongs to organization
    const activity = await db.collection("activities").findOne({
      _id: new ObjectId(activityId),
      orgId,
      ragEnabled: true
    });

    if (!activity) {
      return new NextResponse("Activity not found or RAG not enabled", { status: 404 });
    }

    // Generate a new LLM access token
    const token = await generateLLMToken(activityId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error("[RAG_TOKEN_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}