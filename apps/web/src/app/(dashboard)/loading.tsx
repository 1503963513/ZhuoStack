import { Loading } from '@/components/common/loading';

export default function DashboardLoading() {
  return (
    <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center">
      <Loading />
    </div>
  );
}
