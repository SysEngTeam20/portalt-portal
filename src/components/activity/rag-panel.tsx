'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Trash2, Upload, Library, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from '@/types/activity';
import { Document } from '@/types/document';
import { DirectUpload } from '@/components/direct-upload';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@clerk/nextjs';

interface RagPanelProps {
  activity: Activity;
}

export function RagPanel({ activity }: RagPanelProps) {
  const { toast } = useToast();
  const { orgId } = useAuth();
  const [isEnabled, setIsEnabled] = useState(activity.ragEnabled ?? false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [libraryDocuments, setLibraryDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEnabled(activity.ragEnabled ?? false);
    fetchDocuments();
    fetchLibraryDocuments();
  }, [activity._id, activity.ragEnabled]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/documents?activityId=${activity._id}`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLibraryDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('Failed to fetch library');
      const data = await response.json();
      setLibraryDocuments(data);
    } catch (error) {
      console.error('Error fetching library documents:', error);
      toast({
        title: "Error",
        description: "Failed to load asset library",
        variant: "destructive",
      });
    }
  };

  const handleRagToggle = async (enabled: boolean) => {
    try {
      const response = await fetch(`/api/activities/${activity._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activity.title,
          description: activity.description,
          bannerUrl: activity.bannerUrl,
          format: activity.format,
          platform: activity.platform,
          ragEnabled: enabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update RAG setting');
      setIsEnabled(enabled);
      toast({
        title: "Success",
        description: `RAG ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update RAG setting",
        variant: "destructive",
      });
    }
  };

  const handleUploadComplete = async (fileUrl: string, fileName: string, fileSize: number) => {
    if (!orgId) {
      toast({
        title: "Error",
        description: "Organization ID is required",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Document upload completed, registering with API:', {
        filename: fileName,
        url: fileUrl,
        activityId: activity._id
      });
      
      // Register document with the API
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: fileName,
          url: fileUrl,
          mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          size: fileSize,
          activityId: activity._id
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to register document:', errorText);
        throw new Error(`Failed to register document: ${response.status} ${response.statusText}`);
      }
      
      const document = await response.json();
      console.log('Document registered successfully:', document);
      
      // Add the new document to the list and refresh
      setDocuments([...documents, document]);
      setDialogOpen(false);

      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    } catch (error) {
      console.error('Document registration error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to register document",
        variant: "destructive",
      });
    }
  };

  const handleLibrarySelect = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document._id}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity._id }),
      });

      if (!response.ok) throw new Error('Failed to link document');
      await fetchDocuments();
      setDialogOpen(false);

      toast({
        title: "Success",
        description: "Document linked successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to link document",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/access`);
      if (!response.ok) throw new Error('Failed to get document access');
      
      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open document",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity._id }),
      });

      if (!response.ok) throw new Error('Failed to unlink document');
      await fetchDocuments();

      toast({
        title: "Success",
        description: "Document removed from activity",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove document",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-8">
        {/* RAG Enable Switch - unchanged */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">Enable AI Guide in activity</h3>
            <p className="text-sm text-gray-500">
              Enable participants to interact with an AI guide to answer their questions through the activity.
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={handleRagToggle}
          />
        </div>

        {/* Source Documents */}
        <div className="space-y-4">
          {/* Header - unchanged */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Knowledge Base</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Document</DialogTitle>
                  <DialogDescription>
                    Choose how you want to add a document
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {/* Upload Option */}
                  <DirectUpload
                    onUploadComplete={handleUploadComplete}
                    accept=".txt"
                    label="Upload Document"
                    maxSize={1024 * 1024 * 1024} // 1GB
                    helperText="Only .txt files allowed (max 1GB)"
                  />

                  {/* Select from Library Option */}
                  <Button
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-2"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Library className="h-8 w-8" />
                    <span>Select from Library</span>
                  </Button>
                </div>

                {/* Library Documents List - Updated with View button */}
                {dialogOpen && (
                  <ScrollArea className="h-72 mt-4">
                    <div className="space-y-2">
                      {libraryDocuments.map((doc) => (
                        <div
                          key={doc._id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                        >
                          <div 
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => handleLibrarySelect(doc)}
                          >
                            <FileText className="h-5 w-5 text-gray-400" />
                            <span className="flex-1">{doc.filename}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDocument(doc._id);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Documents List - Updated with View button */}
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span>{doc.filename}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDocument(doc._id)}
                    className="text-gray-400 hover:text-blue-500"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc._id)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {documents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No documents added yet
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}