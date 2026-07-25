import { CreatorNetworkList } from '../network-list';

export default async function FollowersPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  return <CreatorNetworkList handle={handle} direction="followers" page={page} />;
}
