import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from 'uuid';
import { getDbClient, Relations, safeLog, isUsingMongo } from "@/lib/db";
import { uploadDocument } from "@/lib/cos";
import { IncomingForm } from 'formidable';
import fs from 'fs';

// Disable the default body parser for this route since we're handling file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Promisify formidable parsing
const parseForm = (req: NextApiRequest) => {
  return new Promise<{fields: any, files: any}>((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    // GET list of organization's documents
    if (req.method === 'GET') {
      const activityId = req.query.activityId as string | undefined;

      const client = getDbClient();
      const db = client.db("cluster0");
      const documentsCollection = db.collection("documents");

      let documents = [];
      
      if (activityId) {
        // Get documents associated with the activity
        const documentIds = await Relations.getDocumentsByActivityId(activityId);
        if (documentIds.length > 0) {
          // If using MongoDB, fetch in batch
          if (isUsingMongo()) {
            const cursor = documentsCollection.find({ 
              _id: { $in: documentIds },
              orgId 
            } as any);
            documents = await cursor.toArray();
          } else {
            // For SQLite, fetch one by one
            const promises = documentIds.map(id => 
              documentsCollection.findOne({ _id: id, orgId } as any)
            );
            documents = (await Promise.all(promises)).filter(Boolean);
          }
        }
      } else {
        // Get all organization's documents
        const cursor = documentsCollection.find({ orgId } as any);
        documents = await cursor.toArray();
      }

      return res.status(200).json(documents);
    }
    
    // POST upload new document
    else if (req.method === 'POST') {
      // Parse the multipart form data
      const { files, fields } = await parseForm(req);
      const fileEntry = files.file;
      const activityId = fields.activityId ? String(fields.activityId) : null;
      
      if (!fileEntry) {
        return res.status(400).json({ message: "File is required" });
      }
      
      // Handle both single file and array of files (formidable can return either)
      const file = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;
      
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      safeLog({
        name: file.originalFilename || 'unnamed-file',
        type: file.mimetype || 'application/octet-stream',
        size: fs.statSync(file.filepath).size,
        activityId
      }, 'Uploading file');

      // Generate a safe filename
      const timestamp = Date.now();
      const safeName = (file.originalFilename || 'unnamed-file').replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${timestamp}-${safeName}`;

      // Upload to COS
      const buffer = fs.readFileSync(file.filepath);
      const cosKey = await uploadDocument(buffer, uniqueFilename, file.mimetype || 'application/octet-stream');

      console.log('File uploaded to COS:', cosKey);

      const client = getDbClient();
      const db = client.db("cluster0");

      // Create document metadata
      const document = {
        _id: uuidv4(),
        filename: file.originalFilename || 'unnamed-file',
        originalName: file.originalFilename || 'unnamed-file',
        mimeType: file.mimetype || 'application/octet-stream',
        size: fs.statSync(file.filepath).size,
        url: cosKey,
        orgId,
        activityIds: [] as string[],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection("documents").insertOne(document);

      // If activityId provided, link the document to the activity
      if (activityId) {
        try {
          // Update the document's activityIds array
          document.activityIds.push(activityId);
          await db.collection("documents").updateOne(
            { _id: document._id },
            { $set: { activityIds: document.activityIds, updatedAt: new Date() } }
          );
          
          // Create the relation in the join table
          await Relations.linkDocumentToActivity(document._id, activityId);
        } catch (linkError) {
          console.error("[DOCUMENTS_API] Error linking document:", linkError);
        }
      }

      // Clean up the temp file
      fs.unlinkSync(file.filepath);

      return res.status(200).json(document);
    }
    
    // Handle unsupported methods
    else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("[DOCUMENTS_API]", error);
    if (error instanceof Error) {
      console.error("[DOCUMENTS_API] Error details:", error.message);
    }
    return res.status(500).json({ message: "Internal Error" });
  }
} 