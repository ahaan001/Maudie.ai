import { Sidebar } from '@/components/layout/Sidebar';
import { db } from '@/lib/db/client';
import { auditLog } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Bot, User, Settings, Download } from 'lucide-react';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const entries = await db.select().from(auditLog)
    .where(eq(auditLog.projectId, id as `${string}-${string}-${string}-${string}-${string}`))
    .orderBy(desc(auditLog.timestamp))
    .limit(200);

  return (
    <div className="flex min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
              <p className="text-gray-500 mt-1">Immutable log of all AI and human decisions</p>
            </div>
            <a
              href={`/api/projects/${id}/audit?format=csv`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No audit entries yet</div>
            ) : (
              entries.map(entry => (
                <div key={entry.id} className="flex items-start gap-4 p-4">
                  <ActorIcon actorType={entry.actorType} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionClass(entry.action)}`}>
                        {entry.action}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{entry.entityType}</span>
                      <span className="text-xs text-gray-400 font-mono truncate max-w-xs">{entry.entityId}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.actorType === 'agent' ? 'Agent:' : 'User:'} {entry.actorId}
                      {entry.contentHash && <> · hash: <code className="bg-gray-100 px-1 rounded">{entry.contentHash.slice(0, 12)}…</code></>}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(entry.timestamp!).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ActorIcon({ actorType }: { actorType: string }) {
  if (actorType === 'agent') return <Bot className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />;
  if (actorType === 'human') return <User className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />;
  return <Settings className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />;
}

function actionClass(action: string) {
  if (action === 'approved' || action === 'auto_approved') return 'bg-green-100 text-green-700';
  if (action === 'rejected') return 'bg-red-100 text-red-700';
  if (action === 'ai_generated') return 'bg-blue-100 text-blue-700';
  if (action === 'edited') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
}
