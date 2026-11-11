import { WorkspaceCollaborationEntry } from '@/components/workspace/WorkspaceCollaborationEntry';

export const dynamic = 'force-dynamic';

export default function CollaborationPage({ params }: { params: { inviteId: string } }) {
  return <WorkspaceCollaborationEntry inviteId={params.inviteId} />;
}
