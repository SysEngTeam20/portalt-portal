import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbClient } from "@/lib/db";

// Define minimal interfaces with just what we need
interface ShareCode {
  activityId: any;
}

interface Activity {
  _id: any;
  title: string;
  description: string;
  format: string;
  platform: string;
}

interface Scene {
  name: string;
  configuration: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { shareCode } = req.query;

    if (!shareCode || typeof shareCode !== 'string') {
      return res.status(400).json({ message: "Share code is required" });
    }

    const client = getDbClient();
    const db = client.db("cluster0");
    const shareCodesCollection = db.collection("shareCodes");
    const activitiesCollection = db.collection("activities");
    const scenesCollection = db.collection("scenes");

    // Using any type to bypass TypeScript errors
    type AnyObject = any;

    // Find valid share code
    const shareCodeDoc: AnyObject = await shareCodesCollection.findOne({
      shareCode,
      expiresAt: { $gt: new Date() }
    } as AnyObject);

    if (!shareCodeDoc) {
      return res.status(404).json({ message: "Invalid or expired share code" });
    }

    // Get activity
    const activity: AnyObject = await activitiesCollection.findOne({
      _id: shareCodeDoc.activityId
    } as AnyObject);

    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Get all scenes for this activity - using a workaround for TypeScript issues
    const scenesCursor = scenesCollection.find({ 
      activityId: activity._id 
    } as AnyObject) as AnyObject;
    
    const scenes: AnyObject[] = await scenesCursor.toArray();
      
    // Sort manually
    const sortedScenes = [...scenes].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      return orderA - orderB;
    });
    
    const firstScene = sortedScenes[0];

    if (!firstScene) {
      return res.status(404).json({ message: "No scenes found for this activity" });
    }

    return res.status(200).json({
      activity: {
        title: activity.title,
        description: activity.description,
        format: activity.format,
        platform: activity.platform
      },
      scene: {
        name: firstScene.name,
        configuration: firstScene.configuration
      }
    });
  } catch (error) {
    console.error("[PUBLIC_SHARE_API]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
} 