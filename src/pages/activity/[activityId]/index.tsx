'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Link, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SceneEditor } from '@/components/activity/scene-editor';
import { RagPanel } from '@/components/activity/rag-panel';
import { SettingsPanel } from '@/components/activity/settings-panel';
import { PairingModal } from '@/components/activity/pairing-modal';
import { JoinCodeModal } from '@/components/activity/join-code-modal';
import { Activity } from '@/types/activity';

export default function ActivityPage() {
  const router = useRouter();
  const params = useParams();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isJoinCodeModalOpen, setIsJoinCodeModalOpen] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        if (!params?.activityId) return;
        const response = await fetch(`/api/activities/${params.activityId}`);
        if (!response.ok) throw new Error('Failed to fetch activity');
        const data = await response.json();
        setActivity(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [params?.activityId]);

  if (isLoading) return <div>Loading...</div>;
  if (!activity) return <div>Activity not found</div>;
  if (!params?.activityId) return <div>Invalid activity ID</div>;

  const activityId = Array.isArray(params.activityId) 
    ? params.activityId[0] 
    : params.activityId;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="text-gray-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">{activity.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsJoinCodeModalOpen(true)}
                className="text-gray-600"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Join Activity
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsPairingModalOpen(true)}
                className="text-gray-600"
              >
                <Link className="h-4 w-4 mr-2" />
                Pair Editor App
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="scene-editor" className="space-y-6">
          <TabsList className="bg-gray-100 border-gray-200">
            <TabsTrigger 
              value="scene-editor"
              className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900"
            >
              Scene Editor
            </TabsTrigger>
            <TabsTrigger 
              value="rag"
              className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900"
            >
              AI Guide
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scene-editor" className="mt-6">
            <SceneEditor activity={activity} />
          </TabsContent>

          <TabsContent value="rag" className="mt-6">
            <RagPanel activity={activity} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsPanel 
              activity={activity} 
              onUpdate={(updated) => setActivity(updated)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <PairingModal 
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        activityId={activityId}
      />
      <JoinCodeModal
        isOpen={isJoinCodeModalOpen}
        onClose={() => setIsJoinCodeModalOpen(false)}
        activityId={activityId}
      />
    </div>
  );
}