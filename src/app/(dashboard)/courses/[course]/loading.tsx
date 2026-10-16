import { CourseSkeleton } from '@/components/shared/skeletons/CourseSkeleton';

export default function CourseLoading() {
  return (
    <main className="container mx-auto px-8 flex min-h-screen flex-col mt-6 mb-8">
      <CourseSkeleton />
    </main>
  );
}
