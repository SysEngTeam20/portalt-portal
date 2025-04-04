import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { getDbClient, safeLog } from "@/lib/db";
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

interface ActivityDocument {
  _id: string;
  title: string;
  bannerUrl: string;
  platform: string;
  format: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

const ActivitySchema = z.object({
  _id: z.string().uuid(),
  title: z.string().min(1),
  bannerUrl: z.string().url().or(z.literal("")),
  platform: z.enum(["headset", "web"]),
  format: z.enum(["AR", "VR"]),
  orgId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const client = getDbClient();
  const db = client.db("cluster0");
  const activitiesCollection = db.collection<ActivityDocument>("activities");

  // GET all activities
  if (req.method === 'GET') {
    try {
      safeLog(req.query, 'Query parameters');
      let orgId: string | undefined;
      
      // First try to get orgId from query params
      if (req.query.orgId && typeof req.query.orgId === 'string') {
        orgId = req.query.orgId;
        console.log('Found orgId in query params:', orgId)
      } else {
        // Fall back to Clerk auth
        const auth = getAuth(req);
        if (auth.orgId) {
          orgId = auth.orgId;
          console.log('Found orgId in auth:', orgId)
        }
      }

      if (!orgId) {
        console.log('No orgId found in query params or auth')
        return res.status(400).json({ message: "orgId is required either as a query parameter or through authentication" });
      }

      const activitiesCursor = await activitiesCollection.find({ orgId });
      const activitiesArray = await activitiesCursor.toArray();
      return res.status(200).json(activitiesArray);
    } catch (error) {
      console.error("[ACTIVITIES_GET]", error);
      return res.status(500).json({ message: "Internal Error" });
    }
  } 
  
  // POST create new activity
  else if (req.method === 'POST') {
    try {
      const { orgId } = getAuth(req);
      
      if (!orgId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { title, bannerUrl, platform, format } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      if (!format || !["AR", "VR"].includes(format)) {
        return res.status(400).json({ message: "Valid format (AR/VR) is required" });
      }

      if (!platform || !["headset", "web"].includes(platform)) {
        return res.status(400).json({ message: "Valid platform (headset/web) is required" });
      }

      const newActivity = {
        _id: uuidv4(),
        title,
        bannerUrl: bannerUrl || "",
        platform,
        format,
        orgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenes: [{
          id: crypto.randomUUID(),
          name: "Main Scene",
          order: 1,
          config: {
            objects: []
          }
        }]
      };

      const parseResult = ActivitySchema.safeParse(newActivity);
      if (!parseResult.success) {
        return res.status(400).json({ errors: parseResult.error.format() });
      }

      await activitiesCollection.insertOne(newActivity);

      return res.status(200).json(newActivity);
    } catch (error) {
      console.error("[ACTIVITIES_POST]", error);
      return res.status(500).json({ message: "Internal Error" });
    }
  } 
  
  // Handle unsupported methods
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 