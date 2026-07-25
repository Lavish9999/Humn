import { notFound } from 'next/navigation';
import { getCollectionDetail, getCollectionSaveContext } from '../../../lib/data/collections';
import { getFollowContext, type FollowContext } from '../../../lib/data/follows';
import type { CollectionSaveContext } from '../../../lib/data/types';
import { CollectionDetailClient } from './collection-detail-client';

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await getCollectionDetail(id).catch(() => null);
  if (!collection) notFound();

  const [saveContext, followContext] = await Promise.all([
    getCollectionSaveContext(collection.works.map(work => work.id)).catch((): CollectionSaveContext => ({
      isSignedIn: false,
      collections: [],
      savedByWork: {},
    })),
    getFollowContext(collection.works.map(work => work.creator_id)).catch((): FollowContext => ({
      isSignedIn: false,
      currentUserId: null,
      followingCreatorIds: [],
    })),
  ]);

  return <CollectionDetailClient initialCollection={collection} saveContext={saveContext} followContext={followContext} />;
}
